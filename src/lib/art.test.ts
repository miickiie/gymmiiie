import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../data/art.json', () => ({
  default: {
    'test-motion': { n: 2, src: 'test', url: 'https://example.com/motion' },
  },
}));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});
describe('exercise art request caching', () => {
  it('retries a transient failure on the next request', async () => {
    const fetch = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue(new Response('', { status: 404 }));
    vi.stubGlobal('fetch', fetch);
    const { loadMotion } = await import('./art');
    expect(await loadMotion('test-motion')).toBeNull();
    expect(await loadMotion('test-motion')).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it('coalesces concurrent requests without retaining a failed response', async () => {
    let resolve!: (response: Response) => void;
    const fetch = vi.fn().mockImplementation(
      () =>
        new Promise<Response>((done) => {
          resolve = done;
        }),
    );
    vi.stubGlobal('fetch', fetch);
    const { loadMotion } = await import('./art');
    const first = loadMotion('test-motion');
    expect(loadMotion('test-motion')).toBe(first);
    resolve(new Response('', { status: 404 }));
    expect(await first).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(1);
    const retry = loadMotion('test-motion');
    expect(fetch).toHaveBeenCalledTimes(2);
    resolve(new Response('', { status: 404 }));
    await retry;
  });
});
