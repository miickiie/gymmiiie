const enc = new TextEncoder();
const dec = new TextDecoder();

function bufToB64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

function b64ToBuf(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(input));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function deriveKey(code: string): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey('raw', enc.encode(code), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: enc.encode('gymmiie-sync-v1'), iterations: 210000, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptSnapshot(code: string, data: unknown): Promise<string> {
  const key = await deriveKey(code);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(data)));
  const combined = new Uint8Array(iv.length + cipher.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(cipher), iv.length);
  return bufToB64(combined.buffer);
}

export async function decryptSnapshot(code: string, payload: string): Promise<unknown> {
  const key = await deriveKey(code);
  const raw = new Uint8Array(b64ToBuf(payload));
  const iv = raw.slice(0, 12);
  const cipher = raw.slice(12);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher);
  return JSON.parse(dec.decode(plain));
}

export function syncIdFrom(code: string): Promise<string> {
  return sha256Hex(`gymmiie-id:${code.trim().toLowerCase()}`);
}

export interface SyncInfo {
  updatedAt: string;
  bytes: number;
}

export async function uploadSync(code: string, data: unknown): Promise<SyncInfo> {
  const payload = await encryptSnapshot(code, data);
  const id = await syncIdFrom(code);
  const res = await fetch(`/api/sync/${id}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ payload }),
  });
  if (!res.ok) throw new Error((await res.text()) || `Upload failed (${res.status})`);
  return res.json();
}

export async function downloadSync(code: string): Promise<{ data: unknown; updatedAt: string } | null> {
  const id = await syncIdFrom(code);
  const res = await fetch(`/api/sync/${id}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error((await res.text()) || `Download failed (${res.status})`);
  const json = await res.json() as { payload: string; updatedAt: string };
  const data = await decryptSnapshot(code, json.payload);
  return { data, updatedAt: json.updatedAt };
}

export async function deleteSync(code: string): Promise<void> {
  const id = await syncIdFrom(code);
  const res = await fetch(`/api/sync/${id}`, { method: 'DELETE' });
  if (!res.ok && res.status !== 404) throw new Error(`Delete failed (${res.status})`);
}
