import { describe, expect, it } from 'vitest';
import { ApiError, readJson } from './http';

describe('bounded request decoding', () => {
  it('stops reading a chunked body at the byte limit with no Content-Length', async () => {
    let pulls = 0;
    const body = new ReadableStream({
      pull(controller) {
        pulls++;
        controller.enqueue(new Uint8Array(64_000).fill(32));
        if (pulls === 100) controller.close();
      },
    });
    const request = new Request('https://gymmiie.test', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
      duplex: 'half',
    } as RequestInit);
    await expect(readJson(request, 2_000_000)).rejects.toMatchObject({
      code: 'payload_too_large',
      status: 413,
    });
    expect(pulls).toBeLessThan(35);
  });

  it('rejects an oversized declared length before reading, and never trusts a smaller declared length', async () => {
    const make = (length: string) =>
      new Request('https://gymmiie.test', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'content-length': length,
        },
        body: '{"p":"' + 'x'.repeat(50) + '"}',
      });
    await expect(readJson(make('1000'), 20)).rejects.toBeInstanceOf(ApiError);
    await expect(readJson(make('1'), 20)).rejects.toMatchObject({
      code: 'payload_too_large',
      status: 413,
    });
  });

  it('requires valid object JSON and the JSON content type', async () => {
    const request = (body: string, type = 'application/json') =>
      new Request('https://gymmiie.test', {
        method: 'POST',
        headers: { 'content-type': type },
        body,
      });
    for (const body of ['null', '[]', '{invalid'])
      await expect(readJson(request(body), 100)).rejects.toMatchObject({
        code: 'invalid_request',
        status: 400,
      });
    await expect(
      readJson(request('{}', 'text/plain'), 100),
    ).rejects.toMatchObject({ status: 415 });
    await expect(readJson(request('{"ok":true}'), 100)).resolves.toEqual({
      ok: true,
    });
  });
});
