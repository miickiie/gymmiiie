export class ApiError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string,
    public readonly headers?: HeadersInit,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function json(
  body: unknown,
  status = 200,
  extra?: HeadersInit,
): Response {
  const headers = new Headers(extra);
  headers.set('content-type', 'application/json; charset=utf-8');
  headers.set('cache-control', 'no-store');
  headers.set('x-content-type-options', 'nosniff');
  headers.set('referrer-policy', 'no-referrer');
  headers.set('cross-origin-resource-policy', 'same-origin');
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers,
  });
}

export function isLocalHttp(url: URL): boolean {
  return (
    url.protocol === 'http:' &&
    ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  );
}

export function requireSameOrigin(request: Request): void {
  const url = new URL(request.url);
  if (url.protocol !== 'https:' && !isLocalHttp(url))
    throw new ApiError(
      'secure_transport_required',
      400,
      'Use HTTPS for account access.',
    );
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    if (request.headers.get('origin') !== url.origin)
      throw new ApiError(
        'origin_mismatch',
        403,
        'Account changes require the same origin.',
      );
  } else {
    const origin = request.headers.get('origin');
    if (origin && origin !== url.origin)
      throw new ApiError(
        'origin_mismatch',
        403,
        'Account access requires the same origin.',
      );
  }
}

/** The limit is enforced while reading, including absent or dishonest Content-Length. */
export async function readJson(
  request: Request,
  limit: number,
): Promise<Record<string, unknown>> {
  if (
    !/^application\/json(?:\s*;|$)/i.test(
      request.headers.get('content-type') ?? '',
    )
  )
    throw new ApiError(
      'invalid_request',
      415,
      'Send an application/json body.',
    );
  const declaredLength = request.headers.get('content-length');
  if (declaredLength && Number(declaredLength) > limit)
    throw new ApiError(
      'payload_too_large',
      413,
      'This request is too large.',
    );
  const reader = request.body?.getReader();
  if (!reader)
    throw new ApiError('invalid_request', 400, 'Expected a JSON body.');
  let length = 0;
  // One bounded allocation also avoids retaining millions of tiny chunk objects.
  const bytes = new Uint8Array(limit);
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (length + value.byteLength > limit) {
        // Release the reader below instead of awaiting cancellation: workerd can
        // send the 413 while the HTTP client is still writing its request body.
        throw new ApiError(
          'payload_too_large',
          413,
          'This request is too large.',
        );
      }
      bytes.set(value, length);
      length += value.byteLength;
    }
  } finally {
    reader.releaseLock();
  }
  let body: unknown;
  try {
    body = JSON.parse(
      new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(
        bytes.subarray(0, length),
      ),
    );
  } catch {
    throw new ApiError('invalid_request', 400, 'Expected valid JSON.');
  }
  if (!body || typeof body !== 'object' || Array.isArray(body))
    throw new ApiError('invalid_request', 400, 'Expected a JSON object.');
  return body as Record<string, unknown>;
}

export async function sha256(value: string): Promise<string> {
  return [
    ...new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)),
    ),
  ]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}
