import { loadKindFor, modeFor } from '../lib/exercises';
import { toDisplayWeight } from '../lib/stats';
import type { LoggedExercise, LoggedSet, PR, Unit } from '../types';

export function recordValue(
  record: Pick<PR, 'kind' | 'best'>,
  unit: Unit,
): string {
  const value = Number(record.best.toFixed(2));
  if (record.kind === 'weight')
    return `${Number(toDisplayWeight(record.best, unit).toFixed(1))} ${unit}`;
  if (record.kind === 'time') return `${value} s`;
  if (record.kind === 'distance') return `${value} km`;
  return `${value} reps`;
}

export function recordLabel(kind: PR['kind']): string {
  return kind === 'weight'
    ? 'Top weight'
    : kind === 'time'
      ? 'Longest time'
      : kind === 'distance'
        ? 'Farthest distance'
        : 'Most repetitions';
}

export function formatLoggedSet(
  set: LoggedSet,
  exercise: LoggedExercise,
  unit: Unit,
): string {
  const mode = modeFor(exercise);
  const weight = Number(toDisplayWeight(set.weight, unit).toFixed(1));
  if (mode === 'cardio') return `${set.km ?? 0} km · ${set.sec ?? 0} s`;
  if (mode === 'time')
    return `${set.sec ?? 0} s${weight > 0 ? ` · ${weight} ${unit}` : ''}`;
  const reps =
    set.left != null && set.right != null && set.left !== set.right
      ? `${set.left}+${set.right}`
      : String(set.reps);
  return loadKindFor(exercise) === 'none' || weight === 0
    ? `${reps} reps`
    : `${weight} ${unit} × ${reps}${loadKindFor(exercise) === 'assistance' ? ' assistance' : ''}`;
}
