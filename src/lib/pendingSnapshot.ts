import type { AppData } from '../types';
import { parseBackup } from './backup';

const KEY = 'gymmiie:pending:v1';
const keyFor = (accountId?: string) =>
  accountId ? `${KEY}:account:${accountId}` : KEY;
export interface PendingSnapshot {
  version: 1;
  data: AppData;
  baseRevision: number;
  inFlightToken?: string;
}

/** Session storage survives reloads and is isolated from other tabs. */
export function readPendingSnapshot(accountId?: string): unknown {
  if (typeof sessionStorage === 'undefined') return undefined;
  let raw: string | null;
  try {
    raw = sessionStorage.getItem(keyFor(accountId));
  } catch {
    throw new Error(
      'This tab’s unsaved recovery copy could not be read. Retry storage before editing your log.',
    );
  }
  if (raw === null) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return { unreadablePendingSnapshot: raw };
  }
}

export function parsePendingSnapshot(value: unknown): PendingSnapshot | null {
  if (value === undefined) return null;
  const row = value as Partial<PendingSnapshot> | null;
  if (
    !row ||
    row.version !== 1 ||
    !Number.isSafeInteger(row.baseRevision) ||
    row.baseRevision! < 0 ||
    (row.inFlightToken !== undefined && typeof row.inFlightToken !== 'string')
  ) {
    throw new Error(
      'The unsaved recovery copy could not be opened. Export it before loading a different log.',
    );
  }
  return {
    version: 1,
    baseRevision: row.baseRevision!,
    inFlightToken: row.inFlightToken,
    data: parseBackup(row.data),
  };
}

export function writePendingSnapshot(
  value: PendingSnapshot,
  accountId?: string,
): boolean {
  try {
    sessionStorage.setItem(keyFor(accountId), JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function clearPendingSnapshot(accountId?: string): void {
  try {
    sessionStorage.removeItem(keyFor(accountId));
  } catch {
    /* A stale copy is compared with durable data on the next load. */
  }
}
