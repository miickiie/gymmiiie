import 'fake-indexeddb/auto';
import { clear, get, set } from 'idb-keyval';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultData, useStore } from './store';
import * as db from './db';
import {
  AccountApiError,
  isLocallySignedOut,
  logoutAccount,
  type Account,
} from './accounts';
import { parseBackup } from './backup';
import { readPendingSnapshot, writePendingSnapshot } from './pendingSnapshot';
import type { AppData } from '../types';

const a: Account = {
  id: 'account-a',
  name: 'Test Account A',
};
const b: Account = {
  id: 'account-b',
  name: 'Test Account B',
};
const profile = (name: string) => ({
  ...defaultData(),
  onboarded: true,
  profile: { ...defaultData().profile, name },
});
function storage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
  };
}
let api: ReturnType<typeof server>;
function server() {
  const profiles = new Map<
    string,
    { data: AppData | null; revision: number }
  >();
  const receipts = new Map<string, { revision: number; data: AppData }>();
  const state = {
    accountId: a.id,
    available: true,
    loseNextPutResponse: false,
    profiles,
    calls: [] as { accountId: string; method: string; data?: AppData }[],
  };
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      if (!state.available) throw new TypeError('offline');
      if (url === '/api/session' && init.method === 'DELETE')
        return new Response(null, { status: 204 });
      const match = url.match(/^\/api\/accounts\/([^/]+)\/data$/);
      if (!match) throw new Error(`Unexpected test request: ${url}`);
      const id = decodeURIComponent(match[1]),
        method = init.method ?? 'GET';
      const body = init.body ? JSON.parse(init.body as string) : undefined;
      state.calls.push({ accountId: id, method, data: body?.data });
      if (id !== state.accountId)
        return Response.json(
          { error: { code: 'account_mismatch', message: 'account mismatch' } },
          { status: 403 },
        );
      expect(new Headers(init.headers).get('X-Gymmiie-Account')).toBe(id);
      const current = profiles.get(id) ?? { data: null, revision: 0 };
      if (method === 'GET')
        return Response.json({
          ...current,
          updatedAt: current.revision ? 1767225600000 : null,
        });
      const receiptKey = `${id}:${body.commitId}`,
        receipt = receipts.get(receiptKey);
      if (receipt)
        return Response.json({
          revision: receipt.revision,
          updatedAt: 1767225600000,
          commitId: body.commitId,
        });
      if (body.expectedRevision !== current.revision)
        return Response.json(
          {
            error: {
              code: 'revision_conflict',
              message: 'newer remote revision',
            },
          },
          { status: 409 },
        );
      const data = parseBackup(body.data),
        revision = current.revision + 1;
      profiles.set(id, { data, revision });
      receipts.set(receiptKey, { data, revision });
      if (state.loseNextPutResponse) {
        state.loseNextPutResponse = false;
        throw new TypeError('response lost after commit');
      }
      return Response.json({
        revision,
        updatedAt: 1767225600000,
        commitId: body.commitId,
      });
    }),
  );
  return state;
}
beforeEach(async () => {
  await useStore
    .getState()
    .deactivateAccount()
    .catch(() => undefined);
  await clear();
  vi.stubGlobal('localStorage', storage());
  vi.stubGlobal('sessionStorage', storage());
  api = server();
});
afterEach(async () => {
  await useStore
    .getState()
    .deactivateAccount()
    .catch(() => undefined);
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('account-scoped tracking persistence', () => {
  it('loads only the authenticated account and never automatically claims the legacy device log', async () => {
    const legacy = profile('Legacy device owner');
    await set('gymmiie:data:v1', legacy);
    writePendingSnapshot({ version: 1, data: legacy, baseRevision: 0 });
    api.profiles.set(a.id, { data: profile('Cloud A'), revision: 1 });
    await useStore.getState().activateAccount(a);
    expect(useStore.getState().data.profile.name).toBe('Cloud A');
    expect((await db.loadPersisted(a.id))?.sync).toEqual({
      remoteRevision: 1,
      dirty: false,
      pending: null,
    });
    expect(await get('gymmiie:data:v1')).toEqual(legacy);
    expect(readPendingSnapshot()).toMatchObject({ data: legacy });
    expect(await useStore.getState().previewLegacyDeviceData()).toEqual(legacy);
    await useStore.getState().importLegacyDeviceData();
    expect(useStore.getState().account?.id).toBe(a.id);
    expect(useStore.getState().data.profile.name).toBe('Legacy device owner');
    expect(await get('gymmiie:data:v1')).toEqual(legacy);
  });

  it('switches A to B without leaking caches, journals, pending snapshots or delayed writes', async () => {
    api.profiles.set(a.id, { data: profile('Cloud A'), revision: 1 });
    api.profiles.set(b.id, { data: profile('Cloud B'), revision: 1 });
    await useStore.getState().activateAccount(a);
    useStore.getState().setProfile({ name: 'A local edit' });
    await useStore.getState().flushPersistence();
    api.accountId = b.id;
    await useStore.getState().activateAccount(b);
    expect(useStore.getState().data.profile.name).toBe('Cloud B');
    expect((await db.loadPersisted(a.id))?.data).toMatchObject({
      profile: { name: 'A local edit' },
    });
    expect((await db.loadPersisted(b.id))?.data).toMatchObject({
      profile: { name: 'Cloud B' },
    });
    useStore.getState().setProfile({ name: 'B local edit' });
    await useStore.getState().flushAccountSync();
    expect(api.profiles.get(b.id)?.data?.profile.name).toBe('B local edit');
    expect(api.profiles.get(a.id)?.data?.profile.name).toBe('Cloud A');
    api.accountId = a.id;
    await useStore.getState().activateAccount(a);
    await useStore.getState().flushAccountSync();
    expect(api.profiles.get(a.id)?.data?.profile.name).toBe('A local edit');
    expect(api.profiles.get(b.id)?.data?.profile.name).toBe('B local edit');
    expect(
      api.calls
        .filter((call) => call.method === 'PUT')
        .every((call) =>
          call.data?.profile.name.startsWith(
            call.accountId === a.id ? 'A ' : 'B ',
          ),
        ),
    ).toBe(true);
  });

  it('keeps dirty local records on a newer cloud revision until an explicit cloud replacement', async () => {
    api.profiles.set(a.id, { data: profile('initial cloud'), revision: 1 });
    await useStore.getState().activateAccount(a);
    useStore.getState().setProfile({ name: 'offline local edit' });
    await useStore.getState().deactivateAccount();
    api.profiles.set(a.id, {
      data: profile('newer other device'),
      revision: 2,
    });
    await useStore.getState().activateAccount(a);
    expect(useStore.getState().cloudStatus).toBe('conflict');
    expect(useStore.getState().data.profile.name).toBe('offline local edit');
    useStore.getState().setProfile({ name: 'must not change' });
    expect(useStore.getState().data.profile.name).toBe('offline local edit');
    await useStore.getState().reloadAccountData();
    expect(useStore.getState().data.profile.name).toBe('newer other device');
    expect(useStore.getState().cloudStatus).toBe('idle');
    expect((await db.loadPersisted(a.id))?.sync?.dirty).toBe(false);
  });

  it('a cookie changed to B stops A sync and prevents offline bypass of the expired session', async () => {
    api.profiles.set(a.id, { data: profile('A'), revision: 1 });
    await useStore.getState().activateAccount(a);
    useStore.getState().setProfile({ name: 'A unsaved cloud edit' });
    api.accountId = b.id;
    await expect(useStore.getState().flushAccountSync()).rejects.toBeInstanceOf(
      AccountApiError,
    );
    expect(useStore.getState().accountMode).toBe('locked');
    expect(useStore.getState().cloudStatus).toBe('session-expired');
    expect((await db.loadPersisted(a.id))?.data).toMatchObject({
      profile: { name: 'A unsaved cloud edit' },
    });
    await expect(
      useStore.getState().activateAccount(a, { offline: true }),
    ).rejects.toThrow('Sign in online');
    expect(await db.loadPersisted(b.id)).toBeNull();
  });

  it('requires explicit cached continuation and blocks it after offline sign-out', async () => {
    api.profiles.set(a.id, { data: profile('Cached A'), revision: 1 });
    await useStore.getState().activateAccount(a);
    await useStore.getState().deactivateAccount();
    api.available = false;
    await expect(useStore.getState().activateAccount(a)).rejects.toThrow(
      'offline',
    );
    expect(useStore.getState().accountMode).toBe('locked');
    await useStore.getState().activateAccount(a, { offline: true });
    expect(useStore.getState().accountMode).toBe('offline');
    expect(useStore.getState().data.profile.name).toBe('Cached A');
    await useStore.getState().deactivateAccount();
    await expect(logoutAccount(a.id)).rejects.toThrow();
    expect(isLocallySignedOut()).toBe(true);
    await expect(
      useStore.getState().activateAccount(a, { offline: true }),
    ).rejects.toThrow('Sign in online');
    expect((await db.loadPersisted(a.id))?.data).toMatchObject({
      profile: { name: 'Cached A' },
    });
  });

  it('new accounts start with their name and empty tracking, then automatically persist to D1', async () => {
    await set('gymmiie:data:v1', profile('Unrelated old owner'));
    await useStore.getState().activateAccount(a);
    expect(useStore.getState().data.profile.name).toBe(a.name);
    expect(useStore.getState().data.sessions).toEqual([]);
    expect(useStore.getState().data.onboarded).toBe(false);
    await useStore.getState().flushAccountSync();
    expect(api.profiles.get(a.id)?.data?.profile.name).toBe(a.name);
    expect(api.profiles.get(a.id)?.revision).toBe(1);
    expect((await db.loadPersisted(a.id))?.sync).toEqual({
      remoteRevision: 1,
      dirty: false,
      pending: null,
    });
  });

  it('local read failure never publishes default data or replaces the account cache', async () => {
    const existing = profile('Keep cached A');
    await db.savePersisted(existing, 0, 'local', a.id, {
      remoteRevision: 1,
      dirty: false,
      pending: null,
    });
    vi.spyOn(db, 'loadPersisted').mockRejectedValueOnce(
      new Error('storage denied'),
    );
    await expect(useStore.getState().activateAccount(a)).rejects.toThrow(
      'storage denied',
    );
    expect(useStore.getState().hydrated).toBe(false);
    expect(useStore.getState().accountMode).toBe('locked');
    expect((await db.loadPersisted(a.id))?.data).toEqual(existing);
    expect(api.calls).toHaveLength(0);
  });

  it('a delayed legacy import confirmed under A cannot replace B after an account switch', async () => {
    api.profiles.set(a.id, { data: profile('A'), revision: 1 });
    api.profiles.set(b.id, { data: profile('B'), revision: 1 });
    await set('gymmiie:data:v1', profile('Legacy owner'));
    await useStore.getState().activateAccount(a);
    const original = db.loadRawPersisted;
    let release!: () => void;
    const wait = new Promise<void>((resolve) => {
      release = resolve;
    });
    vi.spyOn(db, 'loadRawPersisted').mockImplementationOnce(async () => {
      await wait;
      return original();
    });
    const importing = useStore.getState().importLegacyDeviceData();
    const rejected = expect(importing).rejects.toThrow(
      'active account changed',
    );
    api.accountId = b.id;
    await useStore.getState().activateAccount(b);
    release();
    await rejected;
    expect(useStore.getState().account?.id).toBe(b.id);
    expect(useStore.getState().data.profile.name).toBe('B');
    expect((await db.loadPersisted(b.id))?.data).toMatchObject({
      profile: { name: 'B' },
    });
  });

  it('refreshes the latest server revision after retrying an older committed request receipt', async () => {
    api.profiles.set(a.id, { data: profile('initial'), revision: 1 });
    await useStore.getState().activateAccount(a);
    useStore.getState().setProfile({ name: 'own committed update' });
    api.loseNextPutResponse = true;
    await expect(useStore.getState().flushAccountSync()).rejects.toThrow(
      'response lost',
    );
    expect((await db.loadPersisted(a.id))?.sync?.pending).not.toBeNull();
    await useStore.getState().deactivateAccount();
    api.profiles.set(a.id, {
      data: profile('later other device update'),
      revision: 3,
    });
    await useStore.getState().activateAccount(a);
    expect(useStore.getState().data.profile.name).toBe(
      'later other device update',
    );
    expect((await db.loadPersisted(a.id))?.sync).toEqual({
      remoteRevision: 3,
      dirty: false,
      pending: null,
    });
  });

  it('retains newer local edits as a conflict when an older retry receipt precedes another device revision', async () => {
    api.profiles.set(a.id, { data: profile('initial'), revision: 1 });
    await useStore.getState().activateAccount(a);
    useStore.getState().setProfile({ name: 'own first update' });
    api.loseNextPutResponse = true;
    await expect(useStore.getState().flushAccountSync()).rejects.toThrow(
      'response lost',
    );
    useStore.getState().setProfile({ name: 'newer unsynced local update' });
    await useStore.getState().deactivateAccount();
    api.profiles.set(a.id, {
      data: profile('other device revision three'),
      revision: 3,
    });
    await useStore.getState().activateAccount(a);
    expect(useStore.getState().accountMode).toBe('online');
    expect(useStore.getState().cloudStatus).toBe('conflict');
    expect(useStore.getState().data.profile.name).toBe(
      'newer unsynced local update',
    );
    expect(api.profiles.get(a.id)?.data?.profile.name).toBe(
      'other device revision three',
    );
  });
});
