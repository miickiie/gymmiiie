import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const publicDir = resolve(root, 'public');

const svg = await readFile(resolve(publicDir, 'icon.svg'), 'utf8');

// Maskable icons need a full-bleed background and all content inside the
// central 80% safe zone. The SVG content already sits well inside it.
const maskable = svg
  .replace('<rect width="512" height="512" rx="116" fill="url(#g)"/>', '<rect width="512" height="512" fill="url(#g)"/>')
  .replace(/<defs>[\s\S]*?<\/defs>/, `<defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ec9a63"/>
      <stop offset="1" stop-color="#c9612f"/>
    </linearGradient>
  </defs>`);

let sharp;
try {
  sharp = (await import('sharp')).default;
} catch {
  console.error('sharp is required to regenerate icons: npm install -D sharp');
  process.exit(1);
}

await mkdir(publicDir, { recursive: true });

const jobs = [
  ['icon-192.png', svg, 192],
  ['icon-512.png', svg, 512],
  ['icon-512-maskable.png', maskable, 512],
  ['apple-touch-icon.png', maskable, 180],
  ['favicon-32.png', svg, 32],
];

for (const [name, source, size] of jobs) {
  const out = resolve(publicDir, name);
  await sharp(Buffer.from(source)).resize(size, size).png({ compressionLevel: 9 }).toFile(out);
  console.log(`wrote public/${name}`);
}

// Keep the maskable SVG around for reference / future regeneration.
await writeFile(resolve(publicDir, 'icon-maskable.svg'), maskable, 'utf8');
console.log('wrote public/icon-maskable.svg');
