import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const MUSCLES = new Set([
  'chest',
  'shoulders',
  'biceps',
  'abdomen',
  'obliques',
  'quads',
  'forearm',
  'trapezius',
  'back',
  'lowerback',
  'triceps',
  'glutes',
  'hamstrings',
  'calves',
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
const MODES = new Set([
  '',
  'time',
  'cardio',
  'distance_duration',
  'duration',
  'weight_duration',
  'assisted_bodyweight',
  'bodyweight_reps',
  'weight_reps',
]);
const LOADS = new Set(['external', 'added', 'assistance', 'none']);
const isURL = (value) => {
  try {
    return ['https:', 'http:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
};

export function auditExercises(
  catalog,
  manifest,
  art,
  instructions,
  assetExists = () => true,
) {
  const errors = [];
  const ids = new Set();
  const reviews = manifest?.exercises ?? {};
  const report = {
    exercises: catalog.length,
    catalogReviewed: 0,
    catalogPartiallyReviewed: 0,
    catalogUnverified: 0,
    instructionsReviewed: 0,
    instructionsUnverified: 0,
    artReviewed: 0,
    artUnverified: 0,
    flags: {},
    reviewedFields: {},
    loggingReviewed: 0,
    loggingLegacy: 0,
    suggestionEligible: 0,
    unresolvedSuspicious: [],
  };
  for (const ex of catalog) {
    if (!ex.id || ids.has(ex.id))
      errors.push(`Duplicate or empty exercise ID: ${ex.id}`);
    ids.add(ex.id);
    if (typeof ex.name !== 'string' || !ex.name.trim())
      errors.push(`${ex.id}: missing exercise name`);
    if (
      !Array.isArray(ex.steps) ||
      ex.steps.some((step) => typeof step !== 'string') ||
      !Array.isArray(ex.aliases) ||
      ex.aliases.some((alias) => typeof alias !== 'string')
    )
      errors.push(`${ex.id}: invalid text arrays`);
    if (!MODES.has(ex.mode))
      errors.push(`${ex.id}: invalid source logging mode`);
    if (ex.art && (!art[ex.art]?.n || !assetExists(ex.art)))
      errors.push(`${ex.id}: source art reference missing`);
    if (
      !MUSCLES.has(ex.primary) ||
      !Array.isArray(ex.secondary) ||
      ex.secondary.some((m) => !MUSCLES.has(m))
    )
      errors.push(`${ex.id}: invalid source muscle taxonomy`);
    if (!EQUIPMENT.has(ex.equipment))
      errors.push(`${ex.id}: invalid equipment`);
    const review = reviews[ex.id];
    if (!review) {
      errors.push(`${ex.id}: missing explicit review entry`);
      continue;
    }
    const status = review.catalog?.status;
    if (!['unverified', 'partially-reviewed', 'reviewed'].includes(status))
      errors.push(`${ex.id}: invalid catalog review status`);
    else
      report[
        status === 'reviewed'
          ? 'catalogReviewed'
          : status === 'partially-reviewed'
            ? 'catalogPartiallyReviewed'
            : 'catalogUnverified'
      ]++;
    if (!Array.isArray(review.catalog?.flags))
      errors.push(`${ex.id}: audit flags must be explicit`);
    for (const flag of review.catalog?.flags ?? [])
      report.flags[flag] = (report.flags[flag] ?? 0) + 1;
    for (const field of review.catalog?.reviewedFields ?? [])
      report.reviewedFields[field] = (report.reviewedFields[field] ?? 0) + 1;
    if (review.catalog?.flags?.length)
      report.unresolvedSuspicious.push({
        id: ex.id,
        name: ex.name,
        flags: review.catalog.flags,
      });
    if (review.logging?.status === 'reviewed') report.loggingReviewed++;
    else report.loggingLegacy++;
    if (review.suggestionGroup) report.suggestionEligible++;
    const override = review.catalog?.overrides;
    if (
      override &&
      (!review.catalog.sources?.length ||
        review.catalog.sources.some((url) => !isURL(url)))
    )
      errors.push(`${ex.id}: taxonomy override needs source evidence`);
    if (override?.primary && !MUSCLES.has(override.primary))
      errors.push(`${ex.id}: invalid corrected primary muscle`);
    if (override?.secondary && override.secondary.some((m) => !MUSCLES.has(m)))
      errors.push(`${ex.id}: invalid corrected secondary muscle`);
    if (
      !MODES.has(review.logging?.mode) ||
      (review.logging?.loadKind != null && !LOADS.has(review.logging.loadKind))
    )
      errors.push(`${ex.id}: invalid logging classification`);
    for (const kind of ['instructions', 'art']) {
      const decision = review[kind];
      if (!['unverified', 'reviewed'].includes(decision?.status)) {
        errors.push(`${ex.id}: invalid ${kind} review status`);
        continue;
      }
      report[
        kind === 'instructions'
          ? decision.status === 'reviewed'
            ? 'instructionsReviewed'
            : 'instructionsUnverified'
          : decision.status === 'reviewed'
            ? 'artReviewed'
            : 'artUnverified'
      ]++;
      if (decision.status !== 'reviewed') continue;
      if (
        !decision.reviewedAgainst?.length ||
        decision.reviewedAgainst.some((url) => !isURL(url)) ||
        !decision.reviewedOn
      )
        errors.push(`${ex.id}: ${kind} approval lacks review evidence`);
      if (kind === 'art') {
        if (
          !/^[a-z0-9-]+$/.test(decision.slug ?? '') ||
          !art[decision.slug]?.n ||
          !assetExists(decision.slug)
        )
          errors.push(`${ex.id}: approved art asset missing or invalid`);
      } else if (decision.origin === 'reviewed') {
        if (
          !Array.isArray(decision.steps) ||
          !decision.steps.length ||
          decision.steps.some(
            (step) => typeof step !== 'string' || !step.trim(),
          )
        )
          errors.push(`${ex.id}: reviewed steps missing`);
      } else if (decision.origin === 'catalog') {
        if (!Array.isArray(ex.steps) || !ex.steps.length)
          errors.push(`${ex.id}: approved original steps missing`);
      } else if (
        decision.origin !== 'generated' ||
        !instructions[ex.id]?.steps?.length ||
        decision.url !== instructions[ex.id]?.url
      )
        errors.push(
          `${ex.id}: approved generated instructions do not match selection`,
        );
    }
  }
  for (const id of Object.keys(instructions))
    if (!ids.has(id))
      errors.push(`${id}: instruction candidate references unknown exercise`);
  for (const id of Object.keys(reviews))
    if (!ids.has(id)) errors.push(`${id}: review references unknown exercise`);
  return { errors, report };
}

export function readReviewInputs(
  root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'),
) {
  const read = (name) =>
    JSON.parse(fs.readFileSync(path.join(root, 'src/data', name), 'utf8'));
  return {
    root,
    catalog: read('exercises.json'),
    manifest: read('exercise-review.json'),
    art: read('art-candidates.json'),
    instructions: read('instructions-candidates.json'),
  };
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const input = readReviewInputs();
  const result = auditExercises(
    input.catalog,
    input.manifest,
    input.art,
    input.instructions,
    (slug) => fs.existsSync(path.join(input.root, 'public/art', `${slug}.svg`)),
  );
  const { unresolvedSuspicious, ...summary } = result.report;
  console.log(
    JSON.stringify(
      {
        errors: result.errors,
        report: {
          ...summary,
          unresolvedSuspiciousCount: unresolvedSuspicious.length,
          unresolvedDetails: 'src/data/exercise-review.json catalog.flags',
        },
      },
      null,
      2,
    ),
  );
  if (result.errors.length) process.exitCode = 1;
}
