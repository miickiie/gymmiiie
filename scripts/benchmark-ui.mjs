/**
 * Compare production UI interaction latency with the same browser and viewport.
 * Usage: node scripts/benchmark-ui.mjs BASELINE_DIST [CURRENT_DIST=dist] [RUNS=10]
 * JSON goes to stdout. Both artifact directories are served locally on 4183/4184.
 * Service workers and external fonts are disabled to isolate rendering/search.
 */
import { createServer as createHttpServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { transformWithEsbuild } from 'vite';
import { createWorkerTestRuntime } from './worker-test-runtime.mjs';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [baselineArg, currentArg = 'dist', runsArg = '10'] =
  process.argv.slice(2);
if (
  !baselineArg ||
  !/^\d+$/.test(runsArg) ||
  Number(runsArg) < 5 ||
  Number(runsArg) > 100
) {
  throw new Error(
    'Usage: node scripts/benchmark-ui.mjs BASELINE_DIST [CURRENT_DIST=dist] [RUNS=10, range 5–100]',
  );
}
const runs = Number(runsArg);
const warmups = 2;
// Isolated local benchmark invitation; never a production registration secret.
const benchmarkInvite = 'benchmark-only-invite';
const variants = [
  { name: 'baseline', directory: resolve(baselineArg), port: 4183 },
  { name: 'current', directory: resolve(currentArg), port: 4184 },
];
const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

async function serve(directory, port, runtime) {
  await stat(resolve(directory, 'index.html'));
  const server = createHttpServer(async (request, response) => {
    try {
      const origin = `http://127.0.0.1:${port}`;
      const url = new URL(request.url, origin);
      const pathname = decodeURIComponent(url.pathname);
      if (pathname === '/api' || pathname.startsWith('/api/')) {
        const headers = new Headers();
        for (const [name, value] of Object.entries(request.headers)) {
          if (value !== undefined && name !== 'host')
            headers.set(name, Array.isArray(value) ? value.join(', ') : value);
        }
        headers.set('CF-Connecting-IP', '198.18.0.1');
        let payload;
        if (request.method !== 'GET' && request.method !== 'HEAD') {
          const chunks = [];
          let bytes = 0;
          for await (const chunk of request) {
            bytes += chunk.length;
            if (bytes > 2_000_000)
              throw new Error('Benchmark API request is too large.');
            chunks.push(chunk);
          }
          payload = Buffer.concat(chunks);
        }
        const received = await runtime.mf.dispatchFetch(url.href, {
          method: request.method,
          headers,
          body: payload,
        });
        const outgoing = Object.fromEntries(received.headers);
        const cookies =
          received.headers.getSetCookie?.() ??
          (received.headers.get('set-cookie')
            ? [received.headers.get('set-cookie')]
            : []);
        if (cookies.length) outgoing['set-cookie'] = cookies;
        delete outgoing['transfer-encoding'];
        response.writeHead(received.status, outgoing);
        response.end(Buffer.from(await received.arrayBuffer()));
        return;
      }
      // Never serve dotfiles or paths outside the supplied build directory.
      if (pathname.split('/').some((part) => part.startsWith('.'))) {
        response.writeHead(404).end();
        return;
      }
      let file = resolve(directory, `.${pathname}`);
      if (file !== directory && !file.startsWith(`${directory}${sep}`)) {
        response.writeHead(404).end();
        return;
      }
      if (!extname(pathname)) file = resolve(directory, 'index.html');
      const body = await readFile(file);
      response.writeHead(200, {
        'Content-Type': mimeTypes[extname(file)] ?? 'application/octet-stream',
        'Cache-Control': pathname.startsWith('/assets/')
          ? 'public, max-age=31536000, immutable'
          : 'no-store',
        // Keep external font/network availability out of the comparison.
        'Content-Security-Policy':
          "default-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; font-src 'self' data:; connect-src 'self'",
      });
      response.end(body);
    } catch (error) {
      response.writeHead(error?.code === 'ENOENT' ? 404 : 500).end();
    }
  });
  await new Promise((done, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', done);
  });
  return server;
}

async function fixture() {
  // Transpile only this self-contained source module in memory: no Vite server,
  // repository configuration, file watching or environment-file loading.
  const source = await readFile(
    resolve(projectRoot, 'src/lib/defaults.ts'),
    'utf8',
  );
  const { code } = await transformWithEsbuild(source, 'defaults.ts', {
    loader: 'ts',
    format: 'esm',
    tsconfigRaw: { compilerOptions: { target: 'ES2022' } },
  });
  const { defaultData } = await import(
    `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`
  );
  const data = defaultData();
  data.onboarded = true;
  data.profile.name = 'Benchmark';
  data.settings.sound = false;
  data.settings.vibrate = false;
  return data;
}

async function seed(page, origin, data, authenticated) {
  await page.goto(`${origin}/icon-192.png`);
  if (authenticated) {
    // Exercise real account/session and owner-data APIs, sharing the browser's
    // cookie jar. No application-only test route or login bypass is involved.
    const registration = await page
      .context()
      .request.post(`${origin}/api/accounts/register`, {
        headers: { Origin: origin },
        data: {
          name: 'Benchmark',
          telephone: '+12025550123',
          passphrase: benchmarkInvite,
        },
      });
    if (registration.status() !== 201)
      throw new Error(
        `Benchmark account registration failed (${registration.status()}).`,
      );
    const { account } = await registration.json();
    const saved = await page
      .context()
      .request.put(
        `${origin}/api/accounts/${encodeURIComponent(account.id)}/data`,
        {
          headers: { Origin: origin, 'X-Gymmiie-Account': account.id },
          data: { data, expectedRevision: 0, commitId: randomUUID() },
        },
      );
    if (!saved.ok())
      throw new Error(
        `Benchmark account fixture write failed (${saved.status()}).`,
      );
  } else {
    await page.evaluate(
      (snapshot) =>
        new Promise((done, reject) => {
          const opening = indexedDB.open('keyval-store', 1);
          opening.onupgradeneeded = () =>
            opening.result.createObjectStore('keyval');
          opening.onerror = () => reject(opening.error);
          opening.onsuccess = () => {
            const db = opening.result;
            const transaction = db.transaction('keyval', 'readwrite');
            transaction.objectStore('keyval').put(snapshot, 'gymmiie:data:v1');
            transaction.oncomplete = () => {
              db.close();
              done();
            };
            transaction.onerror = () => {
              db.close();
              reject(transaction.error);
            };
          };
        }),
      data,
    );
  }
  await page.goto(`${origin}/library`);
  await page
    .locator('main h1')
    .filter({ hasText: 'Find your movement' })
    .waitFor();
  await page
    .locator('main p')
    .filter({ hasText: /^\d+ results?$/ })
    .waitFor();
  const count = Number(
    (
      await page
        .locator('main p')
        .filter({ hasText: /^\d+ results?$/ })
        .textContent()
    ).match(/^\d+/)[0],
  );
  if (count < 1) throw new Error('Seeded library is unexpectedly empty.');
  return count;
}

async function arm(page, { event, target, kind, count, query }) {
  await page.evaluate(
    (configuration) => {
      const element = document.querySelector(configuration.target);
      if (!element)
        throw new Error(`Missing benchmark target ${configuration.target}`);
      window.__gymmiieBenchmark = new Promise((done, reject) => {
        let start = null;
        const text = (node) => node?.textContent?.trim() ?? '';
        const libraryReady = () => {
          const counter = [...document.querySelectorAll('main p')].find(
            (node) => /^\d+ results?$/.test(text(node)),
          );
          const count = Number(text(counter).match(/^\d+/)?.[0]);
          return (
            location.pathname === '/library' &&
            text(document.querySelector('main h1')) === 'Find your movement' &&
            count === configuration.count
          );
        };
        const ready = () => {
          if (configuration.kind === 'empty') {
            return (
              [...document.querySelectorAll('main h2, main p')].some(
                (node) => text(node) === 'No exercises match',
              ) &&
              document.querySelector('main input[placeholder*="Search"]')
                ?.value === configuration.query
            );
          }
          if (
            configuration.kind === 'clear' ||
            configuration.kind === 'library'
          )
            return libraryReady();
          return (
            location.pathname === '/train' &&
            ['Choose your focus', 'Start your workout'].includes(
              text(document.querySelector('main h1')),
            )
          );
        };
        const cleanup = () => {
          observer.disconnect();
          clearTimeout(timeout);
          element.removeEventListener(configuration.event, began, true);
        };
        const check = () => {
          if (start !== null && ready()) {
            const elapsed = performance.now() - start;
            cleanup();
            done(elapsed);
          }
        };
        const began = () => {
          start = performance.now();
          queueMicrotask(check);
        };
        const observer = new MutationObserver(check);
        const timeout = setTimeout(() => {
          cleanup();
          reject(new Error(`Timed out measuring ${configuration.kind}`));
        }, 15000);
        element.addEventListener(configuration.event, began, {
          capture: true,
          once: true,
        });
        observer.observe(document, {
          childList: true,
          subtree: true,
          characterData: true,
        });
      });
    },
    { event, target, kind, count, query },
  );
}
const result = (page) => page.evaluate(() => window.__gymmiieBenchmark);

async function sample(page, count, iteration) {
  await page.bringToFront();
  const searchSelector = 'main input[placeholder*="Search"]';
  const search = page.locator(searchSelector);
  const query = `__gymmiie_no_match_${iteration}__`;
  await arm(page, {
    event: 'input',
    target: searchSelector,
    kind: 'empty',
    count,
    query,
  });
  await search.fill(query);
  const searchEmptyMs = await result(page);
  await arm(page, {
    event: 'input',
    target: searchSelector,
    kind: 'clear',
    count,
  });
  await search.fill('');
  const clearResultsMs = await result(page);
  await arm(page, {
    event: 'click',
    target: 'aside a[href="/train"]',
    kind: 'train',
  });
  await page.locator('aside a[href="/train"]').click();
  const libraryToTrainMs = await result(page);
  await arm(page, {
    event: 'click',
    target: 'aside a[href="/library"]',
    kind: 'library',
    count,
  });
  await page.locator('aside a[href="/library"]').click();
  const trainToLibraryMs = await result(page);
  return { searchEmptyMs, clearResultsMs, libraryToTrainMs, trainToLibraryMs };
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}
function summary(samples, metric) {
  const values = samples.map((sample) => sample[metric]);
  return {
    medianMs: median(values),
    minMs: Math.min(...values),
    maxMs: Math.max(...values),
  };
}

const servers = [];
let browser;
let runtime;
try {
  const data = await fixture();
  runtime = await createWorkerTestRuntime({
    registrationPassphrase: benchmarkInvite,
  });
  for (const variant of variants)
    servers.push(await serve(variant.directory, variant.port, runtime));
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    serviceWorkers: 'block',
    locale: 'en-US',
    colorScheme: 'dark',
    reducedMotion: 'reduce',
  });
  for (const variant of variants) {
    variant.page = await context.newPage();
    variant.errors = [];
    variant.page.on('pageerror', (error) => variant.errors.push(error.message));
    variant.count = await seed(
      variant.page,
      `http://127.0.0.1:${variant.port}`,
      structuredClone(data),
      variant.name === 'current',
    );
    variant.samples = [];
  }
  for (let iteration = -warmups; iteration < runs; iteration++) {
    // Alternate order to reduce bias from background load, CPU warm-up and tab order.
    const order = iteration % 2 === 0 ? variants : [...variants].reverse();
    for (const variant of order) {
      const measured = await sample(variant.page, variant.count, iteration);
      if (iteration >= 0) variant.samples.push(measured);
    }
  }
  for (const variant of variants)
    if (variant.errors.length)
      throw new Error(
        `${variant.name} runtime errors: ${variant.errors.join('; ')}`,
      );
  const metrics = [
    'searchEmptyMs',
    'clearResultsMs',
    'libraryToTrainMs',
    'trainToLibraryMs',
  ];
  const summaries = Object.fromEntries(
    variants.map((variant) => [
      variant.name,
      Object.fromEntries(
        metrics.map((metric) => [metric, summary(variant.samples, metric)]),
      ),
    ]),
  );
  const comparisons = Object.fromEntries(
    metrics.map((metric) => {
      const before = summaries.baseline[metric].medianMs;
      const after = summaries.current[metric].medianMs;
      return [
        metric,
        {
          medianDeltaMs: after - before,
          medianDeltaPercent: before ? ((after - before) / before) * 100 : null,
        },
      ];
    }),
  );
  console.log(
    JSON.stringify(
      {
        measuredAt: new Date().toISOString(),
        browser: await browser.version(),
        viewport: { width: 1280, height: 900 },
        runs,
        warmups,
        methodology:
          'Event-capture performance.now() to actual matching DOM mutation; same browser/context, two origins, warm library and route chunks, alternating order. Current build uses a real native Worker/D1 account session; baseline retains its legacy device record.',
        limitations: [
          'Unthrottled local HTTP, warm caches, service workers/external fonts disabled; these measurements do not represent cold startup or deployment network speed.',
          'Search includes the configured 160 ms debounce in both builds.',
          'Results are descriptive samples; small timing differences are noise, not proof of a speed improvement.',
        ],
        artifacts: Object.fromEntries(
          variants.map(({ name, directory, count }) => [
            name,
            {
              directory,
              exerciseCount: count,
              access:
                name === 'current'
                  ? 'native Worker/D1 account session'
                  : 'legacy device snapshot',
            },
          ]),
        ),
        summaries,
        comparisons,
        rawSamples: Object.fromEntries(
          variants.map(({ name, samples }) => [name, samples]),
        ),
      },
      null,
      2,
    ),
  );
} finally {
  if (browser) await browser.close();
  await Promise.all(
    servers.map(
      (server) =>
        new Promise((done, reject) => {
          server.closeAllConnections();
          server.close((error) => (error ? reject(error) : done()));
        }),
    ),
  );
  if (runtime) await runtime.dispose();
}
