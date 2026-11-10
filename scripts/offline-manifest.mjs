import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export const precacheMarker = '/* __GYMMIIE_PRECACHE__ */ null';
const shell = [
  '/',
  '/manifest.webmanifest',
  '/icon.svg',
  '/icon-192.png',
  '/icon-512.png',
];

async function emittedAssets(directory, prefix = '') {
  const entries = await readdir(directory, { withFileTypes: true });
  const paths = await Promise.all(
    entries.map(async (entry) => {
      const relative = `${prefix}/${entry.name}`;
      if (entry.isDirectory())
        return emittedAssets(resolve(directory, entry.name), relative);
      return relative.startsWith('/assets/') && /\.(?:js|css)$/.test(relative)
        ? [relative]
        : [];
    }),
  );
  return paths.flat();
}

export async function offlineManifest(directory) {
  const urls = [
    ...new Set([...shell, ...(await emittedAssets(directory))]),
  ].sort();
  const digest = createHash('sha256');
  for (const url of urls) {
    digest.update(url);
    digest.update(
      await readFile(
        resolve(directory, url === '/' ? 'index.html' : url.slice(1)),
      ),
    );
  }
  const worker = await readFile(resolve(directory, 'sw.js'), 'utf8');
  if (!worker.includes(precacheMarker))
    throw new Error('Service worker precache marker is missing.');
  digest.update(worker);
  for (const name of (await readdir(resolve(directory, 'art')))
    .filter((name) => name.endsWith('.svg'))
    .sort()) {
    digest.update(name);
    digest.update(await readFile(resolve(directory, 'art', name)));
  }
  return { version: digest.digest('hex').slice(0, 20), urls };
}
