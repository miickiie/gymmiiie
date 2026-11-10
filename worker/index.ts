/**
 * Gymmiie edge API.
 *
 * The Worker serves the built SPA from Cloudflare static assets and exposes a
 * tiny, deliberately dumb encrypted-snapshot store backed by D1.
 *
 * The client encrypts the snapshot with AES-GCM before it ever reaches us, so
 * these endpoints only ever see an opaque base64 blob plus a hash-derived id.
 * There are no accounts, cookies, emails, or readable workout data here.
 */

export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
}

const MAX_PAYLOAD_BYTES = 8 * 1024 * 1024; // 8 MB of ciphertext
const ID_RE = /^[a-f0-9]{64}$/;
const SYNC_PREFIX = '/api/sync/';

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    },
  });

const error = (message: string, status: number): Response => json({ error: message }, status);

function validateId(id: string | undefined): id is string {
  return typeof id === 'string' && ID_RE.test(id);
}

async function handleSync(request: Request, env: Env, id: string | undefined): Promise<Response> {
  if (!validateId(id)) return error('Invalid sync id', 400);

  if (request.method === 'GET') {
    const row = await env.DB.prepare(
      'SELECT payload, updated_at, bytes FROM sync_snapshots WHERE id = ?1',
    )
      .bind(id)
      .first<{ payload: string; updated_at: string; bytes: number }>();
    if (!row) return error('Not found', 404);
    return json({ payload: row.payload, updatedAt: row.updated_at, bytes: row.bytes });
  }

  if (request.method === 'PUT') {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return error('Expected a JSON body', 400);
    }
    const payload = (body as { payload?: unknown } | null)?.payload;
    if (typeof payload !== 'string' || !payload.length) return error('Missing payload', 400);
    if (payload.length > MAX_PAYLOAD_BYTES) return error('Snapshot too large (max 8 MB)', 413);
    // Base64 only. Reject anything that isn't the opaque ciphertext envelope.
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(payload)) return error('Payload must be base64', 400);

    const updatedAt = new Date().toISOString();
    const bytes = payload.length;
    await env.DB.prepare(
      `INSERT INTO sync_snapshots (id, payload, updated_at, bytes)
       VALUES (?1, ?2, ?3, ?4)
       ON CONFLICT(id) DO UPDATE SET
         payload = excluded.payload,
         updated_at = excluded.updated_at,
         bytes = excluded.bytes`,
    )
      .bind(id, payload, updatedAt, bytes)
      .run();

    return json({ updatedAt, bytes });
  }

  if (request.method === 'DELETE') {
    await env.DB.prepare('DELETE FROM sync_snapshots WHERE id = ?1').bind(id).run();
    return new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });
  }

  return error('Method not allowed', 405);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/api/health') {
      return json({ ok: true, service: 'gymmiie-sync' });
    }

    if (url.pathname.startsWith(SYNC_PREFIX)) {
      const id = url.pathname.slice(SYNC_PREFIX.length);
      if (id.includes('/')) return error('Invalid sync id', 400);
      return handleSync(request, env, id);
    }

    if (url.pathname.startsWith('/api/')) {
      return error('Not found', 404);
    }

    // Everything else is the SPA, served from the assets binding. Unknown
    // client-side routes fall back to index.html via not_found_handling.
    return env.ASSETS.fetch(request);
  },
};
