import { describe, expect, it } from 'vitest';
import { auditExercises, readReviewInputs } from './audit-exercises.mjs';
import { approvedGuidance } from './build-art.mjs';

const input = readReviewInputs();
describe('independent exercise guidance review', () => {
  it('audits every catalog entry and reports unresolved reviews without claiming verification', () => {
    const { errors, report } = auditExercises(
      input.catalog,
      input.manifest,
      input.art,
      input.instructions,
    );
    expect(errors).toEqual([]);
    expect(Object.keys(input.manifest.exercises)).toHaveLength(501);
    expect(report.catalogUnverified).toBeGreaterThan(0);
    expect(report.instructionsReviewed).toBeGreaterThan(0);
    expect(report.instructionsUnverified).toBeGreaterThan(0);
  });
  it('keeps known mismatched generated guides out of reviewed overrides', () => {
    const result = approvedGuidance(
      input.catalog,
      input.manifest,
      input.art,
      input.instructions,
    );
    expect(result.instructions['face-pull']).toBeUndefined();
    expect(result.instructions.Kyd9Rz5.steps.join(' ')).not.toContain('legs');
    expect(result.instructions.Kyd9Rz5.url).not.toContain('leg-press');
    expect(result.instructions['wide-grip-barbell-curl']).toBeUndefined();
    expect(result.instructions['plank-hold'].steps.join(' ')).not.toContain(
      'one side',
    );
  });
  it('requires separate review for shared assets and rejects missing review entries', () => {
    const manifest = structuredClone(input.manifest);
    delete manifest.exercises['face-pull'];
    expect(
      auditExercises(input.catalog, manifest, input.art, input.instructions)
        .errors,
    ).toContain('face-pull: missing explicit review entry');
    const result = approvedGuidance(
      input.catalog,
      input.manifest,
      input.art,
      input.instructions,
    );
    expect(result.instructions.rNG8fac).toBeUndefined();
  });
  it('rejects approvals with no evidence or a mismatched generated source', () => {
    const manifest = structuredClone(input.manifest);
    manifest.exercises['face-pull'].instructions = {
      status: 'reviewed',
      origin: 'generated',
      url: 'https://wrong.example/face-pull',
    };
    expect(
      auditExercises(
        input.catalog,
        manifest,
        input.art,
        input.instructions,
      ).errors.some((error: string) => error.includes('face-pull:')),
    ).toBe(true);
  });
});
