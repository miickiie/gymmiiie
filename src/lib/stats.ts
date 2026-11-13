import { modeFor, loadKindFor } from './exerciseBehavior';
import { translateNow } from './i18n';
import {
  addDays,
  addDaysKey,
  dateKey,
  daysBetween,
  parseKey,
  sessionTrainingDate,
  startOfWeek,
  weekdayIndex,
} from './date';
import type {
  ActiveSession,
  AppData,
  BodyMeasure,
  LoggedExercise,
  LoggedSession,
  LoggedSet,
  MuscleId,
  PR,
  Routine,
  Unit,
} from '../types';

export const MUSCLES: {
  id: MuscleId;
  label: string;
  view: 'front' | 'back';
}[] = [
  { id: 'chest', label: 'Chest', view: 'front' },
  { id: 'shoulders', label: 'Shoulders', view: 'front' },
  { id: 'biceps', label: 'Biceps', view: 'front' },
  { id: 'abdomen', label: 'Abs', view: 'front' },
  { id: 'obliques', label: 'Obliques', view: 'front' },
  { id: 'quads', label: 'Quads', view: 'front' },
  { id: 'forearm', label: 'Forearms', view: 'front' },
  { id: 'trapezius', label: 'Traps', view: 'back' },
  { id: 'back', label: 'Back', view: 'back' },
  { id: 'lowerback', label: 'Lower back', view: 'back' },
  { id: 'triceps', label: 'Triceps', view: 'back' },
  { id: 'glutes', label: 'Glutes', view: 'back' },
  { id: 'hamstrings', label: 'Hamstrings', view: 'back' },
  { id: 'calves', label: 'Calves', view: 'back' },
];

export const MUSCLE_LABEL: Record<string, string> = Object.fromEntries(
  MUSCLES.map((m) => [m.id, m.label]),
);

export const BODY_ZONES: Record<string, MuscleId[]> = {
  Chest: ['chest'],
  Back: ['back', 'trapezius', 'lowerback'],
  Shoulders: ['shoulders'],
  Arms: ['biceps', 'triceps', 'forearm'],
  Core: ['abdomen', 'obliques'],
  Legs: ['quads', 'glutes', 'hamstrings', 'calves'],
};

export const MEASURE_KEYS = [
  { key: 'neck', label: 'Neck' },
  { key: 'shoulders', label: 'Shoulders' },
  { key: 'chest', label: 'Chest' },
  { key: 'arm', label: 'Arm' },
  { key: 'forearm', label: 'Forearm' },
  { key: 'waist', label: 'Waist' },
  { key: 'hips', label: 'Hips' },
  { key: 'thigh', label: 'Thigh' },
  { key: 'calf', label: 'Calf' },
  { key: 'bodyfat', label: 'Body fat %' },
];

export const KG_PER_LB = 0.45359237;

export function toDisplayWeight(kg: number, unit: Unit): number {
  return unit === 'lb' ? kg / KG_PER_LB : kg;
}

export function fromDisplayWeight(value: number, unit: Unit): number {
  return unit === 'lb' ? value * KG_PER_LB : value;
}

export function weightStep(unit: Unit): number {
  return unit === 'lb' ? 5 : 2.5;
}

/** Total lifted volume, converted to the user's unit, with thousands separators. */
export function volumeLabel(kg: number, unit: Unit = 'kg'): string {
  const v = toDisplayWeight(kg, unit);
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M ${unit}`;
  return `${Math.round(v).toLocaleString()} ${unit}`;
}

const RPE_TABLE = [
  1, 0.978, 0.955, 0.939, 0.922, 0.907, 0.892, 0.878, 0.863, 0.85, 0.837, 0.824,
  0.811, 0.799, 0.786, 0.774, 0.762, 0.751, 0.739, 0.723, 0.707, 0.694, 0.68,
  0.667, 0.653, 0.64, 0.626, 0.613, 0.599, 0.586, 0.574,
];

export function rpePercent(reps: number, rpe?: number): number | null {
  if (rpe == null || rpe < 6 || rpe > 10 || reps < 1 || reps > 12) return null;
  const i = (reps - 1) * 2 + Math.round((10 - rpe) * 2);
  return i < RPE_TABLE.length ? RPE_TABLE[i] : null;
}

export function oneRm(weight: number, reps: number, rpe?: number): number {
  if (reps <= 0 || weight <= 0) return 0;
  const pct = rpePercent(reps, rpe);
  return pct == null ? weight * (1 + reps / 30) : weight / pct;
}

export function isWorking(s: LoggedSet): boolean {
  return s.kind !== 'warmup';
}

export function workingSets(sets: LoggedSet[]): LoggedSet[] {
  return sets.filter(isWorking);
}

export function setVolume(s: LoggedSet): number {
  const reps =
    s.left != null && s.right != null ? Math.min(s.left, s.right) : s.reps;
  return reps * s.weight;
}

export function exerciseVolume(e: LoggedExercise): number {
  if (modeFor(e) || e.loadKind === 'assistance' || e.loadKind === 'none')
    return 0;
  return workingSets(e.sets).reduce((n, s) => n + setVolume(s), 0);
}

export function sessionVolume(s: LoggedSession): number {
  return s.exercises.reduce((n, e) => n + exerciseVolume(e), 0);
}

export function sessionSets(s: LoggedSession): number {
  return s.exercises.reduce((n, e) => n + workingSets(e.sets).length, 0);
}

export function sessionVolumeOfDay(
  sessions: LoggedSession[],
  day: string,
): number {
  return sessions
    .filter((s) => dateKey(s.date) === day)
    .reduce((n, s) => n + sessionVolume(s), 0);
}

export function sortedSessions(sessions: LoggedSession[]): LoggedSession[] {
  return [...sessions].sort(
    (a, b) => new Date(sessionTrainingDate(b)).getTime() - new Date(sessionTrainingDate(a)).getTime(),
  );
}

export function lastSetsFor(
  sessions: LoggedSession[],
  id: string,
): LoggedSet[] {
  const sorted = sortedSessions(sessions);
  for (const s of sorted) {
    const ex = s.exercises.find((e) => e.id === id);
    if (ex) {
      const working = workingSets(ex.sets);
      if (working.length) return working;
    }
  }
  return [];
}

export function exerciseHistory(
  sessions: LoggedSession[],
  id: string,
): { date: string; session: LoggedSession; ex: LoggedExercise }[] {
  return sortedSessions(sessions)
    .map((session) => ({
      session,
      ex: session.exercises.find((e) => e.id === id),
    }))
    .filter((x): x is { session: LoggedSession; ex: LoggedExercise } => !!x.ex)
    .map((x) => ({ date: x.session.date, session: x.session, ex: x.ex }));
}

type ExerciseEntry = { exercise: LoggedExercise; date: string };
const positive = (n: number | undefined): number =>
  Number.isFinite(n) && (n ?? 0) > 0 ? n! : 0;

function recordFromEntries(
  id: string,
  entries: ExerciseEntry[],
  name = '',
): PR | null {
  // Entries are newest first. Never mix distinct saved logging modes into a metric.
  const first = entries.find(({ exercise }) =>
    workingSets(exercise.sets).some((set) =>
      modeFor(exercise) === 'cardio'
        ? positive(set.km) || positive(set.sec)
        : modeFor(exercise) === 'time'
          ? positive(set.sec)
          : positive(set.reps),
    ),
  );
  if (!first) return null;
  const mode = modeFor(first.exercise);
  const matching = entries.filter(({ exercise }) => modeFor(exercise) === mode);
  const sets = matching.flatMap(({ exercise }) => workingSets(exercise.sets));
  if (mode === 'time')
    return {
      id,
      name: name || first.exercise.name,
      kind: 'time',
      best: Math.max(...sets.map((set) => positive(set.sec))),
      oneRm: 0,
    };
  if (mode === 'cardio') {
    const distance = Math.max(...sets.map((set) => positive(set.km)));
    return {
      id,
      name: name || first.exercise.name,
      kind: distance > 0 ? 'distance' : 'time',
      best: distance || Math.max(...sets.map((set) => positive(set.sec))),
      oneRm: 0,
    };
  }
  const repEntries = matching.flatMap(({ exercise }) =>
    workingSets(exercise.sets)
      .filter((set) => positive(set.reps))
      .map((set) => ({ set, load: loadKindFor(exercise) })),
  );
  if (!repEntries.length) return null;
  const loaded = repEntries.filter(
    ({ load }) => load !== 'none' && load !== 'assistance',
  );
  const weight = Math.max(0, ...loaded.map(({ set }) => positive(set.weight)));
  const oneRmBest = Math.max(
    0,
    ...loaded
      .filter(({ load }) => load == null || load === 'external')
      .map(({ set }) =>
        oneRm(positive(set.weight), positive(set.reps), set.rpe),
      ),
  );
  return {
    id,
    name: name || first.exercise.name,
    kind: weight > 0 ? 'weight' : 'reps',
    best:
      weight || Math.max(...repEntries.map(({ set }) => positive(set.reps))),
    oneRm: oneRmBest,
  };
}

export function bestSetFor(
  sessions: LoggedSession[],
  id: string,
): { set: LoggedSet; date: string; score: number } | null {
  const record = recordFor(sessions, id);
  if (!record) return null;
  let best: { set: LoggedSet; date: string; score: number } | null = null;
  const history = exerciseHistory(sessions, id);
  const targetMode = history.find((h) =>
    workingSets(h.ex.sets).some(
      (set) => positive(set.reps) || positive(set.sec) || positive(set.km),
    ),
  );
  for (const h of history) {
    if (targetMode && modeFor(h.ex) !== modeFor(targetMode.ex)) continue;
    for (const st of workingSets(h.ex.sets)) {
      const load = loadKindFor(h.ex);
      const score =
        record.kind === 'distance'
          ? positive(st.km)
          : record.kind === 'time'
            ? positive(st.sec)
            : record.kind === 'reps'
              ? positive(st.reps)
              : load === 'none' || load === 'assistance'
                ? 0
                : record.oneRm > 0 && (load == null || load === 'external')
                  ? oneRm(positive(st.weight), positive(st.reps), st.rpe)
                  : positive(st.weight);
      if (score > 0 && (!best || score > best.score))
        best = { set: st, date: h.date, score };
    }
  }
  return best;
}

export function personalRecords(sessions: LoggedSession[]): PR[] {
  const map = new Map<string, ExerciseEntry[]>();
  for (const session of sortedSessions(sessions)) {
    for (const exercise of session.exercises) {
      const entries = map.get(exercise.id) ?? [];
      entries.push({ exercise, date: session.date });
      map.set(exercise.id, entries);
    }
  }
  const records = [...map]
    .map(([id, entries]) => recordFromEntries(id, entries))
    .filter((record): record is PR => record !== null);
  return records.sort(
    (a, b) =>
      a.kind.localeCompare(b.kind) ||
      (a.kind === 'weight'
        ? b.oneRm - a.oneRm || b.best - a.best
        : b.best - a.best),
  );
}

export function recordFor(
  sessions: LoggedSession[],
  id: string,
  name = '',
): PR | null {
  return recordFromEntries(
    id,
    exerciseHistory(sessions, id).map((entry) => ({
      exercise: entry.ex,
      date: entry.date,
    })),
    name,
  );
}

export function workoutsThisWeek(data: AppData): number {
  const start = startOfWeek(new Date(), data.settings.weekStart);
  return data.sessions.filter((s) => new Date(s.date) >= start).length;
}

export function daysDoneThisWeek(data: AppData): number {
  const start = startOfWeek(new Date(), data.settings.weekStart);
  const days = new Set<string>();
  for (const s of data.sessions) {
    const d = new Date(s.date);
    if (d >= start) days.add(dateKey(d));
  }
  for (const c of data.checkins) if (parseKey(c) >= start) days.add(c);
  return days.size;
}

export function currentStreak(
  data: Pick<AppData, 'sessions' | 'checkins' | 'daysOff' | 'weekPlan'>,
): number {
  const trained = new Set(data.sessions.map((s) => dateKey(s.date)));
  for (const c of data.checkins) trained.add(c);
  if (!trained.size) return 0;
  const first = [...trained].sort()[0];
  const weeklyPlanEmpty = Object.keys(data.weekPlan).length === 0;
  let cursor = dateKey();
  if (!trained.has(cursor)) cursor = addDaysKey(cursor, -1);
  let n = 0;
  let gap = 0;
  while (daysBetween(first, cursor) >= 0) {
    if (trained.has(cursor)) {
      n++;
      gap = 0;
    } else {
      const d = parseKey(cursor);
      const rest =
        !!data.daysOff[cursor] ||
        (!weeklyPlanEmpty && data.weekPlan[String(d.getDay())] == null);
      if (!rest && ++gap > 0) break;
    }
    cursor = addDaysKey(cursor, -1);
  }
  return n;
}

export function totalVolume(sessions: LoggedSession[]): number {
  return sessions.reduce((n, s) => n + sessionVolume(s), 0);
}

export function totalSets(sessions: LoggedSession[]): number {
  return sessions.reduce((n, s) => n + sessionSets(s), 0);
}

export function heatmapLevels(sessions: LoggedSession[], days = 119): number[] {
  const loads = new Map<string, number>();
  for (const s of sessions) {
    const k = dateKey(s.date);
    loads.set(k, (loads.get(k) ?? 0) + s.durationSec + sessionSets(s) * 60);
  }
  const values = [...loads.values()].sort((a, b) => a - b);
  const max = values[values.length - 1] ?? 0;
  const levels: number[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const k = addDaysKey(dateKey(), -i);
    const load = loads.get(k) ?? 0;
    levels.push(
      load <= 0 ? 0 : Math.max(1, Math.ceil((load / (max || 1)) * 4)),
    );
  }
  return levels;
}

export function muscleSetsBetween(
  sessions: LoggedSession[],
  from: Date,
  to: Date,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const s of sessions) {
    const d = new Date(s.date);
    if (d < from || d > to) continue;
    for (const e of s.exercises) {
      const n = workingSets(e.sets).length;
      if (!n) continue;
      out[e.primary] = (out[e.primary] ?? 0) + n;
      for (const m of exercisesSecondary(e.id)) {
        out[m] = (out[m] ?? 0) + n / 2;
      }
    }
  }
  return out;
}

let secondaryCache: Map<string, string[]> | null = null;
export function setExerciseLookup(
  exercises: { id: string; secondary: string[] }[],
) {
  secondaryCache = new Map(exercises.map((e) => [e.id, e.secondary]));
}
export function exercisesSecondary(id: string): string[] {
  return secondaryCache?.get(id) ?? [];
}

export function oneRmSeries(
  sessions: LoggedSession[],
  id: string,
): { date: string; value: number }[] {
  return exerciseHistory(sessions, id)
    .map((h) => ({
      date: h.date,
      value:
        modeFor(h.ex) || (h.ex.loadKind != null && h.ex.loadKind !== 'external')
          ? 0
          : Math.max(
              0,
              ...workingSets(h.ex.sets).map((s) =>
                oneRm(s.weight, s.reps, s.rpe),
              ),
            ),
    }))
    .filter((p) => p.value > 0)
    .reverse();
}

export function weeklyVolume(
  sessions: LoggedSession[],
  weeks = 10,
): { label: string; value: number; sets: number }[] {
  const out: { label: string; value: number; sets: number }[] = [];
  const now = new Date();
  for (let i = weeks - 1; i >= 0; i--) {
    const start = startOfWeek(addDays(new Date(now), -i * 7), 1);
    const end = addDays(new Date(start), 7);
    const inWeek = sessions.filter((s) => {
      const d = new Date(s.date);
      return d >= start && d < end;
    });
    out.push({
      label: start.toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'short',
      }),
      value: totalVolume(inWeek),
      sets: totalSets(inWeek),
    });
  }
  return out;
}

export function dailyVolume(
  sessions: LoggedSession[],
  days = 30,
): { date: string; value: number }[] {
  return Array.from({ length: days }, (_, i) => {
    const key = addDaysKey(dateKey(), -(days - 1 - i));
    return { date: key, value: sessionVolumeOfDay(sessions, key) };
  });
}

export function activeElapsed(a: ActiveSession | null): number {
  if (!a) return 0;
  const now = Date.now();
  const pauseExtra = a.pausedAt ? now - a.pausedAt : 0;
  return Math.max(
    0,
    Math.floor(
      (now - a.startedAt - a.pausedTotalSec * 1000 - pauseExtra) / 1000,
    ),
  );
}

export function activeVolume(a: ActiveSession | null): number {
  if (!a) return 0;
  let kg = 0;
  for (const e of a.exercises) {
    if (modeFor(e) || e.loadKind === 'none' || e.loadKind === 'assistance')
      continue;
    for (const s of e.sets) {
      if (s.done && s.kind !== 'warmup') {
        const reps = s.repsR != null ? Math.min(s.reps, s.repsR) : s.reps;
        kg += reps * s.weight;
      }
    }
  }
  return kg;
}

export function routineForWeek(
  data: AppData,
  weekday = weekdayIndex(),
): Routine | null {
  const id = data.weekPlan[String(weekday)];
  return data.routines.find((r) => r.id === id) ?? null;
}

export function sessionPRCount(
  session: LoggedSession,
  prior: LoggedSession[],
): number {
  let count = 0;
  for (const exercise of session.exercises) {
    const after = recordFor([session], exercise.id);
    if (!after) continue;
    const before = recordFor(prior, exercise.id);
    const score = (record: PR) =>
      record.kind === 'weight' && record.oneRm > 0 ? record.oneRm : record.best;
    if (!before || before.kind !== after.kind || score(after) > score(before))
      count++;
  }
  return count;
}

export function levelFor(sessions: LoggedSession[]): {
  level: number;
  xp: number;
  next: number;
  progress: number;
} {
  const xp =
    Math.floor(totalVolume(sessions) / 100) +
    totalSets(sessions) * 2 +
    sessions.length * 15;
  let level = 1;
  let need = 100;
  let left = xp;
  while (left >= need) {
    left -= need;
    level++;
    need = Math.round(need * 1.25);
  }
  return { level, xp, next: need, progress: Math.round((left / need) * 100) };
}

export interface Award {
  id: string;
  name: string;
  detail: string;
  earned: boolean;
  progress: number;
}

export function awardsFor(
  sessions: LoggedSession[],
  streak: number,
  routines: Routine[],
): Award[] {
  const sets = totalSets(sessions);
  const tonnes = totalVolume(sessions) / 1000;
  const hours = sessions.reduce((n, s) => n + s.durationSec, 0) / 3600;
  const list: Award[] = [
    {
      id: 'firstWorkout',
      name: 'First rep',
      detail: 'Finish your first workout',
      earned: sessions.length >= 1,
      progress: Math.min(1, sessions.length),
    },
    {
      id: 'firstRoutine',
      name: 'Planner',
      detail: 'Create a routine',
      earned: routines.length >= 1,
      progress: Math.min(1, routines.length),
    },
    {
      id: 'streak3',
      name: 'On a roll',
      detail: '3 day streak',
      earned: streak >= 3,
      progress: Math.min(1, streak / 3),
    },
    {
      id: 'streak7',
      name: 'Week strong',
      detail: '7 day streak',
      earned: streak >= 7,
      progress: Math.min(1, streak / 7),
    },
    {
      id: 'workouts10',
      name: 'Ten deep',
      detail: '10 workouts',
      earned: sessions.length >= 10,
      progress: Math.min(1, sessions.length / 10),
    },
    {
      id: 'sets100',
      name: 'Century',
      detail: '100 working sets',
      earned: sets >= 100,
      progress: Math.min(1, sets / 100),
    },
    {
      id: 'tonne1',
      name: 'One tonne',
      detail: 'Lift 1,000 kg total',
      earned: tonnes >= 1,
      progress: Math.min(1, tonnes),
    },
    {
      id: 'hours10',
      name: 'Ten hours',
      detail: 'Train for 10 hours',
      earned: hours >= 10,
      progress: Math.min(1, hours / 10),
    },
    {
      id: 'workouts50',
      name: 'Regular',
      detail: '50 workouts',
      earned: sessions.length >= 50,
      progress: Math.min(1, sessions.length / 50),
    },
    {
      id: 'tonnes10',
      name: 'Ten tonnes',
      detail: 'Lift 10,000 kg total',
      earned: tonnes >= 10,
      progress: Math.min(1, tonnes / 10),
    },
    {
      id: 'streak30',
      name: 'Unbroken',
      detail: '30 day streak',
      earned: streak >= 30,
      progress: Math.min(1, streak / 30),
    },
    {
      id: 'sets1000',
      name: 'Thousand club',
      detail: '1,000 working sets',
      earned: sets >= 1000,
      progress: Math.min(1, sets / 1000),
    },
    {
      id: 'workouts100',
      name: 'Centurion',
      detail: '100 workouts',
      earned: sessions.length >= 100,
      progress: Math.min(1, sessions.length / 100),
    },
    {
      id: 'hours100',
      name: 'Hundred hours',
      detail: 'Train for 100 hours',
      earned: hours >= 100,
      progress: Math.min(1, hours / 100),
    },
    {
      id: 'tonnes100',
      name: 'Heavyweight',
      detail: 'Lift 100,000 kg total',
      earned: tonnes >= 100,
      progress: Math.min(1, tonnes / 100),
    },
  ];
  return list;
}

export function bodyMeasureSeries(
  measures: BodyMeasure[],
  key: string,
): { date: string; value: number }[] {
  return measures
    .filter((m) => m.key === key)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((m) => ({ date: m.date, value: m.value }));
}

export function latestMeasure(
  measures: BodyMeasure[],
  key: string,
): BodyMeasure | null {
  const s = measures
    .filter((m) => m.key === key)
    .sort((a, b) => b.date.localeCompare(a.date));
  return s[0] ?? null;
}

export function newId(prefix = ''): string {
  return (
    prefix +
    Math.random().toString(36).slice(2, 10) +
    Date.now().toString(36).slice(-4)
  );
}

export function setKindLabel(kind: string): string {
  switch (kind) {
    case 'warmup':
      return translateNow('Warm-up');
    case 'drop':
      return translateNow('Drop');
    case 'failure':
      return translateNow('Failure');
    case 'restPause':
      return translateNow('Rest-pause');
    case 'cluster':
      return translateNow('Cluster');
    default:
      return translateNow('Working');
  }
}
