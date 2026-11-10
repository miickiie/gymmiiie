import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

function worker() {
  const handlers = new Map<string, (event: unknown) => void>();
  const cache = {
    addAll: vi.fn().mockResolvedValue(undefined),
    match: vi.fn().mockResolvedValue(undefined),
    put: vi.fn().mockResolvedValue(undefined),
  };
  const caches = {
    open: vi.fn().mockResolvedValue(cache),
    keys: vi.fn().mockResolvedValue(['gymmiie-old', 'another-app']),
    delete: vi.fn().mockResolvedValue(true),
  };
  const fetch = vi.fn().mockResolvedValue(
    new Response('new shell', {
      headers: { 'content-type': 'text/html' },
    }),
  );
  const claim = vi.fn().mockResolvedValue(undefined);
  const skipWaiting = vi.fn();
  const source = readFileSync(
    new URL('../public/sw.js', import.meta.url),
    'utf8',
  ).replace(
    '/* __GYMMIIE_PRECACHE__ */ null',
    JSON.stringify({
      version: 'test',
      urls: ['/', '/assets/route-lazy.js', '/assets/food-data.js'],
    }),
  );
  runInNewContext(source, {
    self: {
      addEventListener: (name: string, callback: (event: unknown) => void) =>
        handlers.set(name, callback),
      location: { origin: 'https://gym.test' },
      clients: { claim },
      skipWaiting,
    },
    caches,
    fetch,
    URL,
    Response,
  });
  async function lifecycle(name: string): Promise<void> {
    let completion: Promise<unknown> = Promise.resolve();
    handlers.get(name)?.({
      waitUntil: (promise: Promise<unknown>) => {
        completion = promise;
      },
    });
    await completion;
  }
  async function request(
    path: string,
    mode = 'navigate',
  ): Promise<Response | undefined> {
    let response: Promise<Response> | undefined;
    handlers.get('fetch')?.({
      request: { method: 'GET', url: `https://gym.test${path}`, mode },
      respondWith: (promise: Promise<Response>) => {
        response = promise;
      },
    });
    return response;
  }
  return { cache, caches, fetch, claim, skipWaiting, lifecycle, request };
}

describe('offline shell lifecycle', () => {
  it('precaches lazy routes/data and waits for existing clients', async () => {
    const sw = worker();
    await sw.lifecycle('install');
    expect(sw.cache.addAll).toHaveBeenCalledWith([
      '/',
      '/assets/route-lazy.js',
      '/assets/food-data.js',
    ]);
    expect(sw.skipWaiting).not.toHaveBeenCalled();
  });

  it('discards a failed new installation without deleting the working cache', async () => {
    const sw = worker();
    sw.cache.addAll.mockRejectedValueOnce(new Error('missing chunk'));
    await expect(sw.lifecycle('install')).rejects.toThrow('missing chunk');
    expect(sw.caches.delete).toHaveBeenCalledExactlyOnceWith('gymmiie-test');
  });

  it('only cleans Gymmiie caches during activation', async () => {
    const sw = worker();
    await sw.lifecycle('activate');
    expect(sw.caches.delete).toHaveBeenCalledExactlyOnceWith('gymmiie-old');
    expect(sw.claim).toHaveBeenCalledOnce();
  });

  it('does not overwrite the offline shell with an unsuccessful response', async () => {
    const sw = worker();
    sw.fetch.mockResolvedValueOnce(
      new Response('unavailable', { status: 503 }),
    );
    expect((await sw.request('/history'))?.status).toBe(503);
    expect(sw.cache.put).not.toHaveBeenCalled();
  });

  it('serves a cached shell when offline and leaves private API requests alone', async () => {
    const sw = worker();
    sw.fetch.mockRejectedValueOnce(new Error('offline'));
    sw.cache.match.mockResolvedValueOnce(new Response('working shell'));
    expect(await (await sw.request('/progress'))?.text()).toBe('working shell');
    expect(await sw.request('/api/sync/private')).toBeUndefined();
  });

  it('pins navigation to the active build while a new worker waits', async () => {
    const sw = worker();
    sw.cache.match.mockResolvedValueOnce(new Response('active build shell'));
    expect(await (await sw.request('/train'))?.text()).toBe(
      'active build shell',
    );
    expect(sw.fetch).not.toHaveBeenCalled();
  });

  it('matches precached build chunks despite host Vary: Origin headers', async () => {
    const sw = worker();
    sw.cache.match.mockResolvedValueOnce(new Response('cached chunk'));
    expect(
      await (await sw.request('/assets/route-lazy.js', 'cors'))?.text(),
    ).toBe('cached chunk');
    expect(sw.cache.match).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'https://gym.test/assets/route-lazy.js' }),
      { ignoreVary: true },
    );
    expect(sw.fetch).not.toHaveBeenCalled();
  });
});
