/**
 * Exercise-library parity and integrity checks.
 *
 * Fails hard on broken IDs, duplicate names/IDs, incomplete taxonomy, invalid
 * muscles or unresolved common lift names. Missing artwork is logged because the
 * UI deliberately falls back to an equipment icon.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (relative) =>
  JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));

const catalog = readJson('src/data/exercises.json');
const baseline = readJson('scripts/exercise-id-baseline.json');
const artDir = path.join(root, 'public/art');

const MUSCLES = new Set([
  'quads',
  'glutes',
  'back',
  'shoulders',
  'chest',
  'abdomen',
  'triceps',
  'biceps',
  'hamstrings',
  'calves',
  'obliques',
  'trapezius',
  'forearm',
  'lowerback',
]);
const KINDS = new Set(['strength', 'cardio', 'mobility', 'sport']);
const MODES = new Set([
  'distance_duration',
  'duration',
  'weight_duration',
  'assisted_bodyweight',
  'bodyweight_reps',
  'weight_reps',
  'time',
  'cardio',
]);
const EQUIPMENT = new Set([
  'Barbell',
  'Dumbbell',
  'Cable',
  'Machine',
  'Bodyweight',
  'Weighted',
  'Band',
  'Kettlebell',
  'Rings',
  'Other',
]);

const TOP_LIFTS = [
  'Bench Press (Barbell)',
  'Squat (Barbell)',
  'Lat Pulldown',
  'Overhead Press',
  'Skullcrusher',
  'EZ Bar Curl',
  'Deadlift (Barbell)',
  'Romanian Deadlift (Barbell)',
  'Bench Press (Dumbbell)',
  'Bent Over Row (Barbell)',
  'Pull Up',
  'Chin Up',
  'Lateral Raise',
  'Bicep Curl',
  'Triceps Pushdown',
  'Leg Press',
  'Leg Curl',
  'Leg Extension',
  'Calf Raise',
  'Face Pull',
];

const fold = (value) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
const compact = (value) => fold(value).replace(/[^a-z0-9]+/g, '');

function resolves(name) {
  const target = fold(name);
  const wanted = compact(name);
  return catalog.some(
    (exercise) =>
      fold(exercise.name) === target ||
      compact(exercise.name) === wanted ||
      exercise.aliases.some(
        (alias) => fold(alias) === target || compact(alias) === wanted,
      ) ||
      (() => {
        const suffix = target.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
        if (!suffix) return false;
        const prefixed = `${suffix[2]} ${suffix[1]}`.trim();
        return (
          fold(exercise.name) === prefixed ||
          exercise.aliases.some((alias) => fold(alias) === prefixed)
        );
      })(),
  );
}

const errors = [];
const warnings = [];
const ids = new Map();
const names = new Map();
const assetSlugs = new Set(
  fs
    .readdirSync(artDir)
    .filter((file) => file.endsWith('.svg'))
    .map((file) => file.slice(0, -4)),
);

for (const exercise of catalog) {
  const id = exercise.id;
  if (!id) errors.push('Exercise with empty ID');
  if (ids.has(id)) errors.push(`Duplicate exercise ID: ${id}`);
  ids.set(id, exercise);

  const nameKey = fold(exercise.name ?? '');
  if (!nameKey) errors.push(`${id}: missing name`);
  if (names.has(nameKey))
    errors.push(
      `Duplicate lowercase name: ${exercise.name} (${id}, ${names.get(nameKey)})`,
    );
  names.set(nameKey, id);

  if (!MODES.has(exercise.mode))
    errors.push(`${id}: empty or invalid mode ${JSON.stringify(exercise.mode)}`);
  if (!KINDS.has(exercise.kind))
    errors.push(`${id}: empty or invalid kind ${JSON.stringify(exercise.kind)}`);
  if (!EQUIPMENT.has(exercise.equipment))
    errors.push(`${id}: invalid equipment ${exercise.equipment}`);
  if (!MUSCLES.has(exercise.primary))
    errors.push(`${id}: invalid primary ${exercise.primary}`);
  if (!Array.isArray(exercise.secondary))
    errors.push(`${id}: secondary must be an array`);
  else
    for (const muscle of exercise.secondary)
      if (!MUSCLES.has(muscle))
        errors.push(`${id}: invalid secondary ${muscle}`);
  if (typeof exercise.unilateral !== 'boolean')
    errors.push(`${id}: unilateral must be a boolean`);
  if (
    exercise.sub_equipment != null &&
    typeof exercise.sub_equipment !== 'string'
  )
    errors.push(`${id}: invalid sub_equipment`);
  if (!Array.isArray(exercise.aliases))
    errors.push(`${id}: aliases must be an array`);
  if (!Array.isArray(exercise.similar_ids))
    errors.push(`${id}: similar_ids must be an array`);
  else {
    if (exercise.similar_ids.length > 6)
      errors.push(`${id}: more than 6 similar_ids`);
    if (exercise.similar_ids.includes(id))
      errors.push(`${id}: similar_ids includes itself`);
    for (const similar of exercise.similar_ids)
      if (!ids.has(similar) && !catalog.some((item) => item.id === similar))
        errors.push(`${id}: similar_ids references unknown ${similar}`);
  }
  if (
    !Array.isArray(exercise.steps) ||
    !exercise.steps.length ||
    exercise.steps.some((step) => !step.trim())
  )
    errors.push(`${id}: missing execution steps`);
  if (exercise.art && !assetSlugs.has(exercise.art))
    warnings.push(`${id}: art slug "${exercise.art}" has no SVG asset`);
}

for (const originalId of baseline.ids)
  if (!ids.has(originalId))
    errors.push(`Original exercise ID was removed: ${originalId}`);

if (catalog.length < 500)
  errors.push(`Expected at least 500 exercises, found ${catalog.length}`);

for (const name of TOP_LIFTS)
  if (!resolves(name))
    errors.push(`Common lift name does not resolve: ${name}`);

const missingArt = catalog.filter(
  (exercise) => exercise.art && !assetSlugs.has(exercise.art),
).length;
const summary = {
  total: catalog.length,
  originalIds: baseline.ids.length,
  duplicateIds: catalog.length - ids.size,
  duplicateNames: catalog.length - names.size,
  emptyMode: catalog.filter((exercise) => !exercise.mode).length,
  emptyKind: catalog.filter((exercise) => !exercise.kind).length,
  unilateral: catalog.filter((exercise) => exercise.unilateral).length,
  withArt: catalog.filter((exercise) => exercise.art).length,
  missingArt,
  topLiftsResolved: TOP_LIFTS.length,
  warnings: warnings.length,
};
console.log(JSON.stringify(summary, null, 2));
if (warnings.length) console.log(`\nWarnings:\n${warnings.join('\n')}`);
if (errors.length) {
  console.error(`\nErrors:\n${errors.join('\n')}`);
  process.exitCode = 1;
}
