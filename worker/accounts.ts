import {
  normalizePinIdentity,
  IdentityValidationError,
} from '../src/lib/identity';
import { parseBackup, SnapshotValidationError } from '../src/lib/backup';
import {
  ApiError,
  isLocalHttp,
  json,
  readJson,
  requireSameOrigin,
  sha256,
} from './http';

const SESSION_SECONDS = 30 * 24 * 60 * 60;
const WINDOW_MS = 15 * 60 * 1000;
const AUTH_BODY_BYTES = 4096;
const PIN_ITERATIONS = 100_000;
const PIN_SALT_BYTES = 16;
const PIN_HASH_BITS = 256;
const PIN_ATTEMPTS_PER_WINDOW = 5;
const SNAPSHOT_BODY_BYTES = 2_000_000;
// D1's maximum string/row size is 2,000,000 decimal bytes, including metadata.
export const MAX_ACCOUNT_PAYLOAD_BYTES = 1_900_000;

export interface Account {
  id: string;
  name: string;
}
interface CommitReceipt {
  request_hash: string;
  revision: number;
  updated_at: number;
}

function cookieName(request: Request): string {
  return isLocalHttp(new URL(request.url))
    ? 'gymmiie_session'
    : '__Host-gymmiie_session';
}
function cookieValue(request: Request): string | undefined {
  const name = cookieName(request);
  return request.headers
    .get('cookie')
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}
function sessionCookie(
  request: Request,
  token: string,
  maxAge = SESSION_SECONDS,
): string {
  return `${cookieName(request)}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${isLocalHttp(new URL(request.url)) ? '' : '; Secure'}`;
}
function publicAccount(row: Account): Account {
  return { id: row.id, name: row.name };
}

async function rateLimit(
  request: Request,
  env: Env,
  action: 'register' | 'login',
): Promise<void> {
  // CF overwrites this edge header. Missing headers share a conservative bucket;
  // X-Forwarded-For and client-chosen identity strings never bypass the limit.
  const ip = request.headers.get('CF-Connecting-IP') ?? 'missing-edge-ip';
  const key = `${action}:${await sha256(`gymmiie-rate-v1:${ip}`)}`;
  await limitAttempts(env, key, action === 'register' ? 5 : 20);
  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare(
      'DELETE FROM account_rate_limits WHERE key IN (SELECT key FROM account_rate_limits WHERE expires_at <= ?1 LIMIT 100)',
    ).bind(now),
    env.DB.prepare(
      'DELETE FROM account_sessions WHERE token_hash IN (SELECT token_hash FROM account_sessions WHERE expires_at <= ?1 LIMIT 100)',
    ).bind(now),
  ]);
}

export async function limitAttempts(env: Env, key: string, maximum: number, windowMs = WINDOW_MS): Promise<void> {
  const now = Date.now(),
    windowStart = Math.floor(now / windowMs) * windowMs;
  const row = await env.DB.prepare(
    `
    INSERT INTO account_rate_limits (key, window_start, attempts, expires_at)
    VALUES (?1, ?2, 1, ?3)
    ON CONFLICT(key) DO UPDATE SET
      attempts = CASE WHEN window_start = excluded.window_start THEN attempts + 1 ELSE 1 END,
      window_start = excluded.window_start, expires_at = excluded.expires_at
    RETURNING attempts
  `,
  )
    .bind(key, windowStart, windowStart + 2 * windowMs)
    .first<{ attempts: number }>();
  if (!row || row.attempts > maximum)
    throw new ApiError(
      'rate_limited',
      429,
      'Too many attempts. Try again later.',
      {
        'retry-after': String(
          Math.max(1, Math.ceil((windowStart + windowMs - now) / 1000)),
        ),
      },
    );
}

async function limitPinAttempts(env: Env, normalizedName: string): Promise<void> {
  await limitAttempts(
    env,
    `pin:${await sha256(`gymmiie-pin-rate-v1:${normalizedName}`)}`,
    PIN_ATTEMPTS_PER_WINDOW,
  );
}

function hex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function hashPin(
  env: Env,
  normalized: ReturnType<typeof normalizePinIdentity>,
  createSalt = false,
): Promise<string> {
  if (createSalt)
    await env.DB.prepare(
      'INSERT INTO account_pin_salts (normalized_name, salt) VALUES (?1, ?2) ON CONFLICT(normalized_name) DO NOTHING',
    )
      .bind(
        normalized.normalizedName,
        hex(crypto.getRandomValues(new Uint8Array(PIN_SALT_BYTES)).buffer),
      )
      .run();
  const row = await env.DB.prepare(
    'SELECT salt FROM account_pin_salts WHERE normalized_name = ?1',
  )
    .bind(normalized.normalizedName)
    .first<{ salt: string }>();
  const salt = row?.salt ?? '0'.repeat(PIN_SALT_BYTES * 2);
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(normalized.pin), 'PBKDF2', false, ['deriveBits'],
  );
  return hex(await crypto.subtle.deriveBits({
    name: 'PBKDF2',
    hash: 'SHA-256',
    salt: encoder.encode(`gymmiie-pin-v1:${normalized.normalizedName}:${salt}`),
    iterations: PIN_ITERATIONS,
  }, key, PIN_HASH_BITS));
}

async function findPinAccount(
  env: Env,
  normalizedName: string,
  pinHash: string,
): Promise<Account | null> {
  return env.DB.prepare(
    `SELECT a.id, a.name FROM account_pins p
     JOIN accounts a ON a.id = p.account_id
     WHERE p.normalized_name = ?1 AND p.pin_hash = ?2`,
  ).bind(normalizedName, pinHash).first<Account>();
}

async function issueSession(
  request: Request,
  env: Env,
  account: Account,
  status = 200,
): Promise<Response> {
  const token = [...crypto.getRandomValues(new Uint8Array(32))]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  const now = Date.now();
  const statements = [
    env.DB.prepare(
      'INSERT INTO account_sessions (token_hash, account_id, expires_at, created_at) VALUES (?1, ?2, ?3, ?4)',
    ).bind(await sha256(token), account.id, now + SESSION_SECONDS * 1000, now),
  ];
  const oldToken = cookieValue(request);
  if (oldToken && /^[a-f0-9]{64}$/.test(oldToken))
    statements.push(
      env.DB.prepare('DELETE FROM account_sessions WHERE token_hash = ?1').bind(
        await sha256(oldToken),
      ),
    );
  await env.DB.batch(statements);
  return json({ account: publicAccount(account) }, status, {
    'set-cookie': sessionCookie(request, token),
  });
}

export async function requireSession(request: Request, env: Env): Promise<Account> {
  const token = cookieValue(request);
  if (!token || !/^[a-f0-9]{64}$/.test(token))
    throw new ApiError(
      'session_required',
      401,
      'Sign in to access this account.',
    );
  const account = await env.DB.prepare(
    `SELECT a.id, a.name FROM account_sessions s
    JOIN accounts a ON a.id = s.account_id WHERE s.token_hash = ?1 AND s.expires_at > ?2`,
  )
    .bind(await sha256(token), Date.now())
    .first<Account>();
  if (!account)
    throw new ApiError(
      'session_required',
      401,
      'Your session expired. Sign in again.',
    );
  return account;
}

function pinIdentity(body: Record<string, unknown>) {
  try {
    return normalizePinIdentity({ name: body.name, pin: body.pin });
  } catch (error) {
    if (error instanceof IdentityValidationError)
      throw new ApiError('invalid_identity', 400, error.message);
    throw error;
  }
}

async function register(request: Request, env: Env): Promise<Response> {
  await rateLimit(request, env, 'register');
  const body = await readJson(request, AUTH_BODY_BYTES);
  const normalized = pinIdentity(body);
  if (
    typeof env.REGISTRATION_PASSPHRASE !== 'string' ||
    !env.REGISTRATION_PASSPHRASE.length
  )
    throw new ApiError(
      'registration_unavailable',
      503,
      'New account registration is not configured.',
    );
  if (typeof body.passphrase !== 'string' || !body.passphrase.length)
    throw new ApiError(
      'registration_forbidden',
      403,
      'The registration passphrase is incorrect.',
    );
  const encoder = new TextEncoder();
  const [expected, received] = await Promise.all([
    crypto.subtle.digest(
      'SHA-256',
      encoder.encode(env.REGISTRATION_PASSPHRASE),
    ),
    crypto.subtle.digest('SHA-256', encoder.encode(body.passphrase)),
  ]);
  if (!crypto.subtle.timingSafeEqual(expected, received))
    throw new ApiError(
      'registration_forbidden',
      403,
      'The registration passphrase is incorrect.',
    );
  await limitPinAttempts(env, normalized.normalizedName);
  const pinHash = await hashPin(env, normalized, true);
  if (await findPinAccount(env, normalized.normalizedName, pinHash))
    throw new ApiError(
      'account_exists',
      409,
      'This account already exists. Sign in with its name and PIN.',
    );
  const id = crypto.randomUUID();
  // One transaction: concurrent creates cannot replace another account or reset data.
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO accounts (id, name, normalized_name, telephone, created_at)
       SELECT ?1, ?2, ?3, ?4, ?5 WHERE NOT EXISTS (
         SELECT 1 FROM account_pins WHERE normalized_name = ?3 AND pin_hash = ?6
       )`,
    ).bind(
      id,
      normalized.name,
      normalized.normalizedName,
      `pin:${id}`,
      Date.now(),
      pinHash,
    ),
    env.DB.prepare(
      `INSERT INTO account_pins (account_id, normalized_name, pin_hash)
       SELECT id, normalized_name, ?2 FROM accounts WHERE id = ?1`,
    ).bind(id, pinHash),
    env.DB.prepare(
      'INSERT INTO account_snapshots (account_id) SELECT id FROM accounts WHERE id = ?1',
    ).bind(id),
  ]);
  const account = await findPinAccount(
    env,
    normalized.normalizedName,
    pinHash,
  );
  if (!account || account.id !== id)
    throw new ApiError(
      'account_exists',
      409,
      'This account already exists. Sign in with its name and PIN.',
    );
  return issueSession(request, env, account, 201);
}

async function session(request: Request, env: Env): Promise<Response> {
  if (request.method === 'POST') {
    await rateLimit(request, env, 'login');
    const normalized = pinIdentity(await readJson(request, AUTH_BODY_BYTES));
    await limitPinAttempts(env, normalized.normalizedName);
    const account = await findPinAccount(
      env,
      normalized.normalizedName,
      await hashPin(env, normalized),
    );
    if (!account)
      throw new ApiError(
        'account_not_found',
        404,
        'No account matches this name and PIN.',
      );
    return issueSession(request, env, account);
  }
  const account = await requireSession(request, env);
  if (request.method === 'GET') return json({ account });
  if (request.method === 'DELETE') {
    if (request.headers.get('X-Gymmiie-Account') !== account.id)
      throw new ApiError(
        'account_mismatch',
        403,
        'The signed-in account changed.',
      );
    await env.DB.prepare('DELETE FROM account_sessions WHERE token_hash = ?1')
      .bind(await sha256(cookieValue(request)!))
      .run();
    return json(null, 204, { 'set-cookie': sessionCookie(request, '', 0) });
  }
  throw new ApiError('method_not_allowed', 405, 'Method not allowed.');
}

function receiptResponse(
  receipt: CommitReceipt,
  commitId: string,
  requestHash: string,
): Response {
  if (receipt.request_hash !== requestHash)
    throw new ApiError(
      'commit_mismatch',
      409,
      'This commit id was already used for a different snapshot.',
    );
  return json({
    revision: receipt.revision,
    updatedAt: receipt.updated_at,
    commitId,
  });
}

async function accountData(
  request: Request,
  env: Env,
  accountId: string,
): Promise<Response> {
  const account = await requireSession(request, env);
  if (account.id !== accountId)
    throw new ApiError(
      'account_mismatch',
      403,
      'The signed-in account changed.',
    );
  if (request.method === 'GET') {
    const row = await env.DB.prepare(
      'SELECT payload, revision, updated_at FROM account_snapshots WHERE account_id = ?1',
    )
      .bind(account.id)
      .first<{
        payload: string | null;
        revision: number;
        updated_at: number | null;
      }>();
    if (!row)
      throw new ApiError(
        'storage_unavailable',
        503,
        'Account storage is unavailable.',
      );
    return json({
      data: row.payload === null ? null : parseBackup(JSON.parse(row.payload)),
      revision: row.revision,
      updatedAt: row.updated_at,
    });
  }
  if (request.method !== 'PUT')
    throw new ApiError('method_not_allowed', 405, 'Method not allowed.');
  const body = await readJson(request, SNAPSHOT_BODY_BYTES);
  if (
    !Number.isSafeInteger(body.expectedRevision) ||
    (body.expectedRevision as number) < 0 ||
    typeof body.commitId !== 'string' ||
    !/^[A-Za-z0-9_-]{16,100}$/.test(body.commitId)
  )
    throw new ApiError(
      'invalid_request',
      400,
      'Supply a nonnegative expectedRevision and a unique 16–100 character commitId.',
    );
  let payload: string;
  try {
    payload = JSON.stringify(parseBackup(body.data));
  } catch (error) {
    if (error instanceof SnapshotValidationError)
      throw new ApiError('invalid_snapshot', 400, error.message);
    throw error;
  }
  if (new TextEncoder().encode(payload).byteLength > MAX_ACCOUNT_PAYLOAD_BYTES)
    throw new ApiError(
      'payload_too_large',
      413,
      'This account snapshot exceeds 1,900,000 bytes. Keep a local export.',
    );
  const commitId = body.commitId,
    expectedRevision = body.expectedRevision as number;
  const requestHash = await sha256(`${expectedRevision}:${payload}`);
  const readReceipt = () =>
    env.DB.prepare(
      'SELECT request_hash, revision, updated_at FROM account_commits WHERE account_id = ?1 AND commit_id = ?2',
    )
      .bind(account.id, commitId)
      .first<CommitReceipt>();
  const existing = await readReceipt();
  if (existing) return receiptResponse(existing, commitId, requestHash);
  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare(
      `UPDATE account_snapshots SET payload = ?1, revision = revision + 1, updated_at = ?2, last_commit_id = ?3
      WHERE account_id = ?4 AND revision = ?5 AND NOT EXISTS
      (SELECT 1 FROM account_commits WHERE account_id = ?4 AND commit_id = ?3)`,
    ).bind(payload, now, commitId, account.id, expectedRevision),
    env.DB.prepare(
      `INSERT INTO account_commits (account_id, commit_id, request_hash, revision, updated_at)
      SELECT account_id, ?1, ?2, revision, updated_at FROM account_snapshots
      WHERE account_id = ?3 AND revision = ?4 AND last_commit_id = ?1
      ON CONFLICT(account_id, commit_id) DO NOTHING`,
    ).bind(commitId, requestHash, account.id, expectedRevision + 1),
  ]);
  const receipt = await readReceipt();
  if (!receipt)
    throw new ApiError(
      'revision_conflict',
      409,
      'A newer snapshot exists. Reload before saving again.',
    );
  return receiptResponse(receipt, commitId, requestHash);
}

/** Returns null for legacy/static routes, which retain their existing contract. */
export async function handleAccounts(
  request: Request,
  env: Env,
): Promise<Response | null> {
  const path = new URL(request.url).pathname;
  const match = /^\/api\/accounts\/([^/]+)\/data$/.exec(path);
  if (path !== '/api/accounts/register' && path !== '/api/session' && !match)
    return null;
  requireSameOrigin(request);
  if (path === '/api/accounts/register') {
    if (request.method !== 'POST')
      throw new ApiError('method_not_allowed', 405, 'Method not allowed.');
    return register(request, env);
  }
  if (path === '/api/session') return session(request, env);
  return accountData(request, env, match![1]);
}
