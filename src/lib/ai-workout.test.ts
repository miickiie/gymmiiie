import { describe, expect, it } from 'vitest';
import { parseAiWorkoutOutput, parseAiWorkoutRequest } from '../../shared/ai-workout';
import type { Exercise, LoggedSession } from '../types';
import { createAiWorkoutRequest, routineCandidates } from './ai-workout';
import { defaultData } from './defaults';
import { EXERCISES, openingSets } from './exercises';
import { lastSetsFor } from './stats';

const bench = EXERCISES.find(exercise => exercise.name === 'Barbell Bench Press')!;
function history(kind: 'normal' | 'warmup', date = '2026-11-01T08:00:00Z'): LoggedSession {
  return { id: date, date, durationSec: 60, exercises: [{ id: bench.id, name: bench.name, primary: bench.primary, sets: [{ kind, weight: 50, reps: 8, left: 8, right: 6 }] }] };
}
function request(mode: 'suggest' | 'routine' = 'suggest') {
  return createAiWorkoutRequest({ data: defaultData(), exercises: EXERCISES, muscles: ['chest'], mode, accountId: 'account-a' });
}

describe('bounded workout context and candidates', () => {
  it('sends existing demographic values and derived working history without unrelated personal data', () => {
    const data = defaultData();
    data.profile.name = 'PRIVATE PROFILE';
    data.sessions = [history('warmup', '2026-11-02T08:00:00Z'), history('normal')];
    data.sessions[0].note = 'PRIVATE NOTES';
    data.favorites[bench.id] = true;
    const context = createAiWorkoutRequest({ data, exercises: EXERCISES, muscles: ['chest'], mode: 'suggest', accountId: 'a', now: Date.parse('2026-11-03T08:00:00Z') });
    expect(context.profile).toEqual({ sex: data.profile.sex, age: data.profile.age, height: data.profile.heightCm, weight: data.profile.weightKg, activity: data.profile.activity });
    expect(context.candidates.find(item => item.id === bench.id)).toMatchObject({ favorite: true, history: { hasWorkingSets: true, latestWorkingSets: 1, workingSets30Days: 1, lastTrainedAt: Date.parse(data.sessions[1].date) } });
    expect(JSON.stringify(context)).not.toMatch(/PRIVATE|note|nutrition|weightKg/);
  });

  it('keeps alternatives in the candidate pool, prioritizes favorites, and excludes archived/unreviewed entries', () => {
    const data = defaultData();
    const variants: Exercise[] = Array.from({ length: 45 }, (_, index) => ({ ...bench, id: `variant-${index}`, suggestionGroup: `family-${index % 10}` }));
    data.favorites['variant-40'] = true;
    data.archived = ['variant-41'];
    const pool = routineCandidates(data, [...variants, { ...bench, id: 'unreviewed', suggestionGroup: undefined }], ['chest']);
    expect(pool).toHaveLength(32);
    expect(pool[0].id).toBe('variant-40');
    expect(pool.some(item => ['variant-41', 'unreviewed'].includes(item.id))).toBe(false);
    expect(new Set(pool.map(item => item.id)).size).toBe(pool.length);
    expect(new Set(pool.map(item => item.suggestionGroup)).size).toBeLessThan(pool.length);
  });

  it('rejects unsupported muscles, non-finite measurements, oversized pools, and malformed history', () => {
    const context = request();
    expect(() => parseAiWorkoutRequest({ ...context, selectedMuscles: ['invented'] })).toThrow();
    expect(() => parseAiWorkoutRequest({ ...context, profile: { ...context.profile, age: Infinity } })).toThrow();
    expect(() => parseAiWorkoutRequest({ ...context, candidates: Array(33).fill(context.candidates[0]) })).toThrow();
    expect(() => parseAiWorkoutRequest({ ...context, candidates: [{ ...context.candidates[0], history: {} }] })).toThrow();
  });
});

describe('AI output validation', () => {
  it('only accepts an exact reordered suggestion permutation with reasons', () => {
    const context = request();
    const items = [...context.baselineIds].reverse().map(exerciseId => ({ exerciseId, reason: 'A familiar movement.' }));
    expect(parseAiWorkoutOutput({ items }, context).items).toEqual(items);
    for (const invalid of [items.slice(1), [...items, items[0]], [{ exerciseId: 'invented', reason: 'No.' }], items.map(item => ({ ...item, weight: 100 }))]) {
      expect(() => parseAiWorkoutOutput({ items: invalid }, context)).toThrow();
    }
  });

  it('validates routine set/rest ranges and movement families, forbidding prescribed weights', () => {
    const context = request('routine');
    const item = { exerciseId: context.candidates[0].id, reason: 'Matches the focus.', sets: 3, restSeconds: 90 };
    expect(parseAiWorkoutOutput({ name: 'Chest day', items: [item] }, context)).toMatchObject({ mode: 'routine', name: 'Chest day' });
    for (const patch of [{ sets: 0 }, { sets: 13 }, { sets: 1.5 }, { restSeconds: 91 }, { restSeconds: 615 }, { weight: 20 }]) {
      expect(() => parseAiWorkoutOutput({ name: 'Chest day', items: [{ ...item, ...patch }] }, context)).toThrow();
    }
    const sibling = context.candidates.find(candidate => candidate.id !== item.exerciseId && candidate.suggestionGroup === context.candidates[0].suggestionGroup);
    expect(sibling).toBeDefined();
    expect(() => parseAiWorkoutOutput({ name: 'Duplicate movement', items: [item, { ...item, exerciseId: sibling!.id }] }, context)).toThrow();
  });
});

describe('historical starting sets', () => {
  it('skips warmup-only workouts and retains older per-side working values', () => {
    const sessions = [history('warmup', '2026-11-02T08:00:00Z'), history('normal')];
    expect(lastSetsFor(sessions, bench.id)).toEqual(sessions[1].exercises[0].sets);
    const sets = openingSets(bench, sessions, 'kg', 2, 10, false);
    expect(sets).toHaveLength(2);
    expect(sets.every(set => set.weight === 50 && set.reps === 8 && set.repsR === 6 && !set.done)).toBe(true);
  });

  it('keeps zero-load working history eligible', () => {
    const session = history('normal');
    session.exercises[0].sets[0].weight = 0;
    expect(lastSetsFor([session], bench.id)).toHaveLength(1);
  });
});
