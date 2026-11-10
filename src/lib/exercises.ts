import catalog from '../data/exercises.json';
import type { Exercise, LoggedSession, SessionSet, Unit } from '../types';
import { lastSetsFor, toDisplayWeight, fromDisplayWeight, weightStep, setExerciseLookup } from './stats';
import { roundTo } from './date';

export const EXERCISES = catalog as Exercise[];

setExerciseLookup(EXERCISES);

const MODE_IDS = new Set([
  'running', 'walking', 'treadmill-incline-walk', 'cycling', 'assault-bike', 'elliptical', 'rowing',
  'stair-climber', 'skierg', 'jump-rope', 'battle-ropes', 'VBAWRPG', 'active-hang', 'superman-hold',
  'cable-pallof-hold', 'hollow-body-hold', 'bear-plank', 'l-sit-hold', 'wall-sit', 'kettlebell-farmer-carry',
  'rNGclsi', 'rNGdsup', 'cat-cow-stretch', 'doorway-chest-stretch', 'cross-body-shoulder-stretch',
  'childs-pose', 'standing-quad-stretch', 'kneeling-hip-flexor-stretch', 'butterfly-stretch', 'wall-calf-stretch',
  'hamstring-stretch', 'hiking', 'plank-hold', 'side-plank-hold', 'dead-hang-hold', 'outdoor-run',
  'outdoor-cycling', 'outdoor-walk', 'outdoor-hike', 'swim', 'football', 'basketball', 'volleyball', 'tennis',
  'padel', 'badminton', 'squash', 'table-tennis', 'handball', 'rugby', 'boxing', 'martial-arts', 'climbing',
  'skiing', 'surfing', 'dance', 'golf', 'arch-hang', 'parallel-bar-support-hold',
]);

const CARDIO_IDS = new Set([
  'running', 'walking', 'treadmill-incline-walk', 'cycling', 'assault-bike', 'elliptical', 'rowing',
  'stair-climber', 'skierg', 'hiking', 'outdoor-run', 'outdoor-cycling', 'outdoor-walk', 'outdoor-hike', 'swim',
  'football', 'basketball', 'volleyball', 'tennis', 'padel', 'badminton', 'squash', 'table-tennis', 'handball',
  'rugby', 'boxing', 'martial-arts', 'climbing', 'skiing', 'surfing', 'dance', 'golf',
]);

export const EQUIPMENT = ['Barbell', 'Dumbbell', 'Cable', 'Machine', 'Bodyweight', 'Weighted', 'Band', 'Kettlebell', 'Rings', 'Other'];
export const DIFFICULTIES = ['Beginner', 'Intermediate', 'Advanced'];

export function modeOf(id: string): '' | 'cardio' | 'time' {
  if (!MODE_IDS.has(id)) return '';
  return CARDIO_IDS.has(id) ? 'cardio' : 'time';
}

export function foldText(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

export function searchExercises(list: Exercise[], query: string): Exercise[] {
  const q = foldText(query.trim());
  if (!q) return list;
  const words = q.split(/\s+/);
  return list.filter((e) => {
    const hay = foldText(`${e.name} ${e.aliases.join(' ')} ${e.primary} ${e.secondary.join(' ')} ${e.equipment}`);
    return words.every((w) => hay.includes(w));
  });
}

export function defaultPicks(
  exercises: Exercise[],
  sessions: LoggedSession[],
  muscles: string[],
  favorites: Record<string, boolean>,
  limit = 6,
): Exercise[] {
  if (!muscles.length) return [];
  const pool = exercises.filter((e) => muscles.includes(e.primary) || e.secondary.some((m) => muscles.includes(m)));
  if (pool.length <= limit) return pool;
  const hasHistory = (id: string) => lastSetsFor(sessions, id).length > 0;
  const rank = (e: Exercise) => (favorites[e.id] ? 0 : hasHistory(e.id) ? 1 : 2);
  const picks: Exercise[] = [];
  for (const m of muscles) {
    const forMuscle = pool.filter((e) => e.primary === m && !picks.includes(e)).sort((a, b) => rank(a) - rank(b));
    if (forMuscle[0]) picks.push(forMuscle[0]);
  }
  const rest = pool.filter((e) => !picks.includes(e)).sort((a, b) => rank(a) - rank(b));
  for (const e of rest) {
    if (picks.length >= limit) break;
    picks.push(e);
  }
  return picks;
}

export function openingSets(
  ex: Exercise,
  sessions: LoggedSession[],
  unit: Unit,
  defaultSets = 3,
  targetReps = 10,
  warmups = true,
): SessionSet[] {
  const last = lastSetsFor(sessions, ex.id);
  const mode = modeOf(ex.id);
  if (mode === 'cardio') {
    const prev = last.find((s) => (s.km ?? 0) > 0);
    return [{ reps: 0, weight: 0, done: false, kind: 'normal', sec: prev?.sec ?? 1200, km: prev?.km ?? 5 }];
  }
  if (mode === 'time') {
    const prev = last.find((s) => (s.sec ?? 0) > 0);
    return Array.from({ length: prev ? Math.min(defaultSets, last.length) : defaultSets }, () => ({
      reps: 0, weight: 0, done: false, kind: 'normal' as const, sec: prev?.sec ? prev.sec + 5 : 30,
    }));
  }
  const working = last.length
    ? last.slice(0, Math.max(defaultSets, 1)).map((s) => ({
        reps: s.reps, weight: s.weight, done: false, kind: 'normal' as const, rpe: undefined,
      }))
    : Array.from({ length: defaultSets }, () => ({ reps: targetReps, weight: 20, done: false, kind: 'normal' as const }));
  if (!warmups || !working.length || working[0].weight <= 0) return working;
  const base = working[0].weight;
  const step = weightStep(unit);
  const warm = [0.5, 0.7].map((pct) => ({
    reps: 8,
    weight: fromDisplayWeight(roundTo(toDisplayWeight(base * pct, unit), step), unit),
    done: false,
    kind: 'warmup' as const,
  }));
  return [...warm, ...working];
}

export function makeSessionExercise(ex: Exercise, sessions: LoggedSession[], unit: Unit, sets?: number) {
  return {
    uid: `${ex.id}-${Math.random().toString(36).slice(2, 8)}`,
    id: ex.id,
    name: ex.name,
    primary: ex.primary,
    sets: openingSets(ex, sessions, unit, sets ?? 3),
    linkedNext: false,
  };
}

export interface PlateResult {
  perSide: { plate: number; count: number }[];
  achieved: number;
  leftover: number;
}

export function calculatePlates(totalKg: number, barKg: number, plates: number[], unit: Unit): PlateResult {
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
  const achievedDisplay = bar + out.reduce((n, x) => n + x.plate * x.count * 2, 0);
  return {
    perSide: out,
    achieved: fromDisplayWeight(achievedDisplay, unit),
    leftover: fromDisplayWeight(perSide * 2, unit),
  };
}

export function warmupRamp(workKg: number, unit: Unit): { pct: number; kg: number; reps: number }[] {
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
    kg: fromDisplayWeight(roundTo(toDisplayWeight(workKg * r.pct, unit), step), unit),
  }));
}

export function targetWeightForRpe(oneRmKg: number, reps: number, rpe: number): number | null {
  const index = (reps - 1) * 2 + Math.round((10 - rpe) * 2);
  const pct = [1, .978, .955, .939, .922, .907, .892, .878, .863, .85, .837, .824, .811, .799, .786, .774,
    .762, .751, .739, .723, .707, .694, .68, .667, .653, .64, .626, .613, .599, .586, .574][index];
  return pct ? oneRmKg * pct : null;
}

export function bmi(kg: number, heightCm: number): number {
  const m = heightCm / 100;
  return m > 0 ? kg / (m * m) : 0;
}

export function bmr(profile: { sex: string; age: number; heightCm: number; weightKg: number }): number {
  const base = 10 * profile.weightKg + 6.25 * profile.heightCm - 5 * profile.age;
  return Math.round(profile.sex === 'female' ? base - 161 : base + 5);
}

export function tdee(profile: { sex: string; age: number; heightCm: number; weightKg: number; activity: number }): number {
  return Math.round(bmr(profile) * profile.activity);
}

export function dotsScore(totalKg: number, bodyKg: number, sex: string): number {
  if (bodyKg <= 0 || totalKg <= 0) return 0;
  const c = sex === 'female'
    ? [-0.0000010706, 0.0005158568, -0.1126655495, 13.6175032, -57.96288]
    : [-0.0000010930, 0.0007391293, -0.1918759221, 24.0900756, -307.75076];
  const denom = c[0] * bodyKg ** 4 + c[1] * bodyKg ** 3 + c[2] * bodyKg ** 2 + c[3] * bodyKg + c[4];
  if (denom <= 0) return 0;
  return Math.round((totalKg / denom) * 500 * 10) / 10;
}
