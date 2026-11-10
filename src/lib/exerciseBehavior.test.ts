import { describe, expect, it } from 'vitest';
import { isCompletableSet } from './exerciseBehavior';

describe('completed set validity', () => {
  it('allows zero added load with reps, but rejects missing/invalid reps and loads', () => {
    expect(isCompletableSet('', { reps: 10, weight: 0 })).toBe(true);
    expect(isCompletableSet('', { reps: 0, weight: 20 })).toBe(false);
    expect(isCompletableSet('', { reps: 10, repsR: 0, weight: 0 })).toBe(false);
    expect(isCompletableSet('', { reps: Infinity, weight: 20 })).toBe(false);
    expect(isCompletableSet('', { reps: 10, weight: -1 })).toBe(false);
  });
  it('requires duration for a hold and one positive metric for cardio', () => {
    expect(isCompletableSet('time', { reps: 0, weight: 0, sec: 0 })).toBe(
      false,
    );
    expect(isCompletableSet('time', { reps: 0, weight: 0, sec: 60 })).toBe(
      true,
    );
    expect(
      isCompletableSet('cardio', { reps: 0, weight: 0, sec: 0, km: 0 }),
    ).toBe(false);
    expect(isCompletableSet('cardio', { reps: 0, weight: 0, sec: 900 })).toBe(
      true,
    );
    expect(isCompletableSet('cardio', { reps: 0, weight: 0, km: 5 })).toBe(
      true,
    );
    expect(
      isCompletableSet('cardio', { reps: 0, weight: 0, sec: 900, km: NaN }),
    ).toBe(false);
  });
});
