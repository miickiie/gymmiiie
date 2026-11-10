import { mkdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const publicDir = resolve(root, 'public');

const source = await readFile(resolve(here, 'assets/peekaboo.png'));

let sharp;
try {
  sharp = (await import('sharp')).default;
} catch {
  console.error('sharp is required to regenerate icons: npm install -D sharp');
  process.exit(1);
}

await mkdir(publicDir, { recursive: true });

const jobs = [
  ['icon-192.png', 192, false],
  ['icon-512.png', 512, false],
  ['icon-512-maskable.png', 512, true],
  ['apple-touch-icon.png', 180, false],
  ['favicon-32.png', 32, false],
];

for (const [name, size, maskable] of jobs) {
  const out = resolve(publicDir, name);
  // Inset the approved artwork so its ears and weight blocks stay within
  // the circular 80% maskable safe zone.
  const artworkSize = maskable ? Math.floor(size * 0.7) : size;
  const padding = size - artworkSize;
  await sharp(source)
    .resize(artworkSize, artworkSize, { kernel: 'nearest' })
    .extend({
      top: Math.floor(padding / 2),
      bottom: Math.ceil(padding / 2),
      left: Math.floor(padding / 2),
      right: Math.ceil(padding / 2),
      background: '#f6f1e9',
    })
    .png({ compressionLevel: 9 })
    .toFile(out);
  console.log(`wrote public/${name}`);
}
