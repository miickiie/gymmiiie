/**
 * Publish only explicitly reviewed exercise guidance.
 * Candidate provenance/fuzzy similarity never grants semantic approval. Review
 * instructions and artwork separately in src/data/exercise-review.json.
 * Existing source SVGs and candidate JSON remain available for future review.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditExercises, readReviewInputs } from './audit-exercises.mjs';

export function approvedGuidance(
  catalog,
  manifest,
  artCandidates,
  instructionCandidates,
) {
  const art = {};
  const instructions = {};
  for (const exercise of catalog) {
    const review = manifest.exercises[exercise.id];
    if (review.art.status === 'reviewed')
      art[review.art.slug] = artCandidates[review.art.slug];
    if (review.instructions.status !== 'reviewed') continue;
    instructions[exercise.id] =
      review.instructions.origin === 'catalog'
        ? {
            steps: exercise.steps,
            source: 'gymmane',
            url: review.instructions.reviewedAgainst[0],
          }
        : review.instructions.origin === 'reviewed'
          ? {
              steps: review.instructions.steps,
              source: 'reviewed',
              url: review.instructions.reviewedAgainst[0],
            }
          : instructionCandidates[exercise.id];
  }
  const runtimeCatalog = catalog.map((exercise) => {
    const review = manifest.exercises[exercise.id];
    return {
      ...exercise,
      ...review.catalog.overrides,
      mode: review.logging.mode,
      loadKind: review.logging.loadKind,
      suggestionGroup: review.suggestionGroup,
      art: review.art.status === 'reviewed' ? review.art.slug : '',
      steps: instructions[exercise.id]?.steps ?? [],
    };
  });
  return { art, instructions, runtimeCatalog };
}

export function buildApprovedGuidance(root, check = false) {
  const input = readReviewInputs(root);
  const result = auditExercises(
    input.catalog,
    input.manifest,
    input.art,
    input.instructions,
    (slug) => fs.existsSync(path.join(input.root, 'public/art', `${slug}.svg`)),
  );
  if (result.errors.length) throw new Error(result.errors.join('\n'));
  const approved = approvedGuidance(
    input.catalog,
    input.manifest,
    input.art,
    input.instructions,
  );
  const outputs = {
    'art.json': JSON.stringify(approved.art) + '\n',
    'instructions.json': JSON.stringify(approved.instructions, null, 1) + '\n',
    'exercises-runtime.json': JSON.stringify(approved.runtimeCatalog) + '\n',
  };
  for (const [name, content] of Object.entries(outputs)) {
    const destination = path.join(input.root, 'src/data', name);
    if (check) {
      if (
        !fs.existsSync(destination) ||
        fs.readFileSync(destination, 'utf8') !== content
      )
        throw new Error(`${name} is stale; run node scripts/build-art.mjs`);
    } else fs.writeFileSync(destination, content);
  }
  return result.report;
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const { unresolvedSuspicious, ...summary } = buildApprovedGuidance(
    undefined,
    process.argv.includes('--check'),
  );
  console.log(
    JSON.stringify(
      { ...summary, unresolvedSuspiciousCount: unresolvedSuspicious.length },
      null,
      2,
    ),
  );
}
