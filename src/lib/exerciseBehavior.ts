import type { ExerciseMode, LoadKind } from '../types';

/** Drafts may be empty; completing a set requires a meaningful logged metric. */
export function isCompletableSet(
  mode: ExerciseMode,
  set: {
    reps: number;
    repsR?: number;
    weight: number;
    sec?: number;
    km?: number;
  },
): boolean {
  const nonnegative = (value: number) => Number.isFinite(value) && value >= 0;
  if (!nonnegative(set.weight)) return false;
  if (mode === 'cardio') {
    const seconds = set.sec ?? 0;
    const distance = set.km ?? 0;
    return (
      nonnegative(seconds) &&
      nonnegative(distance) &&
      (seconds > 0 || distance > 0)
    );
  }
  if (mode === 'time') return Number.isFinite(set.sec) && (set.sec ?? 0) > 0;
  return (
    Number.isFinite(set.reps) &&
    set.reps > 0 &&
    (set.repsR == null || (Number.isFinite(set.repsR) && set.repsR > 0))
  );
}

type BehaviorInput = {
  id?: string;
  mode?: ExerciseMode;
  loadKind?: LoadKind;
  equipment?: string;
  sets?: readonly { reps: number; sec?: number; km?: number }[];
};

/** Saved classifications win. Legacy logs are interpreted from their own metrics. */
export function modeFor(exercise: BehaviorInput): ExerciseMode {
  if (
    exercise.mode === '' ||
    exercise.mode === 'time' ||
    exercise.mode === 'cardio'
  )
    return exercise.mode;
  const sets = exercise.sets ?? [];
  if (sets.some((s) => Number.isFinite(s.reps) && s.reps > 0)) return '';
  if (sets.some((s) => Number.isFinite(s.km) && (s.km ?? 0) > 0))
    return 'cardio';
  if (sets.some((s) => Number.isFinite(s.sec) && (s.sec ?? 0) > 0))
    return 'time';
  return '';
}

export function loadKindFor(exercise: BehaviorInput): LoadKind | undefined {
  if (exercise.loadKind) return exercise.loadKind;
  // Snapshots have no equipment: an unknown legacy load must remain unknown.
  if (!exercise.equipment) return undefined;
  if (modeFor(exercise) === 'cardio') return 'none';
  if (['Bodyweight', 'Weighted', 'Rings'].includes(exercise.equipment))
    return 'added';
  if (
    ['Barbell', 'Dumbbell', 'Cable', 'Machine', 'Band', 'Kettlebell'].includes(
      exercise.equipment,
    )
  )
    return 'external';
  return undefined;
}
