import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { defaultData } from '../src/lib/defaults';
import { createWorkerTestRuntime } from '../scripts/worker-test-runtime.mjs';

const origin = 'https://gymmiie.test';
const identity = { name: 'Mickey Test', telephone: '+66812345678' };
let runtime: Awaited<ReturnType<typeof createWorkerTestRuntime>>;
let sequence = 0;

beforeAll(async () => {
  runtime = await createWorkerTestRuntime();
}, 30_000);
afterAll(async () => {
  await runtime?.dispose();
});
beforeEach(async () => {
  await runtime.db.batch(
    [
      'account_sessions',
      'account_commits',
      'account_snapshots',
      'accounts',
      'account_rate_limits',
      'sync_snapshots',
    ].map((table) => runtime.db.prepare(`DELETE FROM ${table}`)),
  );
});

async function request(
  method: string,
  path: string,
  body?: unknown,
  options: {
    cookie?: string;
    origin?: string | null;
    ip?: string;
    headers?: Record<string, string>;
    base?: string;
  } = {},
) {
  const base = options.base ?? origin;
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'CF-Connecting-IP':
      options.ip ?? `198.18.${Math.floor(sequence / 250)}.${++sequence % 250}`,
    ...options.headers,
  };
  if (options.origin !== null) headers.origin = options.origin ?? base;
  if (options.cookie) headers.cookie = options.cookie;
  return runtime.mf.dispatchFetch(`${base}${path}`, {
    method,
    headers,
    ...(body === undefined
      ? {}
      : { body: typeof body === 'string' ? body : JSON.stringify(body) }),
  });
}

async function register(name = identity.name, telephone = identity.telephone) {
  const response = await request('POST', '/api/accounts/register', {
    name,
    telephone,
    passphrase: 'test-invite',
  });
  expect(response.status).toBe(201);
  return {
    account: (await response.json()).account,
    cookie: response.headers.get('set-cookie')!.split(';')[0],
    response,
  };
}
function snapshot(name = 'Snapshot') {
  const data = defaultData();
  data.profile.name = name;
  return data;
}

describe('native D1 account registration and sessions', () => {
  it('gates creation server-side and never persists the registration passphrase', async () => {
    const rejected = await request('POST', '/api/accounts/register', {
      ...identity,
      passphrase: 'wrong-test-value',
    });
    expect(rejected.status).toBe(403);
    expect((await rejected.json()).error.code).toBe('registration_forbidden');
    expect(
      (await runtime.db.prepare('SELECT COUNT(*) AS n FROM accounts').first())
        .n,
    ).toBe(0);
    const { account, cookie, response } = await register();
    expect(account).toMatchObject(identity);
    expect(account.id).toMatch(/^[a-f0-9-]{36}$/);
    expect(response.headers.get('set-cookie')).toMatch(
      /__Host-gymmiie_session=.*; Path=\/; HttpOnly; SameSite=Lax; Max-Age=2592000; Secure/,
    );
    expect(response.headers.get('cache-control')).toBe('no-store');
    const stored = await runtime.db
      .prepare('SELECT token_hash, expires_at FROM account_sessions')
      .first();
    expect(stored.token_hash).not.toBe(cookie.split('=')[1]);
    expect(stored.token_hash).toHaveLength(64);
    expect(stored.expires_at).toBeGreaterThan(Date.now());
    expect(
      JSON.stringify(await runtime.db.prepare('SELECT * FROM accounts').all()),
    ).not.toContain('test-invite');
  });

  it('fails closed when the runtime registration secret is absent', async () => {
    const missing = await createWorkerTestRuntime({
      registrationPassphrase: null,
    });
    try {
      const response = await missing.mf.dispatchFetch(
        `${origin}/api/accounts/register`,
        {
          method: 'POST',
          headers: { origin, 'content-type': 'application/json' },
          body: JSON.stringify({ ...identity, passphrase: 'test-invite' }),
        },
      );
      expect(response.status).toBe(503);
      expect((await response.json()).error.code).toBe(
        'registration_unavailable',
      );
    } finally {
      await missing.dispose();
    }
  });

  it('signs in using name + telephone only, with the same shared normalization', async () => {
    const { account } = await register(
      '  ＭＩＣＫＥＹ   Test ',
      '+66 (81) 234-5678',
    );
    const login = await request('POST', '/api/session', {
      name: 'mickey test',
      telephone: '+66812345678',
    });
    expect(login.status).toBe(200);
    expect((await login.json()).account).toEqual(account);
    const cookie = login.headers.get('set-cookie')!.split(';')[0];
    expect(
      (await request('GET', '/api/session', undefined, { cookie })).status,
    ).toBe(200);
    const absent = await request('POST', '/api/session', {
      ...identity,
      name: 'Other',
    });
    expect(absent.status).toBe(404);
    expect((await absent.json()).error.code).toBe('account_not_found');
    expect(
      (
        await request('POST', '/api/session', {
          name: 'Other',
          telephone: '0812345678',
        })
      ).status,
    ).toBe(400);
  });

  it('creates exactly one account during a concurrent registration race', async () => {
    const responses = await Promise.all(
      [1, 2].map(() =>
        request('POST', '/api/accounts/register', {
          ...identity,
          passphrase: 'test-invite',
        }),
      ),
    );
    expect(responses.map((response) => response.status).sort()).toEqual([
      201, 409,
    ]);
    expect(
      (await runtime.db.prepare('SELECT COUNT(*) AS n FROM accounts').first())
        .n,
    ).toBe(1);
    expect(
      (
        await runtime.db
          .prepare('SELECT COUNT(*) AS n FROM account_snapshots')
          .first()
      ).n,
    ).toBe(1);
  });

  it('distinguishes a failed database lookup from an absent identity', async () => {
    // A missing schema simulates an unavailable D1 query, rather than an absent row.
    const broken = await createWorkerTestRuntime();
    try {
      await broken.db.exec('DROP TABLE accounts');
      const response = await broken.mf.dispatchFetch(`${origin}/api/session`, {
        method: 'POST',
        headers: { origin, 'content-type': 'application/json' },
        body: JSON.stringify(identity),
      });
      expect(response.status).toBe(503);
      expect((await response.json()).error.code).toBe('storage_unavailable');
    } finally {
      await broken.dispose();
    }
  });

  it('expires sessions and only logs out the expected current account', async () => {
    const { account, cookie } = await register();
    expect(
      (
        await request('DELETE', '/api/session', undefined, {
          cookie,
          headers: { 'X-Gymmiie-Account': 'another-account' },
        })
      ).status,
    ).toBe(403);
    expect(
      (await request('GET', '/api/session', undefined, { cookie })).status,
    ).toBe(200);
    const logout = await request('DELETE', '/api/session', undefined, {
      cookie,
      headers: { 'X-Gymmiie-Account': account.id },
    });
    expect(logout.status).toBe(204);
    expect(logout.headers.get('set-cookie')).toContain('Max-Age=0');
    expect(
      (await request('GET', '/api/session', undefined, { cookie })).status,
    ).toBe(401);
    const fresh = await register('Another Person');
    await runtime.db
      .prepare('UPDATE account_sessions SET expires_at = 1')
      .run();
    expect(
      (
        await request('GET', '/api/session', undefined, {
          cookie: fresh.cookie,
        })
      ).status,
    ).toBe(401);
  });

  it('rejects cross-origin mutations, missing origins and production HTTP', async () => {
    for (const supplied of [null, 'https://attacker.test']) {
      expect(
        (await request('POST', '/api/session', identity, { origin: supplied }))
          .status,
      ).toBe(403);
    }
    expect(
      (
        await request('POST', '/api/session', identity, {
          base: 'http://gymmiie.test',
        })
      ).status,
    ).toBe(400);
    const local = await request(
      'POST',
      '/api/accounts/register',
      { ...identity, passphrase: 'test-invite' },
      { base: 'http://127.0.0.1:4173' },
    );
    expect(local.status).toBe(201);
    expect(local.headers.get('set-cookie')).toMatch(/^gymmiie_session=/);
    expect(local.headers.get('set-cookie')).not.toContain('; Secure');
    expect(
      (
        await request('GET', '/api/session', undefined, {
          cookie: local.headers.get('set-cookie')!.split(';')[0],
          base: 'http://127.0.0.1:4173',
        })
      ).status,
    ).toBe(200);
  });

  it('enforces durable hashed-IP login limits, including concurrent requests', async () => {
    const attempts = await Promise.all(
      Array.from({ length: 22 }, () =>
        request('POST', '/api/session', identity, { ip: '198.18.200.1' }),
      ),
    );
    expect(attempts.filter((response) => response.status === 404)).toHaveLength(
      20,
    );
    const limited = attempts.filter((response) => response.status === 429);
    expect(limited).toHaveLength(2);
    expect(Number(limited[0].headers.get('retry-after'))).toBeGreaterThan(0);
    const row = await runtime.db
      .prepare('SELECT key, attempts FROM account_rate_limits')
      .first();
    expect(row.key).not.toContain('198.18.200.1');
    expect(row.attempts).toBe(22);
    // This existing DB row is authoritative, rather than an isolate-local map.
    await runtime.db
      .prepare('UPDATE account_rate_limits SET attempts = 100')
      .run();
    expect(
      (await request('POST', '/api/session', identity, { ip: '198.18.200.1' }))
        .status,
    ).toBe(429);
    expect(
      (await request('POST', '/api/session', identity, { ip: '198.18.200.2' }))
        .status,
    ).toBe(404);
  });

  it('enforces a separate five-attempt registration limit', async () => {
    for (let i = 0; i < 5; i++)
      expect(
        (
          await request(
            'POST',
            '/api/accounts/register',
            { ...identity, passphrase: 'wrong' },
            { ip: '198.18.200.3' },
          )
        ).status,
      ).toBe(403);
    expect(
      (
        await request(
          'POST',
          '/api/accounts/register',
          { ...identity, passphrase: 'test-invite' },
          { ip: '198.18.200.3' },
        )
      ).status,
    ).toBe(429);
  });

  it('resets old rate windows and performs bounded expired-row cleanup', async () => {
    await request('POST', '/api/session', identity, { ip: '198.18.200.4' });
    await runtime.db
      .prepare(
        'UPDATE account_rate_limits SET attempts = 100, window_start = 1',
      )
      .run();
    expect(
      (await request('POST', '/api/session', identity, { ip: '198.18.200.4' }))
        .status,
    ).toBe(404);
    expect(
      (
        await runtime.db
          .prepare('SELECT attempts FROM account_rate_limits')
          .first()
      ).attempts,
    ).toBe(1);
    await runtime.db.batch(
      Array.from({ length: 105 }, (_, index) =>
        runtime.db
          .prepare(
            'INSERT INTO account_rate_limits (key, window_start, attempts, expires_at) VALUES (?1, 0, 1, 1)',
          )
          .bind(`expired-${index}`),
      ),
    );
    await request('POST', '/api/session', identity);
    expect(
      (
        await runtime.db
          .prepare(
            'SELECT COUNT(*) AS n FROM account_rate_limits WHERE expires_at = 1',
          )
          .first()
      ).n,
    ).toBe(5);
  });
});

describe('native D1 snapshot ownership, atomic revisions and receipts', () => {
  it('returns an empty snapshot until the first validated save and preserves separate stable identity', async () => {
    const { account, cookie } = await register();
    const path = `/api/accounts/${account.id}/data`;
    expect(
      await (await request('GET', path, undefined, { cookie })).json(),
    ).toEqual({ data: null, revision: 0, updatedAt: null });
    const data = {
      ...snapshot('Editable profile name'),
      __storageRevision: 200,
      __storageCommit: 'local-only',
    };
    const saved = await request(
      'PUT',
      path,
      { data, expectedRevision: 0, commitId: 'first-save-0000001' },
      { cookie },
    );
    expect(saved.status).toBe(200);
    expect(await saved.json()).toMatchObject({
      revision: 1,
      commitId: 'first-save-0000001',
    });
    const loaded = await (
      await request('GET', path, undefined, { cookie })
    ).json();
    expect(loaded.data.profile.name).toBe('Editable profile name');
    expect(loaded.data.__storageRevision).toBeUndefined();
    expect(loaded.data.__storageCommit).toBeUndefined();
    expect(
      (
        await (
          await request('GET', '/api/session', undefined, { cookie })
        ).json()
      ).account.name,
    ).toBe(identity.name);
  });

  it('requires the current session account on reads and writes', async () => {
    const first = await register(),
      second = await register('Other Person');
    const path = `/api/accounts/${first.account.id}/data`;
    expect((await request('GET', path)).status).toBe(401);
    expect(
      (await request('GET', path, undefined, { cookie: second.cookie })).status,
    ).toBe(403);
    expect(
      (
        await request(
          'PUT',
          path,
          {
            data: snapshot(),
            expectedRevision: 0,
            commitId: 'different-user-001',
          },
          { cookie: second.cookie },
        )
      ).status,
    ).toBe(403);
  });

  it('atomically accepts only one of two different writes from the same revision', async () => {
    const { account, cookie } = await register();
    const path = `/api/accounts/${account.id}/data`;
    const responses = await Promise.all(
      ['A', 'B'].map((name) =>
        request(
          'PUT',
          path,
          {
            data: snapshot(name),
            expectedRevision: 0,
            commitId: `concurrent-save-${name}`,
          },
          { cookie },
        ),
      ),
    );
    expect(responses.map((response) => response.status).sort()).toEqual([
      200, 409,
    ]);
    expect(
      (await (await request('GET', path, undefined, { cookie })).json())
        .revision,
    ).toBe(1);
    expect(
      (
        await runtime.db
          .prepare('SELECT COUNT(*) AS n FROM account_commits')
          .first()
      ).n,
    ).toBe(1);
  });

  it('safely replays a lost response after later snapshots without reverting data', async () => {
    const { account, cookie } = await register();
    const path = `/api/accounts/${account.id}/data`;
    const initial = {
      data: snapshot('First'),
      expectedRevision: 0,
      commitId: 'lost-response-001',
    };
    const first = await (
      await request('PUT', path, initial, { cookie })
    ).json();
    expect(
      (
        await request(
          'PUT',
          path,
          {
            data: snapshot('Latest'),
            expectedRevision: 1,
            commitId: 'later-snapshot-001',
          },
          { cookie },
        )
      ).status,
    ).toBe(200);
    expect(
      await (await request('PUT', path, initial, { cookie })).json(),
    ).toEqual(first);
    expect(
      (
        await request(
          'PUT',
          path,
          { ...initial, data: snapshot('Different') },
          { cookie },
        )
      ).status,
    ).toBe(409);
    const latest = await (
      await request('GET', path, undefined, { cookie })
    ).json();
    expect(latest.revision).toBe(2);
    expect(latest.data.profile.name).toBe('Latest');
  });

  it('makes concurrent identical commit retries idempotent', async () => {
    const { account, cookie } = await register();
    const path = `/api/accounts/${account.id}/data`;
    const body = {
      data: snapshot(),
      expectedRevision: 0,
      commitId: 'same-commit-00001',
    };
    const responses = await Promise.all(
      [1, 2].map(() => request('PUT', path, body, { cookie })),
    );
    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    expect(await responses[0].json()).toEqual(await responses[1].json());
    expect(
      (
        await runtime.db
          .prepare('SELECT revision FROM account_snapshots')
          .first()
      ).revision,
    ).toBe(1);
  });

  it('does not let a reused commit id modify a newer revision', async () => {
    const { account, cookie } = await register();
    const path = `/api/accounts/${account.id}/data`;
    const responses = await Promise.all(
      [0, 1].map((revision) =>
        request(
          'PUT',
          path,
          {
            data: snapshot(`Revision ${revision}`),
            expectedRevision: revision,
            commitId: 'racing-reused-001',
          },
          { cookie },
        ),
      ),
    );
    expect(responses.map((response) => response.status).sort()).toEqual([
      200, 409,
    ]);
    expect(
      (
        await runtime.db
          .prepare('SELECT revision FROM account_snapshots')
          .first()
      ).revision,
    ).toBe(1);
  });

  it('never resets a saved profile during a repeat registration', async () => {
    const { account, cookie } = await register();
    const path = `/api/accounts/${account.id}/data`;
    await request(
      'PUT',
      path,
      {
        data: snapshot('Keep this profile'),
        expectedRevision: 0,
        commitId: 'keep-profile-00001',
      },
      { cookie },
    );
    expect(
      (
        await request('POST', '/api/accounts/register', {
          ...identity,
          passphrase: 'test-invite',
        })
      ).status,
    ).toBe(409);
    const saved = await (
      await request('GET', path, undefined, { cookie })
    ).json();
    expect(saved.revision).toBe(1);
    expect(saved.data.profile.name).toBe('Keep this profile');
  });

  it('rejects malformed snapshots and revisions without changing stored data', async () => {
    const { account, cookie } = await register();
    const path = `/api/accounts/${account.id}/data`;
    for (const body of [
      {
        data: { sessions: 'invalid', routines: [] },
        expectedRevision: 0,
        commitId: 'bad-snapshot-00001',
      },
      {
        data: snapshot(),
        expectedRevision: -1,
        commitId: 'bad-snapshot-00002',
      },
      { data: snapshot(), expectedRevision: 0, commitId: 'tiny' },
      {
        data: { ...snapshot(), version: 2 },
        expectedRevision: 0,
        commitId: 'bad-snapshot-00003',
      },
    ])
      expect((await request('PUT', path, body, { cookie })).status).toBe(400);
    expect(
      (
        await runtime.db
          .prepare('SELECT revision FROM account_snapshots')
          .first()
      ).revision,
    ).toBe(0);
  });

  it('bounds streamed bodies without Content-Length and bounds normalized D1 UTF-8 payloads', async () => {
    const oversizedAuth = await request('POST', '/api/session', {
      ...identity,
      extra: 'x'.repeat(5000),
    });
    expect(oversizedAuth.status).toBe(413);
    const { account, cookie } = await register();
    const path = `/api/accounts/${account.id}/data`;
    const data = snapshot('é'.repeat(950_000));
    // UTF-8 crosses 1.9M while the HTTP envelope remains below the 2M body limit.
    expect(
      (
        await request(
          'PUT',
          path,
          { data, expectedRevision: 0, commitId: 'utf8-too-large-001' },
          { cookie },
        )
      ).status,
    ).toBe(413);
    expect(
      (
        await runtime.db
          .prepare('SELECT revision FROM account_snapshots')
          .first()
      ).revision,
    ).toBe(0);
  });

  it('preserves the legacy encrypted sync API and table', async () => {
    const id = 'a'.repeat(64);
    expect(
      (
        await request(
          'PUT',
          `/api/sync/${id}`,
          { payload: 'YWJjZA==' },
          { origin: null },
        )
      ).status,
    ).toBe(200);
    expect(
      (await (await request('GET', `/api/sync/${id}`)).json()).payload,
    ).toBe('YWJjZA==');
    expect(
      (await request('DELETE', `/api/sync/${id}`, undefined, { origin: null }))
        .status,
    ).toBe(204);
    expect((await request('GET', `/api/sync/${id}`)).status).toBe(404);
  });
});
