import { describe, expect, it } from 'vitest';
import {
  defaultPicks,
  EXERCISES,
  exerciseMatchesZone,
  makeSessionExercise,
  modeFor,
  modeOf,
  openingSets,
} from './exercises';
import type { Exercise, LoggedSession, LoggedSet } from '../types';

const exercise = (id: string) => EXERCISES.find((item) => item.id === id)!;
const history = (ex: Exercise, sets: LoggedSet[]): LoggedSession[] => [
  {
    id: 'past',
    date: '2026-11-01T12:00:00Z',
    durationSec: 600,
    exercises: [{ id: ex.id, name: ex.name, primary: ex.primary, sets }],
  },
];

describe('exercise logging defaults', () => {
  it('does not prescribe a load or loaded warmups for a new movement in either unit', () => {
    for (const id of ['I4hDWkc', 'EIeI8Vf'])
      for (const unit of ['kg', 'lb'] as const) {
        const sets = openingSets(exercise(id), [], unit);
        expect(sets).toHaveLength(3);
        expect(
          sets.every((set) => set.weight === 0 && set.kind === 'normal'),
        ).toBe(true);
      }
  });
  it('honors an exact routine count and fills missing history from the last set', () => {
    const ex = exercise('EIeI8Vf');
    const sets = openingSets(
      ex,
      history(ex, [{ reps: 8, weight: 60, kind: 'normal' }]),
      'kg',
      4,
    );
    expect(sets.filter((set) => set.kind !== 'warmup')).toHaveLength(4);
    expect(
      sets
        .filter((set) => set.kind !== 'warmup')
        .every((set) => set.weight === 60 && set.reps === 8),
    ).toBe(true);
  });
  it('does not add timed progression or lose an existing loaded hold', () => {
    const ex = exercise('plank-hold');
    const sets = openingSets(
      ex,
      history(ex, [{ reps: 0, weight: 5, sec: 60, kind: 'normal' }]),
      'kg',
      4,
    );
    expect(sets).toHaveLength(4);
    expect(sets.every((set) => set.sec === 60 && set.weight === 5)).toBe(true);
  });
  it('starts cardio without fabricating distance and preserves duration-only history', () => {
    const ex = exercise('running');
    expect(openingSets(ex, [], 'kg')).toEqual([
      { editedFields: {}, reps: 0, weight: 0, sec: 0, km: 0, done: false, kind: 'normal' },
    ]);
    expect(
      openingSets(
        ex,
        history(ex, [{ reps: 0, weight: 0, sec: 900, kind: 'normal' }]),
        'kg',
        2,
      ).map((set) => set.sec),
    ).toEqual([900, 900]);
  });
  it('snapshots classification and restores left/right values independently', () => {
    const ex = exercise('I4hDWkc');
    const next = makeSessionExercise(
      ex,
      history(ex, [{ reps: 8, left: 12, right: 8, weight: 0, kind: 'normal' }]),
      'kg',
      1,
    );
    expect(next).toMatchObject({
      mode: '',
      loadKind: 'added',
      sets: [{ reps: 12, repsR: 8 }],
    });
  });
  it('supports custom modes and reads legacy modes from saved metrics', () => {
    expect(modeFor({ id: 'custom-run', mode: 'cardio' })).toBe('cardio');
    expect(
      modeFor({ id: 'now-a-hold', mode: '', sets: [{ reps: 0, sec: 60 }] }),
    ).toBe('');
    expect(modeFor({ sets: [{ reps: 0, sec: 60 }] })).toBe('time');
    expect(modeFor({ sets: [{ reps: 0, km: 5, sec: 900 }] })).toBe('cardio');
    expect(modeOf('LNE3wfo')).toBe('time');
    expect(modeOf('seated-forward-fold-stretch')).toBe('time');
  });
});

describe('exercise discovery', () => {
  it('filters by primary muscles instead of secondary muscles', () => {
    for (const id of ['EIeI8Vf', 'I4hDWkc']) {
      const chestExercise = exercise(id);
      expect(exerciseMatchesZone(chestExercise, 'Chest')).toBe(true);
      expect(exerciseMatchesZone(chestExercise, 'Arms')).toBe(false);
      expect(exerciseMatchesZone(chestExercise, 'Shoulders')).toBe(false);
      expect(exerciseMatchesZone(chestExercise, 'triceps')).toBe(false);
    }
    expect(exerciseMatchesZone(exercise('25GPyDY'), 'Arms')).toBe(true);
  });
  it('covers complete muscle zones instead of their first muscle', () => {
    expect(
      exerciseMatchesZone({ primary: 'triceps', secondary: [] }, 'Arms'),
    ).toBe(true);
    expect(
      exerciseMatchesZone({ primary: 'hamstrings', secondary: [] }, 'Legs'),
    ).toBe(true);
    expect(
      exerciseMatchesZone({ primary: 'lowerback', secondary: [] }, 'Back'),
    ).toBe(true);
    expect(
      exerciseMatchesZone({ primary: 'obliques', secondary: [] }, 'Core'),
    ).toBe(true);
    expect(
      exerciseMatchesZone({ primary: 'chest', secondary: [] }, 'Legs'),
    ).toBe(false);
  });
  it('caps all-muscle recommendations and never repeats a reviewed movement group', () => {
    const picks = defaultPicks(
      EXERCISES,
      [],
      [...new Set(EXERCISES.map((ex) => ex.primary))],
      {},
      8,
    );
    expect(picks.length).toBeGreaterThan(0);
    expect(picks.length).toBeLessThanOrEqual(8);
    expect(new Set(picks.map((ex) => ex.suggestionGroup)).size).toBe(
      picks.length,
    );
  });
  it('excludes archived exercises even when favored and diversifies chest presses', () => {
    const picks = defaultPicks(EXERCISES, [], ['chest'], { EIeI8Vf: true }, 8, [
      'EIeI8Vf',
    ]);
    expect(picks.some((ex) => ex.id === 'EIeI8Vf')).toBe(false);
    expect(
      picks.filter((ex) => ex.suggestionGroup === 'horizontal-press'),
    ).toHaveLength(1);
  });
  it('preserves catalog IDs and guides while omitting confirmed artwork mismatches', () => {
    expect(EXERCISES).toHaveLength(466);
    expect(new Set(EXERCISES.map((ex) => ex.id)).size).toBe(466);
    expect(exercise('face-pull').steps[0]).toBe(
      'Set a rope attachment on a cable pulley just above head height.',
    );
    expect(exercise('wide-grip-barbell-curl').art).toBe('');
    expect(exercise('I4hDWkc').steps.length).toBeGreaterThan(0);
  });
});
