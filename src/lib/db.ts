import { get, update } from 'idb-keyval';
import type { AppData } from '../types';

const KEY = 'gymmiie:data:v1';
const REVISION = '__storageRevision';
const COMMIT = '__storageCommit';
const SYNC = '__accountSync';

export interface PendingAccountUpload {
  data: AppData;
  expectedRevision: number;
  commitId: string;
  localRevision: number;
}
export interface AccountSyncMetadata {
  remoteRevision: number;
  dirty: boolean;
  pending: PendingAccountUpload | null;
}
export const emptyAccountSync = (): AccountSyncMetadata => ({
  remoteRevision: 0,
  dirty: false,
  pending: null,
});
export const accountDataKey = (accountId?: string): string =>
  accountId ? `${KEY}:account:${accountId}` : KEY;

export class PersistenceConflictError extends Error {
  constructor() {
    super(
      'Your log changed in another tab. Export this unsaved copy or reload the latest log.',
    );
    this.name = 'PersistenceConflictError';
  }
}

function revisionOf(value: unknown): number {
  if (!value || typeof value !== 'object') return 0;
  const revision = (value as Record<string, unknown>)[REVISION];
  if (revision === undefined) return 0;
  if (
    typeof revision !== 'number' ||
    !Number.isSafeInteger(revision) ||
    revision < 0
  ) {
    throw new Error(
      'The saved log has invalid storage metadata. Export a recovery copy before replacing it.',
    );
  }
  return revision;
}

export async function loadPersisted(accountId?: string): Promise<{
  data: unknown;
  revision: number;
  raw: unknown;
  commitToken?: string;
  sync?: AccountSyncMetadata;
} | null> {
  const value: unknown = await loadRawPersisted(accountId);
  if (value === undefined || value === null) return null;
  const revision = revisionOf(value);
  if (typeof value !== 'object' || Array.isArray(value))
    return { data: value, revision, raw: value };
  const {
    [REVISION]: _revision,
    [COMMIT]: token,
    [SYNC]: sync,
    ...data
  } = value as Record<string, unknown>;
  return {
    data,
    revision,
    raw: value,
    commitToken: typeof token === 'string' ? token : undefined,
    ...(accountId ? { sync: readSync(sync) } : {}),
  };
}

/** Recovery exports must remain possible even when the record cannot be validated. */
export function loadRawPersisted(accountId?: string): Promise<unknown> {
  return get(accountDataKey(accountId));
}

/** Compare and write in a single readwrite transaction, including across tabs. */
export async function savePersisted(
  data: AppData,
  expectedRevision: number,
  commitToken?: string,
  accountId?: string,
  syncOverride?: AccountSyncMetadata,
): Promise<number> {
  let nextRevision = expectedRevision;
  await update(accountDataKey(accountId), (current: unknown) => {
    if (revisionOf(current) !== expectedRevision)
      throw new PersistenceConflictError();
    nextRevision = expectedRevision + 1;
    return {
      ...data,
      [REVISION]: nextRevision,
      ...(commitToken ? { [COMMIT]: commitToken } : {}),
      ...(accountId
        ? {
            [SYNC]: syncOverride ?? {
              ...readSync(
                (current as Record<string, unknown> | undefined)?.[SYNC],
              ),
              dirty: true,
            },
          }
        : {}),
    };
  });
  return nextRevision;
}

function readSync(value: unknown): AccountSyncMetadata {
  if (value === undefined) return { ...emptyAccountSync(), dirty: true };
  const row = value as AccountSyncMetadata | null;
  if (
    !row ||
    !Number.isSafeInteger(row.remoteRevision) ||
    row.remoteRevision < 0 ||
    typeof row.dirty !== 'boolean'
  )
    throw new Error(
      'Invalid account synchronization metadata. Export this cache before replacing it.',
    );
  if (row.pending !== null) {
    const p = row.pending;
    if (
      !p ||
      typeof p.commitId !== 'string' ||
      !Number.isSafeInteger(p.expectedRevision) ||
      p.expectedRevision < 0 ||
      !Number.isSafeInteger(p.localRevision) ||
      p.localRevision < 0 ||
      !p.data ||
      typeof p.data !== 'object'
    )
      throw new Error(
        'Invalid pending account upload. Export this cache before replacing it.',
      );
  }
  return row;
}

/** Persist the immutable request before sending it, so an unknown outcome can be retried. */
export async function prepareAccountUpload(
  accountId: string,
  expectedLocalRevision: number,
): Promise<AccountSyncMetadata> {
  let result = emptyAccountSync();
  await update(accountDataKey(accountId), (value: unknown) => {
    if (revisionOf(value) !== expectedLocalRevision)
      throw new PersistenceConflictError();
    const row = value as Record<string, unknown>;
    const sync = readSync(row[SYNC]);
    if (sync.pending || !sync.dirty) {
      result = sync;
      return value;
    }
    const {
      [REVISION]: _revision,
      [COMMIT]: _commit,
      [SYNC]: _sync,
      ...data
    } = row;
    result = {
      ...sync,
      pending: {
        data: data as unknown as AppData,
        expectedRevision: sync.remoteRevision,
        commitId: crypto.randomUUID(),
        localRevision: expectedLocalRevision,
      },
    };
    return { ...row, [SYNC]: result };
  });
  return result;
}

export async function acknowledgeAccountUpload(
  accountId: string,
  commitId: string,
  remoteRevision: number,
): Promise<AccountSyncMetadata> {
  let result = emptyAccountSync();
  await update(accountDataKey(accountId), (value: unknown) => {
    if (!value || typeof value !== 'object')
      throw new PersistenceConflictError();
    const row = value as Record<string, unknown>,
      sync = readSync(row[SYNC]);
    if (sync.pending?.commitId !== commitId) {
      if (sync.remoteRevision >= remoteRevision) {
        result = sync;
        return value;
      }
      throw new PersistenceConflictError();
    }
    result = {
      remoteRevision,
      pending: null,
      dirty: revisionOf(row) !== sync.pending.localRevision,
    };
    return { ...row, [SYNC]: result };
  });
  return result;
}

/** Definite validation/size failures may be replaced by a corrected newer draft. */
export async function rejectAccountUpload(
  accountId: string,
  commitId: string,
): Promise<void> {
  await update(accountDataKey(accountId), (value: unknown) => {
    if (!value || typeof value !== 'object')
      throw new PersistenceConflictError();
    const row = value as Record<string, unknown>,
      sync = readSync(row[SYNC]);
    if (sync.pending?.commitId !== commitId) return value;
    return { ...row, [SYNC]: { ...sync, pending: null, dirty: true } };
  });
}

export function downloadFile(
  name: string,
  content: string,
  type = 'application/json',
) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
