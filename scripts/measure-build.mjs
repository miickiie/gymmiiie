import { readFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { resolve } from 'node:path';

const directory = resolve(process.argv[2] || 'dist');
const manifest = JSON.parse(
  await readFile(resolve(directory, '.vite/manifest.json'), 'utf8'),
);
const visited = new Set();
const files = new Set();
function visit(key) {
  if (visited.has(key)) return;
  visited.add(key);
  const entry = manifest[key];
  if (!entry) throw new Error(`Unknown build entry: ${key}`);
  files.add(entry.file);
  for (const css of entry.css || []) files.add(css);
  for (const dependency of entry.imports || []) visit(dependency);
}
for (const [key, entry] of Object.entries(manifest))
  if (entry.isEntry) visit(key);
const sizes = await Promise.all(
  [...files].map(async (file) => {
    const contents = await readFile(resolve(directory, file));
    return {
      file,
      bytes: contents.length,
      gzipBytes: gzipSync(contents).length,
    };
  }),
);
console.log(
  JSON.stringify(
    {
      initialBytes: sizes.reduce((sum, item) => sum + item.bytes, 0),
      initialGzipBytes: sizes.reduce((sum, item) => sum + item.gzipBytes, 0),
      initialFiles: sizes,
      totalChunks: Object.keys(manifest).length,
    },
    null,
    2,
  ),
);
