import catalog from '../data/exercises-runtime.json';
import type {
  Exercise,
  ExerciseMode,
  LoggedSession,
  SessionSet,
  Unit,
} from '../types';
import {
  lastSetsFor,
  toDisplayWeight,
  fromDisplayWeight,
  weightStep,
  setExerciseLookup,
  BODY_ZONES,
} from './stats';
import { roundTo } from './date';
import { loadKindFor, modeFor } from './exerciseBehavior';
export { modeFor, loadKindFor, isCompletableSet } from './exerciseBehavior';

// Generated only from independent reviewed selections; unapproved source text stays out of the browser bundle.
export const EXERCISES = catalog as Exercise[];
const byId = new Map(EXERCISES.map((exercise) => [exercise.id, exercise]));
setExerciseLookup(EXERCISES);

export const EQUIPMENT = [
  'Barbell',
  'Dumbbell',
  'Cable',
  'Machine',
  'Bodyweight',
  'Weighted',
  'Band',
  'Kettlebell',
  'Rings',
  'Other',
];
export const DIFFICULTIES = ['Beginner', 'Intermediate', 'Advanced'];

/** Compatibility lookup for the built-in catalogue; snapshots should use modeFor. */
export function modeOf(id: string): ExerciseMode {
  return byId.get(id)?.mode ?? '';
}

export function exerciseMatchesZone(
  exercise: Pick<Exercise, 'primary' | 'secondary'>,
  zone: string,
): boolean {
  const muscles: readonly string[] = BODY_ZONES[zone] ?? [zone];
  return (
    muscles.includes(exercise.primary) ||
    exercise.secondary.some((muscle) => muscles.includes(muscle))
  );
}

export function foldText(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function searchExercises(list: Exercise[], query: string): Exercise[] {
  const q = foldText(query.trim());
  if (!q) return list;
  const words = q.split(/\s+/);
  return list.filter((e) => {
    const hay = foldText(
      `${e.name} ${e.aliases.join(' ')} ${e.primary} ${e.secondary.join(' ')} ${e.equipment}`,
    );
    return words.every((w) => hay.includes(w));
  });
}

export function defaultPicks(
  exercises: Exercise[],
  sessions: LoggedSession[],
  muscles: string[],
  favorites: Record<string, boolean>,
  limit = 6,
  archived: readonly string[] = [],
): Exercise[] {
  const count = Math.max(0, Math.floor(limit));
  if (!muscles.length || !count) return [];
  const hidden = new Set(archived);
  const history = new Set(
    sessions.flatMap((session) =>
      session.exercises
        .filter((e) => e.sets.some((s) => s.kind !== 'warmup'))
        .map((e) => e.id),
    ),
  );
  const rank = (e: Exercise) =>
    favorites[e.id] ? 0 : history.has(e.id) ? 1 : 2;
  const pool = exercises.filter(
    (e) =>
      e.suggestionGroup &&
      !hidden.has(e.id) &&
      (muscles.includes(e.primary) ||
        e.secondary.some((m) => muscles.includes(m))),
  );
  const picks: Exercise[] = [];
  const usedGroups = new Set<string>();
  const add = (exercise: Exercise | undefined) => {
    if (!exercise || picks.length >= count) return;
    picks.push(exercise);
    usedGroups.add(exercise.suggestionGroup!);
  };
  for (const muscle of [...new Set(muscles)]) {
    const candidates = pool
      .filter(
        (e) => e.primary === muscle && !usedGroups.has(e.suggestionGroup!),
      )
      .sort((a, b) => rank(a) - rank(b));
    add(candidates[0]);
  }
  const remaining = pool
    .filter((e) => !picks.includes(e))
    .sort(
      (a, b) =>
        Number(!muscles.includes(a.primary)) -
          Number(!muscles.includes(b.primary)) || rank(a) - rank(b),
    );
  for (const exercise of remaining) {
    if (picks.length >= count) break;
    if (!usedGroups.has(exercise.suggestionGroup!)) add(exercise);
  }
  return picks;
}

export function openingSets(
  ex: Exercise,
  sessions: LoggedSession[],
  unit: Unit,
  defaultSets?: number,
  targetReps = 10,
  warmups = true,
): SessionSet[] {
  const mode = modeFor(ex);
  const load = loadKindFor(ex);
  const last = lastSetsFor(sessions, ex.id).filter((set) =>
    mode === 'cardio'
      ? (set.sec ?? 0) > 0 || (set.km ?? 0) > 0
      : mode === 'time'
        ? (set.sec ?? 0) > 0 && set.reps === 0
        : set.reps > 0,
  );
  const count = Math.max(
    1,
    Math.min(12, Math.floor(defaultSets ?? (mode === 'cardio' ? 1 : 3))),
  );
  const working: SessionSet[] = Array.from({ length: count }, (_, index) => {
    const previous = last[Math.min(index, last.length - 1)];
    const weight = load === 'none' ? 0 : (previous?.weight ?? 0);
    if (mode === 'cardio')
      return {
        reps: 0,
        weight: 0,
        done: false,
        kind: 'normal',
        sec: previous?.sec ?? 0,
        km: previous?.km ?? 0,
      };
    if (mode === 'time')
      return {
        reps: 0,
        weight,
        done: false,
        kind: 'normal',
        sec: previous?.sec ?? 30,
      };
    return {
      reps: previous?.left ?? previous?.reps ?? targetReps,
      repsR: previous?.right,
      weight,
      done: false,
      kind: 'normal',
    };
  });
  if (
    !warmups ||
    mode ||
    load !== 'external' ||
    !working.length ||
    working[0].weight <= 0
  )
    return working;
  const base = working[0].weight;
  const step = weightStep(unit);
  const warm: SessionSet[] = [0.5, 0.7].map((pct) => ({
    reps: 8,
    weight: fromDisplayWeight(
      roundTo(toDisplayWeight(base * pct, unit), step),
      unit,
    ),
    done: false,
    kind: 'warmup',
  }));
  return [...warm, ...working];
}

export function makeSessionExercise(
  ex: Exercise,
  sessions: LoggedSession[],
  unit: Unit,
  sets?: number,
) {
  return {
    uid: `${ex.id}-${Math.random().toString(36).slice(2, 8)}`,
    id: ex.id,
    name: ex.name,
    primary: ex.primary,
    mode: modeFor(ex),
    loadKind: loadKindFor(ex),
    sets: openingSets(ex, sessions, unit, sets),
    linkedNext: false,
  };
}

export interface PlateResult {
  perSide: { plate: number; count: number }[];
  achieved: number;
  leftover: number;
}

export function calculatePlates(
  totalKg: number,
  barKg: number,
  plates: number[],
  unit: Unit,
): PlateResult {
  const toDisplay = (kg: number) => toDisplayWeight(kg, unit);
  const target = toDisplay(totalKg);
  const bar = toDisplay(barKg);
  let perSide = Math.max(0, (target - bar) / 2);
  const sorted = [...plates].sort((a, b) => b - a);
  const out: { plate: number; count: number }[] = [];
  for (const p of sorted) {
    const count = Math.floor((perSide + 1e-6) / p);
    if (count > 0) {
      out.push({ plate: p, count });
      perSide -= count * p;
    }
  }
  const achievedDisplay =
    bar + out.reduce((n, x) => n + x.plate * x.count * 2, 0);
  return {
    perSide: out,
    achieved: fromDisplayWeight(achievedDisplay, unit),
    leftover: fromDisplayWeight(perSide * 2, unit),
  };
}

export function warmupRamp(
  workKg: number,
  unit: Unit,
): { pct: number; kg: number; reps: number }[] {
  const ramp = [
    { pct: 0.4, reps: 8 },
    { pct: 0.55, reps: 5 },
    { pct: 0.7, reps: 3 },
    { pct: 0.85, reps: 2 },
    { pct: 1, reps: 1 },
  ];
  const step = weightStep(unit);
  return ramp.map((r) => ({
    ...r,
    kg: fromDisplayWeight(
      roundTo(toDisplayWeight(workKg * r.pct, unit), step),
      unit,
    ),
  }));
}

export function targetWeightForRpe(
  oneRmKg: number,
  reps: number,
  rpe: number,
): number | null {
  const index = (reps - 1) * 2 + Math.round((10 - rpe) * 2);
  const pct = [
    1, 0.978, 0.955, 0.939, 0.922, 0.907, 0.892, 0.878, 0.863, 0.85, 0.837,
    0.824, 0.811, 0.799, 0.786, 0.774, 0.762, 0.751, 0.739, 0.723, 0.707, 0.694,
    0.68, 0.667, 0.653, 0.64, 0.626, 0.613, 0.599, 0.586, 0.574,
  ][index];
  return pct ? oneRmKg * pct : null;
}

export function bmi(kg: number, heightCm: number): number {
  const m = heightCm / 100;
  return m > 0 ? kg / (m * m) : 0;
}

export function bmr(profile: {
  sex: string;
  age: number;
  heightCm: number;
  weightKg: number;
}): number {
  const base =
    10 * profile.weightKg + 6.25 * profile.heightCm - 5 * profile.age;
  return Math.round(profile.sex === 'female' ? base - 161 : base + 5);
}

export function tdee(profile: {
  sex: string;
  age: number;
  heightCm: number;
  weightKg: number;
  activity: number;
}): number {
  return Math.round(bmr(profile) * profile.activity);
}

export function dotsScore(
  totalKg: number,
  bodyKg: number,
  sex: string,
): number {
  if (bodyKg <= 0 || totalKg <= 0) return 0;
  const c =
    sex === 'female'
      ? [-0.0000010706, 0.0005158568, -0.1126655495, 13.6175032, -57.96288]
      : [-0.000001093, 0.0007391293, -0.1918759221, 24.0900756, -307.75076];
  const denom =
    c[0] * bodyKg ** 4 +
    c[1] * bodyKg ** 3 +
    c[2] * bodyKg ** 2 +
    c[3] * bodyKg +
    c[4];
  if (denom <= 0) return 0;
  return Math.round((totalKg / denom) * 500 * 10) / 10;
}
