import { createServer } from 'node:http';
import { createHash, randomUUID } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { createWorkerTestRuntime } from './worker-test-runtime.mjs';

const port = 4173;
const origin = `http://127.0.0.1:${port}`;
const directory = resolve('dist');
const testInvite = 'test-invite';
const runtime = await createWorkerTestRuntime({
  registrationPassphrase: testInvite,
});
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
};

async function bodyOf(request) {
  const chunks = [];
  let length = 0;
  for await (const chunk of request) {
    length += chunk.length;
    if (length > 2_000_000)
      throw new Error('Test request exceeds the body limit.');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function testIp(request) {
  const digest = createHash('sha256')
    .update(
      String(
        request.headers['x-gymmiie-test-client'] ||
          request.socket.remoteAddress,
      ),
    )
    .digest();
  return `198.18.${digest[0]}.${digest[1]}`;
}

async function sendWorkerResponse(response, outgoing) {
  const headers = Object.fromEntries(response.headers);
  const cookies =
    response.headers.getSetCookie?.() ||
    (response.headers.get('set-cookie')
      ? [response.headers.get('set-cookie')]
      : []);
  if (cookies.length) headers['set-cookie'] = cookies;
  delete headers['transfer-encoding'];
  outgoing.writeHead(response.status, headers);
  outgoing.end(Buffer.from(await response.arrayBuffer()));
}

// These fixture routes exist only in this local test server, never in the deployed Worker.
async function seedAccount(request, outgoing) {
  const input = JSON.parse((await bodyOf(request)).toString('utf8'));
  const suffix = randomUUID().replaceAll('-', '');
  const telephone =
    input.telephone ||
    `+1202${BigInt(`0x${suffix.slice(0, 12)}`)
      .toString()
      .slice(-7)
      .padStart(7, '0')}`;
  const identity = { name: input.name || `Browser test ${suffix}`, telephone };
  const headers = {
    'content-type': 'application/json',
    Origin: origin,
    'CF-Connecting-IP': testIp(request),
  };
  const registration = await runtime.mf.dispatchFetch(
    `${origin}/api/accounts/register`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({ ...identity, passphrase: testInvite }),
    },
  );
  if (registration.status !== 201)
    throw new Error(
      `Account fixture registration returned ${registration.status}.`,
    );
  const { account } = await registration.json();
  const cookies = registration.headers.getSetCookie?.() || [
    registration.headers.get('set-cookie'),
  ];
  const cookie = cookies
    .filter(Boolean)
    .map((value) => value.split(';')[0])
    .join('; ');
  const saved = await runtime.mf.dispatchFetch(
    `${origin}/api/accounts/${account.id}/data`,
    {
      method: 'PUT',
      headers: { ...headers, Cookie: cookie },
      body: JSON.stringify({
        data: input.data,
        expectedRevision: 0,
        commitId: randomUUID(),
      }),
    },
  );
  if (!saved.ok)
    throw new Error(`Account fixture data write returned ${saved.status}.`);
  outgoing.writeHead(201, {
    'content-type': 'application/json',
    'cache-control': 'no-store',
    'set-cookie': cookies.filter(Boolean),
  });
  outgoing.end(JSON.stringify({ account, ...(await saved.json()) }));
}

const server = createServer(async (request, outgoing) => {
  try {
    const url = new URL(request.url || '/', origin);
    if (url.pathname === '/__test/seed' && request.method === 'POST') {
      await seedAccount(request, outgoing);
      return;
    }
    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
      const headers = new Headers();
      for (const [name, value] of Object.entries(request.headers)) {
        if (
          value !== undefined &&
          name !== 'host' &&
          name !== 'x-gymmiie-test-client'
        )
          headers.set(name, Array.isArray(value) ? value.join(', ') : value);
      }
      headers.set('CF-Connecting-IP', testIp(request));
      const body =
        request.method === 'GET' || request.method === 'HEAD'
          ? undefined
          : await bodyOf(request);
      await sendWorkerResponse(
        await runtime.mf.dispatchFetch(url.href, {
          method: request.method,
          headers,
          body,
        }),
        outgoing,
      );
      return;
    }
    let filename = resolve(directory, `.${decodeURIComponent(url.pathname)}`);
    if (filename !== directory && !filename.startsWith(directory + sep)) {
      outgoing.writeHead(403).end();
      return;
    }
    try {
      if (!(await stat(filename)).isFile())
        filename = resolve(directory, 'index.html');
    } catch {
      if (extname(url.pathname)) {
        outgoing.writeHead(404).end();
        return;
      }
      filename = resolve(directory, 'index.html');
    }
    const contents = await readFile(filename);
    outgoing.writeHead(200, {
      'content-type': types[extname(filename)] || 'application/octet-stream',
      'cache-control': 'no-cache',
      Vary: 'Origin',
    });
    outgoing.end(request.method === 'HEAD' ? undefined : contents);
  } catch (error) {
    console.error(
      JSON.stringify({
        message: 'Local test server request failed',
        error: error instanceof Error ? error.message : 'Unknown failure',
      }),
    );
    if (!outgoing.headersSent)
      outgoing.writeHead(500, {
        'content-type': 'application/json',
        'cache-control': 'no-store',
      });
    outgoing.end(JSON.stringify({ error: 'test_server_failure' }));
  }
});

await new Promise((done, reject) => {
  server.once('error', reject);
  server.listen(port, '127.0.0.1', done);
});
console.log(`Production UI and native Worker/D1 test server: ${origin}`);
let closing = false;
async function close() {
  if (closing) return;
  closing = true;
  server.closeAllConnections();
  server.close();
  await runtime.dispose();
}
process.once('SIGTERM', () => {
  void close().then(() => process.exit(0));
});
process.once('SIGINT', () => {
  void close().then(() => process.exit(0));
});
