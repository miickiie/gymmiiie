import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { offlineManifest, precacheMarker } from './offline-manifest.mjs';

describe('build-specific offline manifest', () => {
  let directory: string;
  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'gymmiie-offline-'));
    await mkdir(join(directory, 'assets'));
    await mkdir(join(directory, 'art'));
    await Promise.all(
      [
        'index.html',
        'manifest.webmanifest',
        'icon-192.png',
        'icon-512.png',
        'icon-512-maskable.png',
        'apple-touch-icon.png',
        'favicon-32.png',
        'assets/main.js',
        'assets/lazy-route.js',
        'assets/food-data.js',
        'assets/style.css',
        'art/exercise.svg',
      ].map((file) => writeFile(join(directory, file), file)),
    );
    await writeFile(
      join(directory, 'sw.js'),
      `const PRECACHE = ${precacheMarker};`,
    );
  });
  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it('includes emitted lazy/data chunks and excludes optional artwork downloads', async () => {
    const manifest = await offlineManifest(directory);
    expect(manifest.urls).toEqual(
      expect.arrayContaining([
        '/assets/lazy-route.js',
        '/assets/food-data.js',
        '/assets/style.css',
      ]),
    );
    expect(manifest.urls).not.toContain('/art/exercise.svg');
  });

  it('gives worker-only fixes a different cache from the active installation', async () => {
    const initial = await offlineManifest(directory);
    await writeFile(
      join(directory, 'sw.js'),
      `// worker fix\nconst PRECACHE = ${precacheMarker};`,
    );
    expect((await offlineManifest(directory)).version).not.toBe(
      initial.version,
    );
  });

  it('invalidates cached artwork when its bytes change', async () => {
    const initial = await offlineManifest(directory);
    await writeFile(
      join(directory, 'art/exercise.svg'),
      'corrected illustration',
    );
    expect((await offlineManifest(directory)).version).not.toBe(
      initial.version,
    );
  });

  it('fails the build if a required shell file is missing', async () => {
    await rm(join(directory, 'icon-512.png'));
    await expect(offlineManifest(directory)).rejects.toThrow();
  });
});
