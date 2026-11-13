import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createWorkerTestRuntime } from '../scripts/worker-test-runtime.mjs';
import { createAiWorkoutRequest } from '../src/lib/ai-workout';
import { defaultData } from '../src/lib/defaults';
import { EXERCISES } from '../src/lib/exercises';

const origin = 'https://gymmiie.test';
const context = createAiWorkoutRequest({ data: defaultData(), exercises: EXERCISES, muscles: ['chest'], mode: 'suggest', accountId: 'placeholder' });
const reply = {
  choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ items: context.baselineIds.map(exerciseId => ({ exerciseId, reason: 'Matches the selected muscles.' })) }) } }],
  usage: { prompt_tokens: 100, completion_tokens: 80 },
};
let runtime: Awaited<ReturnType<typeof createWorkerTestRuntime>>;
let serial = 0;

async function register(target = runtime) {
  const response = await target.mf.dispatchFetch(`${origin}/api/accounts/register`, {
    method: 'POST', headers: { origin, 'content-type': 'application/json', 'CF-Connecting-IP': `198.18.10.${++serial}` },
    body: JSON.stringify({ name: `AI Test ${serial}`, pin: '0123', passphrase: 'test-invite' }),
  });
  expect(response.status).toBe(201);
  const { account } = await response.json();
  return { account, cookie: response.headers.get('set-cookie')!.split(';')[0] };
}

function generate(accountId: string, cookie?: string, options: { target?: typeof runtime; body?: unknown; requestOrigin?: string } = {}) {
  return (options.target ?? runtime).mf.dispatchFetch(`${origin}/api/ai/workout-plan`, {
    method: 'POST', headers: { origin: options.requestOrigin ?? origin, 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: typeof options.body === 'string' ? options.body : JSON.stringify(options.body ?? { ...context, expectedAccountId: accountId }),
  });
}

beforeAll(async () => { runtime = await createWorkerTestRuntime({ aiEnabled: true, aiResponse: reply }); }, 30_000);
afterAll(async () => { await runtime?.dispose(); });
beforeEach(async () => {
  await runtime.db.batch(['account_sessions', 'account_commits', 'account_snapshots', 'account_pins', 'accounts', 'account_pin_salts', 'account_rate_limits'].map(table => runtime.db.prepare(`DELETE FROM ${table}`)));
});

describe('authenticated workout planning in workerd with real D1', () => {
  it('returns validated suggestions with no stored routine or profile snapshot', async () => {
    const { account, cookie } = await register();
    const before = await runtime.db.prepare('SELECT * FROM account_snapshots ORDER BY account_id').all();
    const response = await generate(account.id, cookie);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.mode).toBe('suggest');
    expect(body.items.map(item => item.exerciseId)).toEqual(context.baselineIds);
    expect(typeof body.requestId).toBe('string');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect((await runtime.db.prepare('SELECT * FROM account_snapshots ORDER BY account_id').all()).results).toEqual(before.results);
  });

  it('rejects unsigned, cross-origin, expired-session, and mismatched-account requests', async () => {
    const { account, cookie } = await register();
    expect((await generate(account.id)).status).toBe(401);
    expect((await generate(account.id, cookie, { requestOrigin: 'https://other.test' })).status).toBe(403);
    expect((await generate('another-account', cookie)).status).toBe(409);
    await runtime.db.prepare('UPDATE account_sessions SET expires_at = 0').run();
    expect((await generate(account.id, cookie)).status).toBe(401);
  });

  it('returns a validated routine with sets/rest and never persists the draft', async () => {
    const plan = { name: 'Chest day', items: [{ exerciseId: context.candidates[0].id, reason: 'A familiar primary movement.', sets: 4, restSeconds: 120 }] };
    const target = await createWorkerTestRuntime({ aiEnabled: true, aiResponse: { choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(plan) } }] } });
    try {
      const { account, cookie } = await register(target);
      const before = await target.db.prepare('SELECT * FROM account_snapshots ORDER BY account_id').all();
      const result = await generate(account.id, cookie, { target, body: { ...context, mode: 'routine', expectedAccountId: account.id } });
      expect(result.status).toBe(200);
      expect(await result.json()).toMatchObject({ mode: 'routine', ...plan });
      expect((await target.db.prepare('SELECT * FROM account_snapshots ORDER BY account_id').all()).results).toEqual(before.results);
    } finally { await target.dispose(); }
  });

  it('validates context and body size before consuming inference attempts', async () => {
    const { account, cookie } = await register();
    expect((await generate(account.id, cookie, { body: { ...context, selectedMuscles: ['invented'] } })).status).toBe(400);
    expect((await generate(account.id, cookie, { body: JSON.stringify({ padding: 'x'.repeat(65 * 1024) }) })).status).toBe(413);
    expect((await runtime.db.prepare("SELECT COUNT(*) AS n FROM account_rate_limits WHERE key LIKE 'ai-%'").first()).n).toBe(0);
  });

  it('enforces five concurrent minute attempts and twenty daily attempts across modes', async () => {
    const { account, cookie } = await register();
    const responses = await Promise.all(Array.from({ length: 7 }, () => generate(account.id, cookie)));
    expect(responses.filter(response => response.status === 200)).toHaveLength(5);
    expect(responses.filter(response => response.status === 429)).toHaveLength(2);
    expect(Number(responses.find(response => response.status === 429)!.headers.get('retry-after'))).toBeGreaterThan(0);
    await runtime.db.prepare('DELETE FROM account_rate_limits WHERE key = ?1').bind(`ai-minute:${account.id}`).run();
    await runtime.db.prepare('UPDATE account_rate_limits SET attempts = 20 WHERE key = ?1').bind(`ai-day:${account.id}`).run();
    const response = await generate(account.id, cookie, { body: { ...context, mode: 'routine', expectedAccountId: account.id } });
    expect(response.status).toBe(429);
    expect((await response.json()).error.code).toBe('AI_LIMIT');
    await runtime.db.prepare('UPDATE account_rate_limits SET window_start = 0 WHERE key = ?1').bind(`ai-day:${account.id}`).run();
    expect((await generate(account.id, cookie)).status).toBe(200);
  });

  it.each([
    [{ aiEnabled: false }, 503, 'AI_DISABLED'],
    [{ aiEnabled: true, aiResponse: { choices: [{ finish_reason: 'stop' }] } }, 502, 'AI_INVALID_RESPONSE'],
    [{ aiEnabled: true, aiResponse: { choices: [{ finish_reason: 'length', message: { content: '{}' } }] } }, 502, 'AI_INVALID_RESPONSE'],
    [{ aiEnabled: true, aiError: '3036 Account limited' }, 429, 'AI_QUOTA'],
    [{ aiEnabled: true, aiError: '3040 Out of capacity' }, 503, 'AI_BUSY'],
    [{ aiEnabled: true, aiError: '3007 timeout' }, 504, 'AI_TIMEOUT'],
  ])('normalizes disabled/provider failures (%s)', async (options, status, code) => {
    const target = await createWorkerTestRuntime(options);
    try {
      const { account, cookie } = await register(target);
      const response = await generate(account.id, cookie, { target });
      expect(response.status).toBe(status);
      expect((await response.json()).error.code).toBe(code);
    } finally { await target.dispose(); }
  });
});
