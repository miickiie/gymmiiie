import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  decryptSnapshot,
  deleteSync,
  downloadSync,
  encryptSnapshot,
  syncIdFrom,
  uploadSync,
} from './cloud';
import { defaultData } from './defaults';

afterEach(() => vi.unstubAllGlobals());
const envelope = (payload: string) =>
  Response.json({
    payload,
    bytes: payload.length,
    updatedAt: '2026-01-01T00:00:00Z',
  });

describe('encrypted snapshot compatibility', () => {
  it('separates case-sensitive new slots while preserving legacy lookup', async () => {
    expect(await syncIdFrom('Example-Code')).not.toBe(
      await syncIdFrom('example-code'),
    );
    expect(await syncIdFrom('Example-Code', 'legacy')).toBe(
      await syncIdFrom('example-code', 'legacy'),
    );
    const payload = await encryptSnapshot('Example-Code', defaultData());
    expect(await decryptSnapshot('Example-Code', payload)).toEqual(
      defaultData(),
    );
    await expect(decryptSnapshot('example-code', payload)).rejects.toThrow();
  });

  it('falls back to legacy only after a missing v2 snapshot and retains its namespace', async () => {
    const code = 'Original-Case-Code';
    const payload = await encryptSnapshot(code, defaultData());
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(envelope(payload));
    vi.stubGlobal('fetch', fetcher);
    const result = await downloadSync(code);
    expect(result?.namespace).toBe('legacy');
    expect(result?.data).toEqual(defaultData());
    expect(fetcher.mock.calls.map((call) => call[0])).toEqual([
      `/api/sync/${await syncIdFrom(code)}`,
      `/api/sync/${await syncIdFrom(code, 'legacy')}`,
    ]);
  });

  it('does not conceal a v2 server error by reading a legacy copy', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 500 }));
    vi.stubGlobal('fetch', fetcher);
    await expect(downloadSync('test-code')).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('rejects successfully decrypted malformed/future snapshots', async () => {
    const payload = await encryptSnapshot('test-code', {
      ...defaultData(),
      version: 2,
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(envelope(payload)));
    await expect(downloadSync('test-code')).rejects.toThrow(
      'unsupported version',
    );
  });

  it('new uploads use only the exact-case v2 slot and valid public backup data', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        Response.json({ updatedAt: '2026-01-01T00:00:00Z', bytes: 100 }),
      );
    vi.stubGlobal('fetch', fetcher);
    const code = 'Exact-Case';
    const info = await uploadSync(code, {
      ...defaultData(),
      __storageRevision: 99,
    });
    expect(info.namespace).toBe('v2');
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe(`/api/sync/${await syncIdFrom(code)}`);
    const restored = await decryptSnapshot(code, JSON.parse(init.body).payload);
    expect(restored).toEqual(defaultData());
  });

  it('deletes only the explicitly selected namespace', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetcher);
    await deleteSync('test-code', 'legacy');
    expect(fetcher.mock.calls[0][0]).toBe(
      `/api/sync/${await syncIdFrom('test-code', 'legacy')}`,
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
