import 'fake-indexeddb/auto';
import { clear } from 'idb-keyval';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AccountApiError,
  AccountSynchronizer,
  getRememberedAccount,
  getSession,
  isLocallySignedOut,
  loginAccount,
  logoutAccount,
  rememberAccount,
  type Account,
} from './accounts';
import { loadPersisted, savePersisted } from './db';
import { defaultData } from './defaults';

const a: Account = {
  id: 'account-a',
  name: 'Test A',
};
const b: Account = {
  id: 'account-b',
  name: 'Test B',
};
const synchronizers: AccountSynchronizer[] = [];
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
beforeEach(async () => {
  await clear();
  vi.stubGlobal('localStorage', storage());
  vi.stubGlobal('sessionStorage', storage());
});
afterEach(async () => {
  for (const sync of synchronizers.splice(0)) await sync.stop();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
function coordinator(id: string) {
  const status = vi.fn();
  const sync = new AccountSynchronizer(id, {
    current: () => true,
    status,
    metadata: vi.fn(),
    remote: vi.fn(),
    localConflict: vi.fn(),
  });
  synchronizers.push(sync);
  return { sync, status };
}
const fail = (status: number, code: string) =>
  Response.json({ error: { code, message: code } }, { status });

describe('account sessions and automatic uploads', () => {
  it('exposes the genuine account-not-found status without treating network errors as registration', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(fail(404, 'account_not_found')),
    );
    await expect(loginAccount(a.name, '1234')).rejects.toMatchObject({
      status: 404,
      code: 'account_not_found',
    });
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
    await expect(loginAccount(a.name, '1234')).rejects.not.toBeInstanceOf(
      AccountApiError,
    );
  });

  it('locks explicit offline sign-out even if server logout fails', async () => {
    rememberAccount(a);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
    await expect(logoutAccount(a.id)).rejects.toThrow();
    expect(isLocallySignedOut()).toBe(true);
    expect(getRememberedAccount()).toBeNull();
    rememberAccount(a);
    expect(isLocallySignedOut()).toBe(false);
  });

  it('does not globally lock B when a stale A tab signs out after B has signed in', async () => {
    const bTab = storage();
    rememberAccount(b);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(fail(403, 'account_mismatch')),
    );
    await expect(logoutAccount(a.id)).rejects.toMatchObject({ status: 403 });
    expect(isLocallySignedOut()).toBe(true);
    vi.stubGlobal('sessionStorage', bTab);
    expect(isLocallySignedOut()).toBe(false);
    expect(getRememberedAccount()).toEqual(b);
  });

  it('a 401 locks this tab without exposing the cached profile as a valid session', async () => {
    rememberAccount(a);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(fail(401, 'session_required')),
    );
    expect(await getSession()).toBeNull();
    expect(getRememberedAccount()).toBeNull();
    expect(isLocallySignedOut()).toBe(true);
  });

  it('times out a hung session request instead of leaving the login gate waiting indefinitely', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener('abort', () =>
              reject(new DOMException('aborted', 'AbortError')),
            );
          }),
      ),
    );
    const waiting = expect(getSession()).rejects.toThrow('timed out');
    await vi.advanceTimersByTimeAsync(15000);
    await waiting;
  });

  it('retries an unknown upload outcome with its original immutable commit before uploading newer edits', async () => {
    const first = {
      ...defaultData(),
      profile: { ...defaultData().profile, name: 'first snapshot' },
    };
    await savePersisted(first, 0, 'local-1', a.id);
    let remoteRevision = 0;
    let remoteData = first;
    const receipts = new Map<string, number>();
    const calls: {
      expectedRevision: number;
      commitId: string;
      data: typeof first;
    }[] = [];
    const fetcher = vi.fn(async (_url: string, init: RequestInit) => {
      if (!init.body)
        return Response.json({
          data: remoteData,
          revision: remoteRevision,
          updatedAt: 1767225600000,
        });
      const body = JSON.parse(init.body as string);
      calls.push(body);
      expect(new Headers(init.headers).get('X-Gymmiie-Account')).toBe(a.id);
      if (!receipts.has(body.commitId)) {
        expect(body.expectedRevision).toBe(remoteRevision);
        receipts.set(body.commitId, ++remoteRevision);
        remoteData = body.data;
      }
      if (calls.length === 1)
        throw new TypeError('response lost after server commit');
      return Response.json({
        revision: receipts.get(body.commitId),
        updatedAt: 1767225600000,
        commitId: body.commitId,
      });
    });
    vi.stubGlobal('fetch', fetcher);
    const { sync, status } = coordinator(a.id);
    await expect(sync.flush()).rejects.toThrow('Could not connect. Check your internet connection and try again.');
    expect(status).toHaveBeenLastCalledWith('offline', expect.any(String));
    const pending = (await loadPersisted(a.id))!.sync!.pending!;
    const newer = {
      ...first,
      profile: { ...first.profile, name: 'newer edit' },
    };
    await savePersisted(newer, 1, 'local-2', a.id);
    await sync.flush();
    expect(calls).toHaveLength(3);
    expect(calls[0].commitId).toBe(calls[1].commitId);
    expect(calls[1].commitId).toBe(pending.commitId);
    expect(calls[1].data.profile.name).toBe('first snapshot');
    expect(calls[2].data.profile.name).toBe('newer edit');
    expect(calls[2].expectedRevision).toBe(1);
    expect((await loadPersisted(a.id))?.sync).toEqual({
      remoteRevision: 2,
      dirty: false,
      pending: null,
    });
  });

  it('preserves the local copy and outbox on cloud revision conflict', async () => {
    const data = defaultData();
    await savePersisted(data, 0, 'local', a.id);
    const fetcher = vi.fn().mockResolvedValue(fail(409, 'revision_conflict'));
    vi.stubGlobal('fetch', fetcher);
    const { sync, status } = coordinator(a.id);
    await expect(sync.flush()).rejects.toMatchObject({ status: 409 });
    expect((await loadPersisted(a.id))?.data).toEqual(data);
    expect((await loadPersisted(a.id))?.sync?.pending).not.toBeNull();
    expect(status).toHaveBeenLastCalledWith('conflict', expect.any(String));
    sync.schedule(0);
    await sync.flush();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('a cookie account mismatch stops synchronization without sending A data to a B URL', async () => {
    await savePersisted(defaultData(), 0, 'local', a.id);
    const fetcher = vi.fn().mockResolvedValue(fail(403, 'account_mismatch'));
    vi.stubGlobal('fetch', fetcher);
    const { sync, status } = coordinator(a.id);
    await expect(sync.flush()).rejects.toMatchObject({ status: 403 });
    expect(fetcher.mock.calls[0][0]).toBe(`/api/accounts/${a.id}/data`);
    expect(status).toHaveBeenLastCalledWith(
      'session-expired',
      expect.any(String),
    );
    expect(await loadPersisted(b.id)).toBeNull();
    expect((await loadPersisted(a.id))?.sync?.pending).not.toBeNull();
  });

  it('aborts an old account request while preserving its retryable outbox', async () => {
    await savePersisted(defaultData(), 0, 'local', a.id);
    let started!: () => void;
    const beginning = new Promise<void>((resolve) => {
      started = resolve;
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener('abort', () =>
              reject(new DOMException('aborted', 'AbortError')),
            );
            started();
          }),
      ),
    );
    const { sync } = coordinator(a.id);
    const running = sync.flush();
    await beginning;
    await sync.stop();
    await running;
    expect((await loadPersisted(a.id))?.sync?.pending).not.toBeNull();
    expect(await loadPersisted(b.id)).toBeNull();
  });

  it('keeps an oversized log locally, stops automatic retry and allows a corrected smaller snapshot', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const data = {
      ...defaultData(),
      notes: [
        {
          id: 'large',
          exerciseId: '',
          date: '2026-01-01',
          createdAt: '2026-01-01T00:00:00Z',
          kind: 'note' as const,
          text: 'x'.repeat(1900000),
        },
      ],
    };
    await savePersisted(data, 0, 'local-large', a.id);
    const fetcher = vi.fn(async (_url: string, init: RequestInit) => {
      if (!init.body)
        return Response.json({
          data: defaultData(),
          revision: 1,
          updatedAt: 1767225600000,
        });
      const body = JSON.parse(init.body as string);
      return Response.json({
        revision: 1,
        updatedAt: 1767225600000,
        commitId: body.commitId,
      });
    });
    vi.stubGlobal('fetch', fetcher);
    const { sync, status } = coordinator(a.id);
    await expect(sync.flush()).rejects.toMatchObject({ status: 413 });
    expect(fetcher).not.toHaveBeenCalled();
    expect((await loadPersisted(a.id))?.data).toEqual(data);
    expect((await loadPersisted(a.id))?.sync?.pending).toBeNull();
    const count = status.mock.calls.length;
    await vi.advanceTimersByTimeAsync(60000);
    expect(status.mock.calls).toHaveLength(count);
    await savePersisted(defaultData(), 1, 'local-corrected', a.id);
    await sync.flush();
    expect((await loadPersisted(a.id))?.sync?.dirty).toBe(false);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
