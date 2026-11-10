import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { build } from 'vite';
import { offlineManifest, precacheMarker } from './offline-manifest.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = resolve(root, 'dist');
execFileSync(process.execPath, ['scripts/build-art.mjs', '--check'], {
  cwd: root,
  stdio: 'inherit',
});
await build({ root, envDir: false, build: { manifest: true } });
const manifest = await offlineManifest(output);
const workerPath = resolve(output, 'sw.js');
const worker = await readFile(workerPath, 'utf8');
await writeFile(
  workerPath,
  worker.replace(precacheMarker, JSON.stringify(manifest)),
);
console.log(
  `Offline shell: ${manifest.urls.length} files, build ${manifest.version}`,
);
