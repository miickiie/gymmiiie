import { describe, expect, it } from 'vitest';
import originalCatalog from '../data/exercises.json';
import artCandidates from '../data/art-candidates.json';
import { ART, artEntry, instructionsOf, stepsFor } from './art';
import { EXERCISES } from './exercises';

const blocked = new Set([
  'NlfIbzq',
  'wide-grip-barbell-curl',
  'machine-biceps-curl',
  'cable-bent-over-rear-delt-raise',
]);
const byId = new Map(EXERCISES.map((exercise) => [exercise.id, exercise]));

describe('restored exercise content', () => {
  it('retains available original animations without restoring confirmed mismatches', () => {
    const candidates = artCandidates as Record<string, { n: number }>;
    for (const original of originalCatalog) {
      const exercise = byId.get(original.id)!;
      if (blocked.has(original.id)) expect(exercise.art).toBe('');
      else if (original.art && candidates[original.art]) {
        expect(exercise.art).toBe(original.art);
        expect(artEntry(exercise.art)?.n).toBeGreaterThan(0);
      }
    }
    expect(EXERCISES.filter((exercise) => exercise.art)).toHaveLength(445);
    expect(Object.keys(ART)).toHaveLength(384);
  });

  it('preserves all original guides and prioritizes reviewed corrections', () => {
    expect(EXERCISES).toHaveLength(originalCatalog.length);
    for (const original of originalCatalog) {
      const exercise = byId.get(original.id)!;
      expect(stepsFor(exercise)).toEqual(
        instructionsOf(exercise.id)?.steps ?? original.steps,
      );
      expect(stepsFor(exercise).length).toBeGreaterThan(0);
    }
    const facePull = byId.get('face-pull')!;
    expect(stepsFor(facePull)[0]).toBe(
      'Set a rope attachment on a cable pulley just above head height.',
    );
    expect(stepsFor(facePull).join(' ')).not.toContain('pull-up bar');
    expect(stepsFor(byId.get('EIeI8Vf')!)[0]).toBe(
      'Lie on a flat bench with both feet planted, grip the bar slightly wider than your shoulders, and brace your torso.',
    );
    expect(
      stepsFor({ id: 'custom-form-notes', steps: ['My authored setup'] }),
    ).toEqual(['My authored setup']);
  });
});
