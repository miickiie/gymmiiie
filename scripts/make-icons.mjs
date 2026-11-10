import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const publicDir = resolve(root, 'public');
const source = resolve(here, 'assets/peekaboo.png');

/**
 * The approved mascot is pixel art on a 38×38 cell grid (the source image is
 * 1254px wide, 33px per cell). Sampling each cell's dominant colour keeps the
 * vector output faithful without inheriting the PNG's canvas grain.
 */
const GRID = 38;
const COLORS = {
  face: '#fbf6ee',
  gray: '#5c636e',
  pink: '#f3bbc3',
  orange: '#df7e4b',
  light: '#fad39d',
  brown: '#342c29',
  eye: '#242a32',
  white: '#fffaf5',
  nose: '#e391a0',
};
const PALETTE = [
  ['face', [248, 240, 232]],
  ['gray', [92, 99, 110]],
  ['pink', [243, 187, 195]],
  ['orange', [223, 126, 75]],
  ['light', [250, 211, 157]],
  ['brown', [52, 44, 41]],
  ['eye', [40, 44, 52]],
  ['white', [255, 250, 246]],
  ['nose', [227, 145, 160]],
];

function nearest(r, g, b) {
  let best = 'face';
  let distance = Infinity;
  for (const [name, [pr, pg, pb]] of PALETTE) {
    const next = (r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2;
    if (next < distance) {
      distance = next;
      best = name;
    }
  }
  return best;
}

async function sourceGrid() {
  const { default: sharp } = await import('sharp').catch(() => {
    throw new Error('sharp is required to regenerate icons: npm install -D sharp');
  });
  const { data, info } = await sharp(source)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const cell = info.width / GRID;
  const grid = [];
  for (let y = 0; y < GRID; y += 1) {
    const row = [];
    for (let x = 0; x < GRID; x += 1) {
      const votes = {};
      for (let py = Math.floor(y * cell); py < Math.floor((y + 1) * cell); py += 2) {
        for (let px = Math.floor(x * cell); px < Math.floor((x + 1) * cell); px += 2) {
          const i = (py * info.width + px) * 4;
          const name = nearest(data[i], data[i + 1], data[i + 2]);
          votes[name] = (votes[name] ?? 0) + 1;
        }
      }
      row.push(
        Object.entries(votes).sort((a, b) => b[1] - a[1])[0][0],
      );
    }
    grid.push(row);
  }
  return grid;
}

function cleanGrid(grid) {
  // Redraw the features whose source pixels sit on half-cell boundaries.
  for (let y = 13; y <= 16; y += 1) {
    for (let x = 11; x <= 14; x += 1) grid[y][x] = 'eye';
    for (let x = 23; x <= 26; x += 1) grid[y][x] = 'eye';
  }
  for (let y = 17; y <= 18; y += 1) {
    for (let x = 18; x <= 20; x += 1) grid[y][x] = 'nose';
  }
  // Toe beans are smaller than a source cell in the artwork.
  for (const [y, x] of [
    [26, 12],
    [26, 14],
    [26, 23],
    [26, 25],
  ]) {
    grid[y][x] = 'pink';
  }
  // Plate highlights run down both sides of the dumbbell.
  for (let y = 27; y <= 31; y += 1) {
    grid[y][6] = 'white';
    grid[y][31] = 'white';
  }
  return grid;
}

function mirrorGrid(grid) {
  const mirrored = grid.map((row) => row.slice());
  for (let y = 0; y < GRID; y += 1) {
    for (let x = 0; x < GRID; x += 1) {
      const left = grid[y][x];
      const right = grid[y][GRID - 1 - x];
      const pick =
        left === right
          ? left
          : left === 'face'
            ? right
            : right === 'face'
              ? left
              : left === 'nose' || right === 'nose'
                ? 'nose'
                : left;
      mirrored[y][x] = pick;
      mirrored[y][GRID - 1 - x] = pick;
    }
  }
  return mirrored;
}

function paintOutsideTransparent(grid) {
  const out = grid.map((row) => row.slice());
  const seen = Array.from({ length: GRID }, () => Array(GRID).fill(false));
  const stack = [];
  for (let x = 0; x < GRID; x += 1) {
    stack.push([x, 0], [x, GRID - 1]);
  }
  for (let y = 0; y < GRID; y += 1) {
    stack.push([0, y], [GRID - 1, y]);
  }
  while (stack.length) {
    const [x, y] = stack.pop();
    if (x < 0 || y < 0 || x >= GRID || y >= GRID || seen[y][x]) continue;
    seen[y][x] = true;
    if (grid[y][x] !== 'face') continue;
    out[y][x] = null;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      stack.push([x + dx, y + dy]);
    }
  }
  return out;
}

function bodyMarkup(grid) {
  const groups = new Map();
  for (let y = 0; y < GRID; y += 1) {
    let x = 0;
    while (x < GRID) {
      const color = grid[y][x];
      if (!color) {
        x += 1;
        continue;
      }
      let width = 1;
      while (x + width < GRID && grid[y][x + width] === color) width += 1;
      const rect = `<rect x="${x}" y="${y}" width="${width}" height="1"/>`;
      groups.set(color, `${groups.get(color) ?? ''}${rect}`);
      x += width;
    }
  }
  return [...groups]
    .map(([color, rects]) => `<g fill="${COLORS[color]}">${rects}</g>`)
    .join('');
}

function svg(body, background = '') {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${GRID} ${GRID}" shape-rendering="crispEdges" width="${GRID}" height="${GRID}">${background}<g>${body}</g></svg>\n`;
}

function iconSvg(body, padding = 0) {
  const scale = (GRID - padding * 2) / GRID;
  const offset = padding;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${GRID} ${GRID}" shape-rendering="crispEdges" width="512" height="512"><rect width="${GRID}" height="${GRID}" fill="#f6f1e9"/><g transform="translate(${offset} ${offset}) scale(${scale.toFixed(4)})">${body}</g></svg>\n`;
}

const grid = paintOutsideTransparent(
  mirrorGrid(cleanGrid(await sourceGrid())),
);
const body = bodyMarkup(grid);

await writeFile(resolve(publicDir, 'logo.svg'), svg(body));
await writeFile(
  resolve(publicDir, 'icon.svg'),
  iconSvg(body),
);
await writeFile(
  resolve(publicDir, 'icon-maskable.svg'),
  iconSvg(body, 5.5),
);
await writeFile(
  resolve(publicDir, 'favicon.svg'),
  iconSvg(body),
);

// Safari still uses PNG for home-screen icons, so keep one raster fallback
// rendered from the same vector source.
try {
  const { default: sharp } = await import('sharp');
  await sharp(Buffer.from(iconSvg(body)))
    .resize(180, 180)
    .png({ compressionLevel: 9 })
    .toFile(resolve(publicDir, 'apple-touch-icon.png'));
  console.log('wrote public/logo.svg, icon.svg, icon-maskable.svg, favicon.svg and apple-touch-icon.png');
} catch {
  console.log('wrote public/logo.svg, icon.svg, icon-maskable.svg and favicon.svg (sharp unavailable: apple-touch-icon.png not regenerated)');
}
