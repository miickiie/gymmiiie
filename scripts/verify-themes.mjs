#!/usr/bin/env node
/**
 * Verify the RGB-channel theme contract before shipping.
 *
 * 1. Parse all six token blocks from src/index.css.
 * 2. Check WCAG 2.1 contrast for text, CTA, artwork, and set/PR badge pairs.
 * 3. Reject hardcoded Tailwind gray palettes, and hardcoded white/black text
 *    paired with a brand-filled background.
 */
import { readFile, readdir } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const css = await readFile(join(root, 'src/index.css'), 'utf8');

const THEME_NAMES = ['dark', 'volt', 'abyss', 'solar', 'light', 'dune'];

function readBlock(marker) {
  const start = css.indexOf(marker);
  if (start === -1) throw new Error(`Missing theme block: ${marker}`);
  const open = css.indexOf('{', start);
  const close = css.indexOf('}', open);
  if (open === -1 || close === -1)
    throw new Error(`Malformed theme block: ${marker}`);
  return css.slice(open + 1, close);
}

function parseBlock(block) {
  const tokens = {};
  for (const line of block.split('\n')) {
    const rgb = line.match(
      /--([\w-]+):\s*(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s*;/,
    );
    if (rgb) {
      tokens[rgb[1]] = [Number(rgb[2]), Number(rgb[3]), Number(rgb[4])];
      continue;
    }
    const scalar = line.match(/--([\w-]+):\s*(0?\.\d+|\d+)\s*;/);
    if (scalar) tokens[scalar[1]] = Number(scalar[2]);
  }
  return tokens;
}

const themes = Object.fromEntries(
  THEME_NAMES.map((name) => [
    name,
    parseBlock(readBlock(`html[data-theme='${name}']`)),
  ]),
);

const channelLuminance = (value) => {
  const s = value / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const luminance = (rgb) =>
  0.2126 * channelLuminance(rgb[0]) +
  0.7152 * channelLuminance(rgb[1]) +
  0.0722 * channelLuminance(rgb[2]);
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const composite = (fg, bg, alpha) =>
  fg.map((value, i) => value * alpha + bg[i] * (1 - alpha));
const rounded = (value) => Math.round(value * 100) / 100;

let failures = 0;
const check = (label, actual, minimum) => {
  const ok = actual >= minimum;
  if (!ok) failures += 1;
  console.log(
    `${ok ? 'PASS' : 'FAIL'} ${label.padEnd(52)} ${rounded(actual)
      .toString()
      .padStart(6)} (min ${minimum})`,
  );
};

const required = [
  'canvas',
  'card',
  'elevated',
  'inset',
  'border',
  'fg',
  'fg-secondary',
  'fg-muted',
  'brand',
  'brand-hover',
  'brand-fg',
  'success',
  'success-fg',
  'danger',
  'art-well',
  'art-ink',
  'heat-0',
  'heat-1',
  'heat-2',
  'heat-3',
  'heat-4',
  'warmup-bg',
  'warmup-fg',
  'drop-bg',
  'drop-fg',
  'failure-bg',
  'failure-fg',
  'pr-bg',
  'pr-fg',
];

for (const [name, tokens] of Object.entries(themes)) {
  for (const token of required) {
    if (!tokens[token]) throw new Error(`${name}: missing --${token}`);
  }

  check(`${name}: fg on canvas`, contrast(tokens.fg, tokens.canvas), 12);
  check(`${name}: fg on card`, contrast(tokens.fg, tokens.card), 12);
  check(`${name}: fg on inset`, contrast(tokens.fg, tokens.inset), 12);
  check(
    `${name}: fg-secondary on canvas`,
    contrast(tokens['fg-secondary'], tokens.canvas),
    4.5,
  );
  check(
    `${name}: fg-secondary on card`,
    contrast(tokens['fg-secondary'], tokens.card),
    4.5,
  );
  check(
    `${name}: brand-fg on brand`,
    contrast(tokens['brand-fg'], tokens.brand),
    4.5,
  );
  check(
    `${name}: success-fg on success`,
    contrast(tokens['success-fg'], tokens.success),
    4.5,
  );
  check(
    `${name}: art-ink on art-well`,
    contrast(tokens['art-ink'], tokens['art-well']),
    7,
  );

  const alpha = tokens['badge-alpha'];
  if (!(alpha > 0 && alpha < 1))
    throw new Error(`${name}: invalid --badge-alpha (${alpha})`);
  for (const kind of ['warmup', 'drop', 'failure', 'pr']) {
    const background = composite(tokens[`${kind}-bg`], tokens.card, alpha);
    check(
      `${name}: ${kind} badge fg on tinted card`,
      contrast(tokens[`${kind}-fg`], background),
      4.5,
    );
  }
}

// ---- hardcoded colour scan --------------------------------------------------
const extensions = new Set(['.jsx', '.tsx']);
async function* walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else if (extensions.has(extname(entry.name))) yield path;
  }
}

const palette =
  /\b(?:bg|text|border|ring|divide|outline|from|to|via|fill|stroke)-(?:gray|slate|zinc|neutral|stone)-\d{2,3}\b/g;
const hardcodedInk = /\btext-(?:white|black)\b/;
const brandFill = /\bbg-brand(?:-hover)?\b/;
const offenders = [];

for await (const path of walk(join(root, 'src'))) {
  const source = await readFile(path, 'utf8');
  const lineOf = (index) => source.slice(0, index).split('\n').length;

  for (const match of source.matchAll(palette)) {
    offenders.push(
      `${relative(root, path)}:${lineOf(match.index)} ${match[0]}`,
    );
  }

  // Inspect complete JSX tags so a multi-line className is checked as a unit.
  for (const tag of source.matchAll(/<[^<>]*>/g)) {
    if (!brandFill.test(tag[0]) || !hardcodedInk.test(tag[0])) continue;
    const ink = tag[0].match(hardcodedInk)[0];
    offenders.push(
      `${relative(root, path)}:${lineOf(tag.index)} bg-brand with ${ink}`,
    );
  }
}

if (offenders.length) {
  failures += offenders.length;
  console.log('\nFAIL hardcoded colour utilities:');
  for (const offender of offenders) console.log(`  ${offender}`);
} else {
  console.log(
    'PASS no gray/slate/zinc utilities or text-white/text-black on bg-brand',
  );
}

console.log(
  failures
    ? `\n${failures} theme check${failures === 1 ? '' : 's'} failed.`
    : '\nAll theme contrast and colour checks passed.',
);
process.exitCode = failures ? 1 : 0;
