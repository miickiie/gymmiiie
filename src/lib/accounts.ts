import type { AppData } from '../types';
import { parseBackup } from './backup';
import {
  acknowledgeAccountUpload,
  loadPersisted,
  PersistenceConflictError,
  prepareAccountUpload,
  rejectAccountUpload,
  type AccountSyncMetadata,
} from './db';

export interface Account {
  id: string;
  name: string;
  telephone: string;
}
export interface RemoteAccountData {
  data: AppData | null;
  revision: number;
  updatedAt: number | null;
}
export type CloudStatus =
  'idle' | 'pending' | 'syncing' | 'offline' | 'conflict' | 'session-expired';
export class AccountApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AccountApiError';
  }
}
const REMEMBERED = 'gymmiie:account:last';
const LOCKED = 'gymmiie:account:signed-out';
const TAB_LOCKED = 'gymmiie:account:tab-locked';
export const SESSION_EVENT_KEY = 'gymmiie:account:session-event';
export const manualSyncStorageKey = (id: string, kind: 'code' | 'status') =>
  `gymmiie:account:${id}:sync-${kind}`;

function validAccount(value: unknown): Account {
  const account = value as Account | null;
  if (
    !account ||
    ![account.id, account.name, account.telephone].every(
      (v) => typeof v === 'string' && v.length > 0,
    )
  )
    throw new Error(
      'The account response is invalid. Your local log has been kept.',
    );
  return { id: account.id, name: account.name, telephone: account.telephone };
}
export function isLocallySignedOut(): boolean {
  try {
    if (sessionStorage.getItem(TAB_LOCKED) === '1') return true;
    const raw = localStorage.getItem(REMEMBERED);
    const last = raw ? validAccount(JSON.parse(raw)) : null;
    return !!last && localStorage.getItem(`${LOCKED}:${last.id}`) === '1';
  } catch {
    return true;
  }
}
export function getRememberedAccount(): Account | null {
  try {
    if (isLocallySignedOut()) return null;
    const raw = localStorage.getItem(REMEMBERED);
    return raw ? validAccount(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}
export function rememberAccount(account: Account): void {
  try {
    localStorage.setItem(REMEMBERED, JSON.stringify(account));
    localStorage.removeItem(`${LOCKED}:${account.id}`);
    sessionStorage.removeItem(TAB_LOCKED);
  } catch {
    /* Online sessions still work when device preferences cannot be remembered. */
  }
}
export function markSessionExpired(): void {
  try {
    sessionStorage.setItem(TAB_LOCKED, '1');
  } catch {
    /* The active gate is also locked in memory. */
  }
}
function announceSession(accountId: string | null, expectedAccountId?: string) {
  try {
    localStorage.setItem(
      SESSION_EVENT_KEY,
      JSON.stringify({
        accountId,
        expectedAccountId,
        nonce: crypto.randomUUID(),
      }),
    );
  } catch {
    /* The server also verifies the account on every data request. */
  }
}
function lockDevice(accountId: string) {
  markSessionExpired();
  try {
    localStorage.setItem(`${LOCKED}:${accountId}`, '1');
  } catch {
    /* Gate state remains locked for this page. */
  }
}

async function request(path: string, init: RequestInit = {}): Promise<unknown> {
  const controller = new AbortController();
  let timedOut = false;
  const aborted = () => controller.abort();
  if (init.signal?.aborted) aborted();
  else init.signal?.addEventListener('abort', aborted, { once: true });
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, 15000);
  try {
    const response = await fetch(path, {
      ...init,
      signal: controller.signal,
      credentials: 'same-origin',
      headers: {
        ...(init.body ? { 'content-type': 'application/json' } : {}),
        ...init.headers,
      },
    });
    if (!response.ok) {
      let code = 'request_failed',
        message = `Account request failed (${response.status}).`;
      try {
        const result = (await response.json()) as {
          error?: { code?: string; message?: string };
        };
        code = result.error?.code ?? code;
        message = result.error?.message ?? message;
      } catch {
        /* Never expose raw error pages or submitted credentials. */
      }
      throw new AccountApiError(response.status, code, message);
    }
    return response.status === 204 ? null : await response.json();
  } catch (error) {
    if (timedOut)
      throw new Error(
        'The cloud request timed out. Local changes have been kept; reconnect and retry.',
      );
    throw error;
  } finally {
    clearTimeout(timeout);
    init.signal?.removeEventListener('abort', aborted);
  }
}
export async function getSession(
  signal?: AbortSignal,
): Promise<Account | null> {
  try {
    const result = (await request('/api/session', { signal })) as {
      account: unknown;
    };
    return validAccount(result.account);
  } catch (error) {
    if (error instanceof AccountApiError && error.status === 401) {
      markSessionExpired();
      return null;
    }
    throw error;
  }
}
export async function loginAccount(
  name: string,
  telephone: string,
): Promise<Account> {
  const result = (await request('/api/session', {
    method: 'POST',
    body: JSON.stringify({ name, telephone }),
  })) as { account: unknown };
  const account = validAccount(result.account);
  rememberAccount(account);
  announceSession(account.id);
  return account;
}
export async function registerAccount(
  name: string,
  telephone: string,
  passphrase: string,
): Promise<Account> {
  const result = (await request('/api/accounts/register', {
    method: 'POST',
    body: JSON.stringify({ name, telephone, passphrase }),
  })) as { account: unknown };
  const account = validAccount(result.account);
  rememberAccount(account);
  announceSession(account.id);
  return account;
}
export async function logoutAccount(accountId: string): Promise<void> {
  lockDevice(accountId);
  announceSession(null, accountId);
  await request('/api/session', {
    method: 'DELETE',
    headers: { 'X-Gymmiie-Account': accountId },
  });
}
export async function fetchAccountData(
  accountId: string,
  signal?: AbortSignal,
): Promise<RemoteAccountData> {
  const value = (await request(
    `/api/accounts/${encodeURIComponent(accountId)}/data`,
    { signal, headers: { 'X-Gymmiie-Account': accountId } },
  )) as RemoteAccountData;
  if (
    !Number.isSafeInteger(value?.revision) ||
    value.revision < 0 ||
    (value.updatedAt !== null &&
      (typeof value.updatedAt !== 'number' ||
        !Number.isFinite(value.updatedAt) ||
        value.updatedAt < 0))
  )
    throw new Error(
      'The cloud profile response is invalid. Your local log has been kept.',
    );
  return {
    data: value.data === null ? null : parseBackup(value.data),
    revision: value.revision,
    updatedAt: value.updatedAt,
  };
}
async function putAccountData(
  accountId: string,
  pending: NonNullable<AccountSyncMetadata['pending']>,
  signal: AbortSignal,
) {
  const data = parseBackup(pending.data);
  if (new TextEncoder().encode(JSON.stringify(data)).byteLength > 1900000)
    throw new AccountApiError(
      413,
      'payload_too_large',
      'This log is too large for one cloud profile. Export a backup; the complete copy is still saved on this device.',
    );
  const result = (await request(
    `/api/accounts/${encodeURIComponent(accountId)}/data`,
    {
      method: 'PUT',
      signal,
      headers: { 'X-Gymmiie-Account': accountId },
      body: JSON.stringify({
        data,
        expectedRevision: pending.expectedRevision,
        commitId: pending.commitId,
      }),
    },
  )) as { revision: number; updatedAt: number; commitId: string };
  if (
    !Number.isSafeInteger(result?.revision) ||
    result.revision < 1 ||
    typeof result.updatedAt !== 'number' ||
    !Number.isFinite(result.updatedAt) ||
    result.updatedAt < 0 ||
    result.commitId !== pending.commitId
  )
    throw new Error(
      'The cloud save response could not be verified. The same save will be retried safely.',
    );
  return result;
}

interface SyncCallbacks {
  current(): boolean;
  status(status: CloudStatus, error: string | null): void;
  metadata(meta: AccountSyncMetadata): void;
  remote(
    remote: RemoteAccountData,
    expectedLocalRevision: number,
  ): Promise<void>;
  localConflict(error: PersistenceConflictError): void;
}

/** One immutable account context; pending requests are durable before fetch. */
export class AccountSynchronizer {
  private timer: ReturnType<typeof setTimeout> | undefined;
  private controller: AbortController | undefined;
  private running: Promise<void> | null = null;
  private stopped = false;
  private failures = 0;
  constructor(
    readonly accountId: string,
    private callbacks: SyncCallbacks,
  ) {}
  schedule(delay = 750) {
    if (this.stopped || !this.callbacks.current()) return;
    clearTimeout(this.timer);
    this.callbacks.status('pending', null);
    this.timer = setTimeout(() => {
      void this.flush().catch(() => undefined);
    }, delay);
  }
  flush(refresh = false): Promise<void> {
    clearTimeout(this.timer);
    if (this.stopped || !this.callbacks.current()) return Promise.resolve();
    if (this.running) return this.running;
    this.controller = new AbortController();
    const signal = this.controller.signal;
    this.running = (async () => {
      let attemptedCommitId: string | undefined;
      try {
        let wrote = false;
        while (!this.stopped && this.callbacks.current()) {
          const cached = await loadPersisted(this.accountId);
          if (!cached)
            throw new Error('The local account cache is unavailable.');
          const meta = await prepareAccountUpload(
            this.accountId,
            cached.revision,
          );
          if (!meta.pending) break;
          attemptedCommitId = meta.pending.commitId;
          this.callbacks.status('syncing', null);
          const response = await putAccountData(
            this.accountId,
            meta.pending,
            signal,
          );
          wrote = true;
          const acknowledged = await acknowledgeAccountUpload(
            this.accountId,
            meta.pending.commitId,
            response.revision,
          );
          if (!this.callbacks.current() || this.stopped) return;
          this.callbacks.metadata(acknowledged);
        }
        if ((refresh || wrote) && !this.stopped && this.callbacks.current()) {
          const cached = await loadPersisted(this.accountId);
          const remote = await fetchAccountData(this.accountId, signal);
          if (cached && this.callbacks.current() && !this.stopped)
            await this.callbacks.remote(remote, cached.revision);
        }
        this.failures = 0;
        if (this.callbacks.current() && !this.stopped) {
          const latest = await loadPersisted(this.accountId);
          if (latest?.sync?.dirty || latest?.sync?.pending) this.schedule();
          else this.callbacks.status('idle', null);
        }
      } catch (error) {
        if (
          this.stopped ||
          !this.callbacks.current() ||
          (error instanceof Error && error.name === 'AbortError')
        )
          return;
        if (
          error instanceof AccountApiError &&
          (error.status === 400 || error.status === 413) &&
          attemptedCommitId
        )
          await rejectAccountUpload(this.accountId, attemptedCommitId);
        const message =
          error instanceof Error
            ? error.message
            : 'Cloud synchronization is unavailable. Changes are kept on this device.';
        if (
          error instanceof AccountApiError &&
          (error.status === 401 || error.status === 403)
        ) {
          this.stopped = true;
          markSessionExpired();
          this.callbacks.status(
            'session-expired',
            'Sign in again to synchronize this account. Local changes have been kept.',
          );
        } else if (error instanceof AccountApiError && error.status === 409) {
          this.stopped = true;
          this.callbacks.status(
            'conflict',
            'Another device saved a newer log. Export this local copy or load the latest cloud profile.',
          );
        } else if (error instanceof PersistenceConflictError) {
          this.stopped = true;
          this.callbacks.localConflict(error);
        } else {
          this.callbacks.status('offline', message);
          if (!(
            error instanceof AccountApiError &&
            error.status >= 400 &&
            error.status < 500 &&
            error.status !== 429
          ))
            this.timer = setTimeout(
              () => {
                void this.flush(true).catch(() => undefined);
              },
              Math.min(30000, 2000 * 2 ** this.failures++),
            );
        }
        throw error;
      }
    })().finally(() => {
      this.running = null;
      this.controller = undefined;
    });
    return this.running;
  }
  async stop() {
    this.stopped = true;
    clearTimeout(this.timer);
    this.controller?.abort();
    await this.running?.catch(() => undefined);
  }
}
