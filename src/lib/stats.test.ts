import { describe, expect, it } from 'vitest';
import type { LoggedExercise, LoggedSession } from '../types';
import {
  exerciseVolume,
  oneRmSeries,
  personalRecords,
  recordFor,
  sessionPRCount,
} from './stats';

const session = (
  exercise: Partial<LoggedExercise>,
  date = '2026-11-01T12:00:00Z',
): LoggedSession => ({
  id: date,
  date,
  durationSec: 600,
  exercises: [
    { id: 'test', name: 'Test', primary: 'abdomen', sets: [], ...exercise },
  ],
});
const timed = (sec: number) =>
  session({
    mode: 'time',
    loadKind: 'added',
    sets: [{ reps: 0, weight: 5, sec, kind: 'normal' }],
  });

describe('mode-aware records', () => {
  it('records the longest hold without computing an e1RM', () => {
    const records = personalRecords([timed(60), timed(90)]);
    expect(records).toEqual([
      { id: 'test', name: 'Test', kind: 'time', best: 90, oneRm: 0 },
    ]);
    expect(oneRmSeries([timed(60)], 'test')).toEqual([]);
  });
  it('records longest cardio distance; no speed or racing rules are inferred', () => {
    const a = session({
      mode: 'cardio',
      sets: [{ reps: 0, weight: 0, km: 5, sec: 1200, kind: 'normal' }],
    });
    const b = session(
      {
        mode: 'cardio',
        sets: [{ reps: 0, weight: 0, km: 10, sec: 4000, kind: 'normal' }],
      },
      '2026-11-02T12:00:00Z',
    );
    expect(recordFor([a, b], 'test')).toMatchObject({
      kind: 'distance',
      best: 10,
      oneRm: 0,
    });
    const faster = session(
      {
        mode: 'cardio',
        sets: [{ reps: 0, weight: 0, km: 5, sec: 1000, kind: 'normal' }],
      },
      '2026-11-03T12:00:00Z',
    );
    expect(sessionPRCount(faster, [a])).toBe(0);
  });
  it('uses longest duration for cardio without distance, and ignores warmups', () => {
    const log = session({
      mode: 'cardio',
      sets: [
        { reps: 0, weight: 0, sec: 3000, kind: 'warmup' },
        { reps: 0, weight: 0, sec: 1800, kind: 'normal' },
      ],
    });
    expect(recordFor([log], 'test')).toMatchObject({
      kind: 'time',
      best: 1800,
    });
  });
  it('infers legacy metrics without consulting changed catalog classifications', () => {
    const legacy = session({
      id: 'LNE3wfo',
      sets: [{ reps: 10, weight: 20, kind: 'normal' }],
    });
    expect(recordFor([legacy], 'LNE3wfo')).toMatchObject({
      kind: 'weight',
      best: 20,
    });
    expect(exerciseVolume(legacy.exercises[0])).toBe(200);
    const legacyHold = session({
      sets: [{ reps: 0, weight: 0, sec: 60, kind: 'normal' }],
    });
    expect(recordFor([legacyHold], 'test')).toMatchObject({
      kind: 'time',
      best: 60,
    });
  });
  it('does not mix incompatible snapshot modes for the same exercise ID', () => {
    const old = session({
      mode: '',
      sets: [{ reps: 10, weight: 20, kind: 'normal' }],
    });
    const newer = session(
      { mode: 'time', sets: [{ reps: 0, weight: 0, sec: 45, kind: 'normal' }] },
      '2026-11-02T12:00:00Z',
    );
    expect(recordFor([old, newer], 'test')).toMatchObject({
      kind: 'time',
      best: 45,
      oneRm: 0,
    });
    expect(old.exercises[0].sets[0]).toEqual({
      reps: 10,
      weight: 20,
      kind: 'normal',
    });
  });
  it('does not treat assistance as lifted weight or added bodyweight load as e1RM', () => {
    const assisted = session({
      mode: '',
      loadKind: 'assistance',
      sets: [{ reps: 10, weight: 50, kind: 'normal' }],
    });
    expect(recordFor([assisted], 'test')).toMatchObject({
      kind: 'reps',
      best: 10,
      oneRm: 0,
    });
    expect(exerciseVolume(assisted.exercises[0])).toBe(0);
    const weighted = session({
      mode: '',
      loadKind: 'added',
      sets: [{ reps: 8, weight: 10, kind: 'normal' }],
    });
    expect(recordFor([weighted], 'test')).toMatchObject({
      kind: 'weight',
      best: 10,
      oneRm: 0,
    });
  });
});
