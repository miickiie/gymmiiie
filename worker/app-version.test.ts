import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createWorkerTestRuntime } from '../scripts/worker-test-runtime.mjs';

describe('production app version', () => {
  let runtime: Awaited<ReturnType<typeof createWorkerTestRuntime>>;
  let body: string;
  let contentType: string;
  let status: number;

  beforeAll(async () => {
    runtime = await createWorkerTestRuntime({
      assets: () => new Response(body, {
        status,
        headers: { 'Content-Type': contentType },
      }),
    });
  }, 30_000);

  beforeEach(() => {
    body = JSON.stringify({ version: '0123456789abcdef0123' });
    contentType = 'application/json; charset=utf-8';
    status = 200;
  });

  afterAll(async () => {
    await runtime?.dispose();
  });

  it('exposes the deployed version without authentication or caching', async () => {
    const response = await runtime.mf.dispatchFetch('https://gymmiie.test/api/app-version');
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await response.json()).toEqual({ version: '0123456789abcdef0123' });
  });

  it('rejects writes', async () => {
    const response = await runtime.mf.dispatchFetch('https://gymmiie.test/api/app-version', {
      method: 'POST',
    });
    expect(response.status).toBe(405);
    expect(response.headers.get('Allow')).toBe('GET');
  });

  it('does not mistake SPA fallback HTML for a deployed version', async () => {
    body = '<!doctype html><title>Gymmiie</title>';
    contentType = 'text/html';
    const response = await runtime.mf.dispatchFetch('https://gymmiie.test/api/app-version');
    expect(response.status).toBe(503);
  });

  it('does not advertise missing or invalid metadata', async () => {
    status = 404;
    expect((await runtime.mf.dispatchFetch('https://gymmiie.test/api/app-version')).status).toBe(503);
    status = 200;
    body = JSON.stringify({ version: '' });
    expect((await runtime.mf.dispatchFetch('https://gymmiie.test/api/app-version')).status).toBe(503);
  });
});
