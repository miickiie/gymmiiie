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

export type TrackingMode = '' | 'time' | 'cardio';

/** Map the rich GymMane taxonomy onto the three set-logging input formats. */
export function trackingModeFor(
  mode: ExerciseMode | undefined,
): TrackingMode {
  switch (mode) {
    case 'time':
    case 'duration':
    case 'weight_duration':
      return 'time';
    case 'cardio':
    case 'distance_duration':
      return 'cardio';
    default:
      return '';
  }
}

type BehaviorInput = {
  id?: string;
  mode?: ExerciseMode;
  loadKind?: LoadKind;
  equipment?: string;
  kind?: string;
  sets?: readonly { reps: number; sec?: number; km?: number }[];
};

/** Saved classifications win. Legacy logs are interpreted from their own metrics. */
export function modeFor(exercise: BehaviorInput): ExerciseMode {
  if (exercise.mode !== undefined) return trackingModeFor(exercise.mode);
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
  switch (exercise.mode) {
    case 'assisted_bodyweight':
      return 'assistance';
    case 'bodyweight_reps':
      return 'added';
    case 'distance_duration':
      return 'none';
    case 'weight_duration':
    case 'weight_reps':
      return 'external';
    case 'duration':
      if (['cardio', 'mobility', 'sport'].includes(exercise.kind ?? ''))
        return 'none';
      return ['Bodyweight', 'Rings'].includes(exercise.equipment)
        ? 'added'
        : 'none';
    default:
      break;
  }
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
