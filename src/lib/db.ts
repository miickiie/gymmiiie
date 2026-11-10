import { get, set, del } from 'idb-keyval';
import type { AppData } from '../types';

const KEY = 'gymmiie:data:v1';

export async function loadPersisted(): Promise<AppData | null> {
  try {
    const data = await get<AppData>(KEY);
    return data ?? null;
  } catch {
    return null;
  }
}

export async function savePersisted(data: AppData): Promise<void> {
  try {
    await set(KEY, JSON.parse(JSON.stringify(data)));
  } catch (err) {
    console.error('Failed to persist data', err);
  }
}

export async function clearPersisted(): Promise<void> {
  await del(KEY);
}

export function downloadFile(name: string, content: string, type = 'application/json') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
