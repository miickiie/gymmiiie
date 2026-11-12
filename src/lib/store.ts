import { create } from 'zustand';
import { produce, type Draft } from 'immer';
import type {
  ActiveSession,
  AppData,
  CustomFood,
  Exercise,
  GymPass,
  LoggedSession,
  MealEntry,
  Note,
  NutritionGoals,
  Profile,
  Routine,
  SessionExercise,
  SessionSet,
  Settings,
} from '../types';
import { dateKey, isoNow } from './date';
import {
  downloadFile,
  loadPersisted,
  loadRawPersisted,
  savePersisted,
  PersistenceConflictError,
  emptyAccountSync,
} from './db';
import { defaultData } from './defaults';
import { getLanguage } from './i18n';
import {
  AccountApiError,
  AccountSynchronizer,
  fetchAccountData,
  getRememberedAccount,
  isLocallySignedOut,
  markSessionExpired,
  rememberAccount,
  SESSION_EVENT_KEY,
  type Account,
  type CloudStatus,
} from './accounts';
import { parseBackup } from './backup';
import {
  clearPendingSnapshot,
  parsePendingSnapshot,
  readPendingSnapshot,
  writePendingSnapshot,
} from './pendingSnapshot';
import { activeElapsed, newId } from './stats';
import {
  EXERCISES,
  defaultPicks,
  isCompletableSet,
  makeSessionExercise,
  modeFor,
  openingSets,
} from './exercises';

export interface ProgramTemplate {
  id: string;
  name: string;
  detail: string;
  days: {
    name: string;
    weekday: number;
    exercises: { name: string; sets: number }[];
  }[];
}

export const PROGRAM_TEMPLATES: ProgramTemplate[] = [
  {
    id: 'fullbody',
    name: 'Full Body',
    detail: '3 days · squat, press, pull',
    days: [1, 3, 5].map((weekday, i) => ({
      name: `Full Body ${'ABC'[i] ?? i + 1}`,
      weekday,
      exercises: [
        { name: 'Barbell Full Squat', sets: 3 },
        { name: 'Barbell Bench Press', sets: 3 },
        { name: 'Barbell Bent Over Row', sets: 3 },
        { name: 'Barbell Seated Overhead Press', sets: 3 },
        { name: 'Barbell Romanian Deadlift', sets: 3 },
        { name: 'Plank', sets: 3 },
      ],
    })),
  },
  {
    id: 'ppl',
    name: 'Push Pull Legs',
    detail: '3 days · classic split',
    days: [
      {
        name: 'Push',
        weekday: 1,
        exercises: [
          { name: 'Barbell Bench Press', sets: 4 },
          { name: 'Dumbbell Incline Bench Press', sets: 3 },
          { name: 'Barbell Seated Overhead Press', sets: 3 },
          { name: 'Dumbbell Lateral Raise', sets: 3 },
          { name: 'V-Bar Triceps Pushdown', sets: 3 },
        ],
      },
      {
        name: 'Pull',
        weekday: 3,
        exercises: [
          { name: 'Pull-up', sets: 4 },
          { name: 'Barbell Bent Over Row', sets: 4 },
          { name: 'Wide-Grip Lat Pulldown', sets: 3 },
          { name: 'Face Pull', sets: 3 },
          { name: 'Barbell Curl', sets: 3 },
        ],
      },
      {
        name: 'Legs',
        weekday: 5,
        exercises: [
          { name: 'Barbell Full Squat', sets: 4 },
          { name: 'Barbell Romanian Deadlift', sets: 3 },
          { name: 'Leg Press', sets: 3 },
          { name: 'Lying Leg Curl', sets: 3 },
          { name: 'Barbell Standing Calf Raise', sets: 4 },
        ],
      },
    ],
  },
  {
    id: 'upperlower',
    name: 'Upper Lower',
    detail: '4 days · balanced',
    days: [
      {
        name: 'Upper A',
        weekday: 1,
        exercises: [
          { name: 'Barbell Bench Press', sets: 4 },
          { name: 'Barbell Bent Over Row', sets: 4 },
          { name: 'Barbell Seated Overhead Press', sets: 3 },
          { name: 'Wide-Grip Lat Pulldown', sets: 3 },
          { name: 'Barbell Curl', sets: 3 },
          { name: 'V-Bar Triceps Pushdown', sets: 3 },
        ],
      },
      {
        name: 'Lower A',
        weekday: 2,
        exercises: [
          { name: 'Barbell Full Squat', sets: 4 },
          { name: 'Barbell Romanian Deadlift', sets: 3 },
          { name: 'Leg Press', sets: 3 },
          { name: 'Lying Leg Curl', sets: 3 },
          { name: 'Barbell Standing Calf Raise', sets: 4 },
        ],
      },
      {
        name: 'Upper B',
        weekday: 4,
        exercises: [
          { name: 'Dumbbell Incline Bench Press', sets: 4 },
          { name: 'Pull-up', sets: 4 },
          { name: 'Dumbbell Lateral Raise', sets: 4 },
          { name: 'Cable Seated Row', sets: 3 },
          { name: 'Dumbbell Hammer Curl', sets: 3 },
          { name: 'Barbell Lying Triceps Extension', sets: 3 },
        ],
      },
      {
        name: 'Lower B',
        weekday: 5,
        exercises: [
          { name: 'Barbell Front Squat', sets: 3 },
          { name: 'Leg Press', sets: 4 },
          { name: 'Leg Extension', sets: 3 },
          { name: 'Lying Leg Curl', sets: 3 },
          { name: 'Barbell Seated Calf Raise', sets: 4 },
        ],
      },
    ],
  },
  {
    id: 'arnold',
    name: 'Arnold Split',
    detail: '6 days · chest & back / shoulders & arms / legs',
    days: [
      {
        name: 'Chest & Back',
        weekday: 1,
        exercises: [
          { name: 'Barbell Bench Press', sets: 4 },
          { name: 'Dumbbell Incline Bench Press', sets: 3 },
          { name: 'Flat Bench Cable Fly', sets: 3 },
          { name: 'Pull-up', sets: 4 },
          { name: 'Barbell Bent Over Row', sets: 4 },
          { name: 'Cable Seated Row', sets: 3 },
        ],
      },
      {
        name: 'Shoulders & Arms',
        weekday: 2,
        exercises: [
          { name: 'Barbell Seated Overhead Press', sets: 4 },
          { name: 'Dumbbell Lateral Raise', sets: 4 },
          { name: 'Face Pull', sets: 3 },
          { name: 'Barbell Curl', sets: 3 },
          { name: 'Dumbbell Hammer Curl', sets: 3 },
          { name: 'Barbell Lying Triceps Extension', sets: 3 },
          { name: 'V-Bar Triceps Pushdown', sets: 3 },
        ],
      },
      {
        name: 'Legs',
        weekday: 3,
        exercises: [
          { name: 'Barbell Full Squat', sets: 4 },
          { name: 'Barbell Romanian Deadlift', sets: 3 },
          { name: 'Leg Press', sets: 3 },
          { name: 'Leg Extension', sets: 3 },
          { name: 'Lying Leg Curl', sets: 3 },
          { name: 'Barbell Standing Calf Raise', sets: 4 },
        ],
      },
      {
        name: 'Chest & Back',
        weekday: 4,
        exercises: [
          { name: 'Barbell Bench Press', sets: 4 },
          { name: 'Dumbbell Incline Bench Press', sets: 3 },
          { name: 'Flat Bench Cable Fly', sets: 3 },
          { name: 'Pull-up', sets: 4 },
          { name: 'Barbell Bent Over Row', sets: 4 },
          { name: 'Cable Seated Row', sets: 3 },
        ],
      },
      {
        name: 'Shoulders & Arms',
        weekday: 5,
        exercises: [
          { name: 'Barbell Seated Overhead Press', sets: 4 },
          { name: 'Dumbbell Lateral Raise', sets: 4 },
          { name: 'Face Pull', sets: 3 },
          { name: 'Barbell Curl', sets: 3 },
          { name: 'Dumbbell Hammer Curl', sets: 3 },
          { name: 'Barbell Lying Triceps Extension', sets: 3 },
          { name: 'V-Bar Triceps Pushdown', sets: 3 },
        ],
      },
      {
        name: 'Legs',
        weekday: 6,
        exercises: [
          { name: 'Barbell Full Squat', sets: 4 },
          { name: 'Barbell Romanian Deadlift', sets: 3 },
          { name: 'Leg Press', sets: 3 },
          { name: 'Leg Extension', sets: 3 },
          { name: 'Lying Leg Curl', sets: 3 },
          { name: 'Barbell Standing Calf Raise', sets: 4 },
        ],
      },
    ],
  },
];

export { defaultData } from './defaults';

export type StartResult = {
  status: 'started' | 'active-exists' | 'not-found' | 'read-only';
};
export type FinishResult =
  | { status: 'saved'; id: string }
  | { status: 'empty' }
  | { status: 'error'; message: string };
export type PersistenceStatus =
  'loading' | 'idle' | 'saving' | 'error' | 'conflict';

interface Store {
  data: AppData;
  account: Account | null;
  accountMode: 'locked' | 'online' | 'offline';
  cloudStatus: CloudStatus;
  cloudError: string | null;
  activateAccount: (
    account: Account,
    options?: { offline?: boolean },
  ) => Promise<void>;
  deactivateAccount: () => Promise<void>;
  flushAccountSync: () => Promise<void>;
  reloadAccountData: () => Promise<void>;
  previewLegacyDeviceData: () => Promise<AppData | null>;
  importLegacyDeviceData: () => Promise<void>;
  hydrated: boolean;
  lastFinishedId: string | null;
  persistenceStatus: PersistenceStatus;
  persistenceError: string | null;
  isCommitting: boolean;
  flushPersistence: () => Promise<void>;
  retryPersistence: () => Promise<void>;
  reloadPersisted: () => Promise<void>;
  recoveryExport: () => Promise<void>;
  hydrate: () => Promise<void>;
  update: (fn: (d: Draft<AppData>) => void) => void;
  completeOnboarding: (profile: Partial<Profile>) => void;
  setProfile: (p: Partial<Profile>) => void;
  setSettings: (s: Partial<Settings>) => void;
  setNutritionGoals: (g: Partial<NutritionGoals>) => void;
  startFromMuscles: (muscles: string[]) => StartResult;
  startFromExercises: (ids: string[], name?: string) => StartResult;
  startFromRoutine: (routineId: string) => StartResult;
  startEmpty: () => StartResult;
  addExerciseToSession: (exerciseId: string) => void;
  removeSessionExercise: (uid: string) => void;
  replaceSessionExercise: (uid: string, exerciseId: string) => void;
  updateSet: (uid: string, index: number, patch: Partial<SessionSet>) => void;
  toggleSet: (uid: string, index: number) => boolean;
  addSet: (uid: string) => void;
  removeSet: (uid: string, index: number) => void;
  setCurrentExercise: (index: number) => void;
  moveSessionExercise: (from: number, to: number) => void;
  setSessionName: (name: string) => void;
  toggleSessionPause: () => void;
  startRest: (seconds?: number) => void;
  skipRest: () => void;
  nudgeRest: (seconds: number) => void;
  finishSession: () => Promise<FinishResult>;
  discardSession: () => void;
  deleteSession: (id: string) => void;
  startFromSession: (id: string) => StartResult;
  createRoutine: (r: Omit<Routine, 'id' | 'createdAt'>) => string;
  updateRoutine: (id: string, patch: Partial<Routine>) => void;
  deleteRoutine: (id: string) => void;
  addTemplate: (templateId: string) => string[];
  setWeekPlan: (weekday: number, routineId: string | null) => void;
  toggleFavorite: (id: string) => void;
  toggleArchived: (id: string) => void;
  addCustomExercise: (e: Exercise) => void;
  deleteCustomExercise: (id: string) => void;
  saveNote: (n: Omit<Note, 'id' | 'createdAt'> & { id?: string }) => void;
  deleteNote: (id: string) => void;
  addBodyweight: (kg: number, day?: string, note?: string) => void;
  deleteBodyweight: (day: string) => void;
  addMeasure: (key: string, value: number, day?: string) => void;
  deleteMeasure: (id: string) => void;
  addMealEntry: (entry: Omit<MealEntry, 'id' | 'createdAt'>) => void;
  deleteMealEntry: (id: string) => void;
  addWater: (ml: number, day?: string) => void;
  setWater: (ml: number, day?: string) => void;
  addCustomFood: (food: Omit<CustomFood, 'id'>) => CustomFood;
  toggleDayOff: (day: string, reason: string | null) => void;
  toggleCheckin: (day: string) => void;
  addPass: (pass: Omit<GymPass, 'id'>) => void;
  deletePass: (id: string) => void;
  replaceData: (data: unknown) => Promise<void>;
  resetAll: () => Promise<void>;
}

function recalcActive(data: AppData) {
  if (!data.active) return;
  data.active.exercises.forEach((e) => {
    if (!e.sets.length) {
      const mode = modeFor(e);
      e.sets.push({
        reps: mode ? 0 : 10,
        weight: 0,
        done: false,
        kind: 'normal',
        ...(mode ? { sec: mode === 'cardio' ? 0 : 30 } : {}),
        ...(mode === 'cardio' ? { km: 0 } : {}),
      });
    }
  });
  data.active.currentIndex = Math.max(
    0,
    Math.min(data.active.currentIndex, data.active.exercises.length - 1),
  );
}

function makeActive(
  exercises: SessionExercise[],
  routineId?: string,
): ActiveSession {
  return {
    id: newId('s'),
    startedAt: Date.now(),
    exercises,
    currentIndex: 0,
    pausedTotalSec: 0,
    routineId,
  };
}

let activeAccountId: string | undefined;
let accountEpoch = 0;
let synchronizer: AccountSynchronizer | null = null;
let accountTransition: Promise<void> = Promise.resolve();
let savedRevision = 0;
let lastPersistedData: AppData | null = null;
let recoveryData: unknown;
let savePromise: Promise<void> | null = null;
let suppressPersistence = false;
let inFlightToken: string | undefined;
let pendingCommitData: AppData | null = null;

// Edits arrive per keystroke. Coalesce the journal write and IndexedDB
// transaction so typing stays smooth; unload/visibility handlers still flush
// synchronously before the page goes away.
const PERSIST_DELAY_MS = 350;
let persistTimer: ReturnType<typeof setTimeout> | null = null;

function cancelScheduledPersist() {
  if (persistTimer !== null) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
}

function schedulePersist() {
  cancelScheduledPersist();
  persistTimer = setTimeout(() => {
    persistTimer = null;
    journalLatest();
    void flushQueued().catch(() => undefined);
  }, PERSIST_DELAY_MS);
}

function invalidNumbers(
  patch: object,
  keys: readonly string[],
  positive = false,
): boolean {
  const values = patch as Record<string, unknown>;
  return keys.some(
    (key) =>
      key in values &&
      (typeof values[key] !== 'number' ||
        !Number.isFinite(values[key]) ||
        (positive
          ? (values[key] as number) <= 0
          : (values[key] as number) < 0)),
  );
}

const PROFILE_NUMBERS = ['age', 'heightCm', 'weightKg', 'activity'] as const;

export const useStore = create<Store>((set, get) => ({
  data: defaultData(),
  account: null,
  accountMode: 'locked',
  cloudStatus: 'idle',
  cloudError: null,
  activateAccount: (account, options) =>
    transitionAccount(() =>
      activateAccountContext(account, options?.offline ?? false),
    ),
  deactivateAccount: () => transitionAccount(() => deactivateAccountContext()),
  flushAccountSync: async () => {
    const epoch = accountEpoch,
      sync = synchronizer;
    await flushQueued();
    if (epoch !== accountEpoch)
      throw new Error(
        'The active account changed. Retry from the current profile.',
      );
    await sync?.flush(true);
    if (epoch !== accountEpoch)
      throw new Error(
        'The active account changed. Retry from the current profile.',
      );
    const current = get();
    if (current.cloudStatus === 'conflict')
      throw new AccountApiError(
        409,
        'revision_conflict',
        current.cloudError ?? 'Resolve the cloud conflict before continuing.',
      );
    if (current.cloudStatus === 'session-expired')
      throw new AccountApiError(
        401,
        'session_required',
        'Sign in again before synchronizing this account.',
      );
    if (!sync || current.cloudStatus !== 'idle')
      throw new Error(
        current.cloudError ?? 'Some changes are still waiting to synchronize.',
      );
  },
  reloadAccountData: () => reloadCloudProfile(),
  previewLegacyDeviceData: async () => {
    const raw = await loadRawPersisted();
    return raw == null ? null : parseBackup(raw);
  },
  importLegacyDeviceData: async () => {
    const scope = activeAccountId,
      epoch = accountEpoch;
    if (!scope)
      throw new Error('Sign in before importing a previous device log.');
    const legacy = await get().previewLegacyDeviceData();
    if (scope !== activeAccountId || epoch !== accountEpoch)
      throw new Error(
        'The active account changed. Review the previous device log again before importing.',
      );
    if (!legacy) throw new Error('No previous device log was found.');
    await get().replaceData(legacy);
  },
  hydrated: false,
  lastFinishedId: null,

  persistenceStatus: 'loading',
  persistenceError: null,
  isCommitting: false,
  hydrate: () => hydrateFromDisk(false),
  reloadPersisted: () => hydrateFromDisk(true, true),
  flushPersistence: () => flushQueued(),
  retryPersistence: async () => {
    if (!get().hydrated) await hydrateFromDisk(true);
    else await flushQueued();
  },
  recoveryExport: async () => {
    let snapshot: unknown = get().hydrated ? get().data : recoveryData;
    if (snapshot === undefined)
      snapshot = await loadRawPersisted(activeAccountId);
    if (snapshot === undefined)
      throw new Error(
        'No stored log could be read. Retry when browser storage is available.',
      );
    downloadFile(
      `gymmiie-recovery-${dateKey()}.json`,
      JSON.stringify(snapshot, null, 2),
    );
  },
  update: (fn) => {
    if (!canMutate(get())) return;
    set((s) => ({ data: produce(s.data, fn) }));
  },

  completeOnboarding: (profile) =>
    get().update((d) => {
      if (invalidNumbers(profile, PROFILE_NUMBERS, true)) return;
      Object.assign(d.profile, profile);
      d.onboarded = true;
      if (!d.profile.since) d.profile.since = isoNow();
    }),

  setProfile: (p) =>
    get().update((d) => {
      if (invalidNumbers(p, PROFILE_NUMBERS, true)) return;
      Object.assign(d.profile, p);
    }),

  setSettings: (s) =>
    get().update((d) => {
      if (invalidNumbers(s, ['restSec', 'miniRestSec', 'barWeight'])) return;
      if (
        s.weeklyGoal !== undefined &&
        (!Number.isInteger(s.weeklyGoal) ||
          s.weeklyGoal < 1 ||
          s.weeklyGoal > 7)
      )
        return;
      if (s.weekStart !== undefined && ![0, 1, 6].includes(s.weekStart)) return;
      if (
        s.plates !== undefined &&
        (!Array.isArray(s.plates) ||
          s.plates.some((p) => !Number.isFinite(p) || p <= 0))
      )
        return;
      Object.assign(d.settings, s);
    }),

  setNutritionGoals: (g) =>
    get().update((d) => {
      if (
        invalidNumbers(g, [
          'kcal',
          'protein',
          'carbs',
          'fat',
          'waterMl',
          'glassMl',
          'fiber',
        ])
      )
        return;
      if (g.glassMl !== undefined && g.glassMl <= 0) return;
      Object.assign(d.nutrition.goals, g);
      d.nutrition.goalsSet = true;
    }),

  startFromMuscles: (muscles) => {
    const blocked = startBlocked(get());
    if (blocked) return blocked;
    const { data } = get();
    const picks = defaultPicks(
      allExercisesFor(data),
      data.sessions,
      muscles,
      data.favorites,
      8,
      data.archived,
    );
    if (!picks.length) return { status: 'not-found' };
    return get().startFromExercises(picks.map((e) => e.id));
  },

  startFromExercises: (ids, name) => {
    const blocked = startBlocked(get());
    if (blocked) return blocked;
    const { data } = get(),
      all = allExercisesFor(data);
    const exercises = [...new Set(ids)]
      .map((id) => all.find((e) => e.id === id))
      .filter((e): e is Exercise => !!e)
      .map((e) => makeSessionExercise(e, data.sessions, data.settings.unit));
    if (ids.length && !exercises.length) return { status: 'not-found' };
    const active = makeActive(exercises);
    active.name = name;
    get().update((d) => {
      d.active = active;
    });
    return { status: 'started' };
  },

  startFromRoutine: (routineId) => {
    const blocked = startBlocked(get());
    if (blocked) return blocked;
    const { data } = get();
    const routine = data.routines.find((r) => r.id === routineId);
    if (!routine) return { status: 'not-found' };
    const all = allExercisesFor(data);
    const exercises: SessionExercise[] = [];
    for (const id of routine.exerciseIds) {
      const ex = all.find((e) => e.id === id);
      if (!ex) continue;
      const item = makeSessionExercise(
        ex,
        data.sessions,
        data.settings.unit,
        routine.sets[id] ?? 3,
      );
      if (routine.rest[id] !== undefined)
        item.sets.forEach((set) => {
          set.rest = routine.rest[id];
        });
      exercises.push(item);
    }
    if (!exercises.length) return { status: 'not-found' };
    const active = makeActive(exercises, routineId);
    active.name = routine.name;
    get().update((d) => {
      d.active = active;
    });
    return { status: 'started' };
  },

  startEmpty: () => get().startFromExercises([]),

  addExerciseToSession: (exerciseId) => {
    const { data } = get();
    const ex = allExercisesFor(get().data).find((e) => e.id === exerciseId);
    if (!ex || data.active?.pausedAt) return;
    get().update((d) => {
      if (!d.active || d.active.pausedAt) return;
      if (d.active.exercises.some((e) => e.id === exerciseId)) return;
      d.active.exercises.push(
        makeSessionExercise(ex, data.sessions, d.settings.unit),
      );
    });
  },

  removeSessionExercise: (uid) =>
    get().update((d) => {
      if (!d.active || d.active.pausedAt) return;
      const selected = d.active.exercises[d.active.currentIndex]?.uid;
      d.active.exercises = d.active.exercises.filter((e) => e.uid !== uid);
      const selectedIndex = d.active.exercises.findIndex(
        (e) => e.uid === selected,
      );
      if (selectedIndex >= 0) d.active.currentIndex = selectedIndex;
      recalcActive(d);
    }),

  replaceSessionExercise: (uid, exerciseId) => {
    const { data } = get();
    const ex = allExercisesFor(get().data).find((e) => e.id === exerciseId);
    if (!ex || data.active?.pausedAt) return;
    get().update((d) => {
      if (!d.active || d.active.pausedAt) return;
      const target = d.active.exercises.find((e) => e.uid === uid);
      if (!target) return;
      target.swappedFrom = target.id;
      target.id = ex.id;
      target.name = ex.name;
      target.primary = ex.primary;
      const snapshot = makeSessionExercise(ex, data.sessions, d.settings.unit);
      target.mode = snapshot.mode;
      target.loadKind = snapshot.loadKind;
      delete target.weightUnit;
      target.sets = openingSets(ex, data.sessions, d.settings.unit);
    });
  },

  updateSet: (uid, index, patch) =>
    get().update((d) => {
      if (d.active?.pausedAt) return;
      const ex = d.active?.exercises.find((e) => e.uid === uid);
      const st = ex?.sets[index];
      if (st) {
        for (const key of [
          'reps',
          'repsR',
          'weight',
          'sec',
          'km',
          'rest',
          'rpe',
        ] as const) {
          const value = patch[key];
          if (
            value !== undefined &&
            (!Number.isFinite(value) ||
              value < 0 ||
              (key === 'rpe' && value > 10))
          )
            return;
        }
        Object.assign(st, patch);
      }
    }),

  toggleSet: (uid, index) => {
    const { data } = get();
    if (!canMutate(get()) || data.active?.pausedAt) return false;
    const ex = data.active?.exercises.find((e) => e.uid === uid);
    const st = ex?.sets[index];
    if (!st) return false;
    const becomingDone = !st.done;
    if (becomingDone && !isCompletableSet(modeFor(ex!), st)) return false;
    get().update((d) => {
      const target = d.active?.exercises.find((e) => e.uid === uid);
      if (target?.sets[index]) target.sets[index].done = becomingDone;
    });
    if (becomingDone && data.settings.autoRest) {
      const sec = st.rest ?? data.settings.restSec;
      get().startRest(sec);
    }
    return becomingDone;
  },

  addSet: (uid) =>
    get().update((d) => {
      if (d.active?.pausedAt) return;
      const ex = d.active?.exercises.find((e) => e.uid === uid);
      if (!ex) return;
      const last = ex.sets[ex.sets.length - 1];
      ex.sets.push(
        last
          ? {
              reps: last.reps,
              weight: last.weight,
              done: false,
              kind: last.kind,
              sec: last.sec,
              km: last.km,
              repsR: last.repsR,
              rest: last.rest,
            }
          : { reps: 10, weight: 0, done: false, kind: 'normal' },
      );
    }),

  removeSet: (uid, index) =>
    get().update((d) => {
      if (d.active?.pausedAt) return;
      const ex = d.active?.exercises.find((e) => e.uid === uid);
      if (!ex || ex.sets.length <= 1) return;
      ex.sets.splice(index, 1);
    }),

  setCurrentExercise: (index) =>
    get().update((d) => {
      if (!d.active || d.active.pausedAt || !Number.isFinite(index)) return;
      d.active.currentIndex = Math.max(
        0,
        Math.min(Math.floor(index), d.active.exercises.length - 1),
      );
    }),

  moveSessionExercise: (from, to) =>
    get().update((d) => {
      if (!d.active || d.active.pausedAt) return;
      const list = d.active.exercises;
      if (from < 0 || from >= list.length) return;
      const selected = list[d.active.currentIndex]?.uid;
      const [item] = list.splice(from, 1);
      list.splice(Math.max(0, Math.min(to, list.length)), 0, item);
      d.active.currentIndex = Math.max(
        0,
        list.findIndex((e) => e.uid === selected),
      );
    }),

  setSessionName: (name) =>
    get().update((d) => {
      if (d.active) d.active.name = name;
    }),

  toggleSessionPause: () =>
    get().update((d) => {
      const a = d.active;
      if (!a) return;
      if (a.pausedAt) {
        a.pausedTotalSec += (Date.now() - a.pausedAt) / 1000;
        a.pausedAt = undefined;
        if (a.restFrozen !== undefined) {
          a.restEndsAt = Date.now() + a.restFrozen * 1000;
          a.restFrozen = undefined;
        }
      } else {
        a.pausedAt = Date.now();
        if (a.restEndsAt) {
          a.restFrozen = Math.max(
            0,
            Math.ceil((a.restEndsAt - Date.now()) / 1000),
          );
          a.restEndsAt = undefined;
        }
      }
    }),

  startRest: (seconds) =>
    get().update((d) => {
      const a = d.active;
      if (!a || a.pausedAt) return;
      const sec = seconds ?? d.settings.restSec;
      if (!Number.isFinite(sec) || !Number.isFinite(Date.now() + sec * 1000))
        return;
      if (sec <= 0) {
        a.restEndsAt = undefined;
        a.restFrozen = undefined;
        return;
      }
      a.restTotal = sec;
      a.restEndsAt = Date.now() + sec * 1000;
    }),

  skipRest: () =>
    get().update((d) => {
      if (!d.active || d.active.pausedAt) return;
      d.active.restEndsAt = undefined;
      d.active.restFrozen = undefined;
    }),

  nudgeRest: (seconds) =>
    get().update((d) => {
      const a = d.active;
      if (!a || a.pausedAt || !Number.isFinite(seconds)) return;
      if (a.restFrozen) a.restFrozen = Math.max(5, a.restFrozen + seconds);
      else if (a.restEndsAt) {
        const left = (a.restEndsAt - Date.now()) / 1000;
        const next = Date.now() + Math.max(5, left + seconds) * 1000;
        if (Number.isFinite(next)) a.restEndsAt = next;
      }
    }),

  finishSession: async () => {
    set({ lastFinishedId: null });
    const { data } = get(),
      a = data.active;
    if (!a) return { status: 'empty' };
    if (!canMutate(get()))
      return {
        status: 'error',
        message: 'Resolve storage recovery before finishing this workout.',
      };
    const exercises = a.exercises
      .map((e) => ({
        id: e.id,
        name: e.name,
        primary: e.primary,
        mode: e.mode,
        loadKind: e.loadKind,
        sets: e.sets
          .filter((s) => s.done)
          .map((s) => ({
            reps: s.repsR != null ? Math.min(s.reps, s.repsR) : s.reps,
            weight: s.weight,
            kind: s.kind,
            rpe: s.rpe,
            sec: s.sec,
            km: s.km,
            note: s.note,
            left: s.repsR != null ? s.reps : undefined,
            right: s.repsR,
          })),
      }))
      .filter((e) => e.sets.length > 0);
    const session: LoggedSession | null = exercises.length
      ? {
          id: newId('w'),
          date: isoNow(),
          durationSec: Math.max(1, activeElapsed(a)),
          exercises,
          routineId: a.routineId,
          name: a.name,
          deload: a.deload,
        }
      : null;
    const next = produce(data, (d) => {
      d.active = null;
      if (session) {
        d.sessions.push(session);
        d.checkins = d.checkins.filter((c) => c !== dateKey(session.date));
        if (!d.profile.since) d.profile.since = isoNow();
      }
    });
    try {
      await commitData(next);
      if (!session) return { status: 'empty' };
      set({ lastFinishedId: session.id });
      return { status: 'saved', id: session.id };
    } catch (error) {
      return { status: 'error', message: errorMessage(error) };
    }
  },

  discardSession: () => {
    if (!canMutate(get())) return;
    get().update((d) => {
      d.active = null;
    });
    set({ lastFinishedId: null });
  },

  deleteSession: (id) =>
    get().update((d) => {
      d.sessions = d.sessions.filter((s) => s.id !== id);
    }),

  startFromSession: (id) => {
    const blocked = startBlocked(get());
    if (blocked) return blocked;
    const { data } = get();
    const session = data.sessions.find((s) => s.id === id);
    if (!session) return { status: 'not-found' };
    if (!session.exercises.length) return { status: 'not-found' };
    const exercises: SessionExercise[] = session.exercises.map((e) => ({
      uid: `${e.id}-${Math.random().toString(36).slice(2, 8)}`,
      id: e.id,
      name: e.name,
      primary: e.primary,
      mode: modeFor(e),
      loadKind: e.loadKind,
      sets: e.sets.map((s) => ({
        reps: s.left ?? s.reps,
        repsR: s.left != null && s.right != null ? s.right : undefined,
        weight: s.weight,
        done: false,
        kind: s.kind === 'warmup' ? 'warmup' : 'normal',
        sec: s.sec,
        km: s.km,
      })),
      linkedNext: false,
    }));
    const active = makeActive(exercises, session.routineId);
    active.name = session.name ? `${session.name} · repeat` : 'Repeat workout';
    get().update((d) => {
      d.active = active;
    });
    return { status: 'started' };
  },

  createRoutine: (r) => {
    const id = newId('r');
    get().update((d) => {
      d.routines.push({ ...r, id, createdAt: isoNow() });
    });
    return id;
  },

  updateRoutine: (id, patch) =>
    get().update((d) => {
      const r = d.routines.find((x) => x.id === id);
      if (r) Object.assign(r, patch);
    }),

  deleteRoutine: (id) =>
    get().update((d) => {
      d.routines = d.routines.filter((r) => r.id !== id);
      for (const k of Object.keys(d.weekPlan))
        if (d.weekPlan[k] === id) delete d.weekPlan[k];
    }),

  addTemplate: (templateId) => {
    if (!canMutate(get())) return [];
    const tpl = PROGRAM_TEMPLATES.find((t) => t.id === templateId);
    if (!tpl) return [];
    const all = allExercisesFor(get().data);
    const nameToId = new Map<string, string>();
    for (const e of all) nameToId.set(e.name.toLowerCase(), e.id);
    const created: string[] = [];
    for (const day of tpl.days) {
      const exerciseIds: string[] = [];
      const sets: Record<string, number> = {};
      for (const item of day.exercises) {
        const id = nameToId.get(item.name.toLowerCase());
        if (id) {
          exerciseIds.push(id);
          sets[id] = item.sets;
        }
      }
      if (!exerciseIds.length) continue;
      const id = newId('r');
      created.push(id);
      const routineName = day.name
        .toLowerCase()
        .startsWith(tpl.name.toLowerCase())
        ? day.name
        : `${tpl.name} · ${day.name}`;
      get().update((d) => {
        d.routines.push({
          id,
          name: routineName,
          exerciseIds,
          sets,
          rest: {},
          createdAt: isoNow(),
        });
        d.weekPlan[String(day.weekday)] = id;
      });
    }
    return created;
  },

  setWeekPlan: (weekday, routineId) =>
    get().update((d) => {
      if (routineId) d.weekPlan[String(weekday)] = routineId;
      else delete d.weekPlan[String(weekday)];
    }),

  toggleFavorite: (id) =>
    get().update((d) => {
      if (d.favorites[id]) delete d.favorites[id];
      else d.favorites[id] = true;
    }),

  toggleArchived: (id) =>
    get().update((d) => {
      if (d.archived.includes(id))
        d.archived = d.archived.filter((x) => x !== id);
      else d.archived.push(id);
    }),

  addCustomExercise: (e) =>
    get().update((d) => {
      if (!d.customExercises.some((x) => x.id === e.id))
        d.customExercises.push(e);
    }),

  deleteCustomExercise: (id) =>
    get().update((d) => {
      d.customExercises = d.customExercises.filter((e) => e.id !== id);
      d.archived = d.archived.filter((x) => x !== id);
      delete d.favorites[id];
      for (const routine of d.routines) {
        routine.exerciseIds = routine.exerciseIds.filter(
          (exerciseId) => exerciseId !== id,
        );
        delete routine.sets[id];
        delete routine.rest[id];
      }
    }),

  saveNote: (n) =>
    get().update((d) => {
      if (n.id) {
        const existing = d.notes.find((x) => x.id === n.id);
        if (existing) Object.assign(existing, n);
      } else {
        d.notes.unshift({ ...n, id: newId('n'), createdAt: isoNow() });
      }
    }),

  deleteNote: (id) =>
    get().update((d) => {
      d.notes = d.notes.filter((n) => n.id !== id);
    }),

  addBodyweight: (kg, day = dateKey(), note = '') =>
    get().update((d) => {
      if (!Number.isFinite(kg) || kg <= 0) return;
      const existing = d.bodyweights.find((b) => b.date === day);
      if (existing) {
        existing.kg = kg;
        existing.note = note;
      } else d.bodyweights.push({ date: day, kg, note });
      d.bodyweights.sort((a, b) => a.date.localeCompare(b.date));
      d.profile.weightKg = kg;
    }),

  deleteBodyweight: (day) =>
    get().update((d) => {
      d.bodyweights = d.bodyweights.filter((b) => b.date !== day);
    }),

  addMeasure: (key, value, day = dateKey()) =>
    get().update((d) => {
      if (!key.trim() || !Number.isFinite(value) || value <= 0) return;
      const existing = d.measures.find((m) => m.key === key && m.date === day);
      if (existing) existing.value = value;
      else d.measures.push({ id: newId('m'), key, date: day, value });
    }),

  deleteMeasure: (id) =>
    get().update((d) => {
      d.measures = d.measures.filter((m) => m.id !== id);
    }),

  addMealEntry: (entry) =>
    get().update((d) => {
      if (
        !Number.isFinite(entry.grams) ||
        entry.grams <= 0 ||
        ![
          entry.kcal,
          entry.protein,
          entry.carbs,
          entry.fat,
          entry.fiber ?? 0,
          entry.sugar ?? 0,
          entry.sodium ?? 0,
        ].every((n) => Number.isFinite(n) && n >= 0)
      )
        return;
      d.nutrition.entries.push({
        ...entry,
        id: newId('e'),
        createdAt: isoNow(),
      });
    }),

  deleteMealEntry: (id) =>
    get().update((d) => {
      d.nutrition.entries = d.nutrition.entries.filter((e) => e.id !== id);
    }),

  addWater: (ml, day = dateKey()) =>
    get().update((d) => {
      if (!Number.isFinite(ml)) return;
      d.nutrition.water[day] = Math.max(0, (d.nutrition.water[day] ?? 0) + ml);
    }),

  setWater: (ml, day = dateKey()) =>
    get().update((d) => {
      if (!Number.isFinite(ml) || ml < 0) return;
      d.nutrition.water[day] = Math.max(0, ml);
    }),

  addCustomFood: (food) => {
    if (
      !food.name.trim() ||
      !Number.isFinite(food.serving) ||
      food.serving <= 0 ||
      ![food.kcal, food.protein, food.carbs, food.fat].every(
        (n) => Number.isFinite(n) && n >= 0,
      )
    )
      throw new Error(
        'Enter a food name, positive serving and nonnegative nutrients.',
      );
    const created: CustomFood = { ...food, id: newId('cf') };
    get().update((d) => {
      d.nutrition.customFoods.push(created);
    });
    return created;
  },

  toggleDayOff: (day, reason) =>
    get().update((d) => {
      if (reason) {
        d.daysOff[day] = reason;
        d.checkins = d.checkins.filter((c) => c !== day);
      } else {
        delete d.daysOff[day];
      }
    }),

  toggleCheckin: (day) =>
    get().update((d) => {
      if (d.sessions.some((s) => dateKey(s.date) === day)) return;
      if (d.checkins.includes(day))
        d.checkins = d.checkins.filter((c) => c !== day);
      else {
        d.checkins.push(day);
        delete d.daysOff[day];
      }
    }),

  addPass: (pass) =>
    get().update((d) => {
      if (!Number.isFinite(pass.hue) || pass.hue < 0) return;
      d.passes.push({ ...pass, id: newId('p') });
    }),

  deletePass: (id) =>
    get().update((d) => {
      d.passes = d.passes.filter((p) => p.id !== id);
    }),

  replaceData: async (data) => {
    await commitData(parseBackup(data));
  },

  resetAll: async () => {
    await commitData(accountDefaults(get().account));
    set({ lastFinishedId: null });
  },
}));

export function allExercises(): Exercise[] {
  return allExercisesFor(useStore.getState().data);
}

function allExercisesFor(data: AppData): Exercise[] {
  return [...EXERCISES, ...data.customExercises];
}

function accountDefaults(account: Account | null): AppData {
  const data = defaultData();
  data.settings.language = getLanguage();
  if (account) data.profile.name = account.name;
  return data;
}

function transitionAccount(action: () => Promise<void>): Promise<void> {
  const next = accountTransition.then(action, action);
  accountTransition = next.catch(() => undefined);
  return next;
}

function resetPersistenceContext() {
  cancelScheduledPersist();
  savedRevision = 0;
  lastPersistedData = null;
  recoveryData = undefined;
  savePromise = null;
  suppressPersistence = false;
  inFlightToken = undefined;
  pendingCommitData = null;
}

async function deactivateAccountContext(): Promise<void> {
  if (useStore.getState().isCommitting)
    throw new Error(
      'Wait for the current save to finish before switching accounts.',
    );
  if (useStore.getState().hydrated) await flushQueued();
  await synchronizer?.stop();
  synchronizer = null;
  accountEpoch++;
  activeAccountId = undefined;
  resetPersistenceContext();
  suppressPersistence = true;
  useStore.setState({
    account: null,
    accountMode: 'locked',
    data: defaultData(),
    hydrated: false,
    persistenceStatus: 'loading',
    persistenceError: null,
    cloudStatus: 'idle',
    cloudError: null,
    isCommitting: false,
    lastFinishedId: null,
  });
  suppressPersistence = false;
}

function makeSynchronizer(
  account: Account,
  epoch: number,
): AccountSynchronizer {
  const current = () =>
    accountEpoch === epoch && activeAccountId === account.id;
  return new AccountSynchronizer(account.id, {
    current,
    status: (cloudStatus, cloudError) => {
      if (!current()) return;
      useStore.setState({
        cloudStatus,
        cloudError,
        ...(cloudStatus === 'session-expired'
          ? { accountMode: 'locked' as const }
          : {}),
      });
    },
    metadata: () => undefined,
    localConflict: (error) => {
      if (current()) persistenceFailed(error);
    },
    remote: async (remote, expectedLocalRevision) => {
      if (!current()) return;
      await flushQueued();
      const cached = await loadPersisted(account.id);
      if (!current() || !cached) return;
      if (
        cached.revision !== expectedLocalRevision ||
        cached.sync?.dirty ||
        cached.sync?.pending ||
        useStore.getState().data !== lastPersistedData
      ) {
        synchronizer?.schedule();
        return;
      }
      if (remote.revision < (cached.sync?.remoteRevision ?? 0))
        throw new AccountApiError(
          409,
          'revision_conflict',
          'The cloud profile is older than this device. Export this copy before choosing which log to keep.',
        );
      if (remote.revision === cached.sync?.remoteRevision) return;
      await installAccountSnapshot(
        remote.data ?? accountDefaults(account),
        remote.revision,
        remote.data === null,
        cached.revision,
        epoch,
      );
    },
  });
}

async function installAccountSnapshot(
  data: AppData,
  remoteRevision: number,
  dirty: boolean,
  expectedLocalRevision: number,
  epoch: number,
) {
  const scope = activeAccountId;
  if (!scope || epoch !== accountEpoch) return;
  useStore.setState({ isCommitting: true });
  pendingCommitData = data;
  inFlightToken = crypto.randomUUID();
  journalLatest();
  try {
    savedRevision = await savePersisted(
      data,
      expectedLocalRevision,
      inFlightToken,
      scope,
      { remoteRevision, dirty, pending: null },
    );
    if (epoch !== accountEpoch) return;
    lastPersistedData = data;
    suppressPersistence = true;
    useStore.setState({
      data,
      hydrated: true,
      persistenceStatus: 'idle',
      persistenceError: null,
      cloudStatus: dirty ? 'pending' : 'idle',
      cloudError: null,
    });
  } finally {
    pendingCommitData = null;
    inFlightToken = undefined;
    suppressPersistence = false;
    if (epoch === accountEpoch) {
      useStore.setState({ isCommitting: false });
      journalLatest();
    }
  }
}

async function activateAccountContext(
  account: Account,
  offline: boolean,
): Promise<void> {
  if (
    offline &&
    (isLocallySignedOut() || getRememberedAccount()?.id !== account.id)
  )
    throw new Error('Sign in online before continuing with this account.');
  if (useStore.getState().isCommitting)
    throw new Error(
      'Wait for the current save to finish before switching accounts.',
    );
  if (useStore.getState().hydrated) await flushQueued();
  await synchronizer?.stop();
  synchronizer = null;
  const epoch = ++accountEpoch;
  activeAccountId = account.id;
  resetPersistenceContext();
  suppressPersistence = true;
  useStore.setState({
    account,
    accountMode: 'locked',
    data: accountDefaults(account),
    hydrated: false,
    persistenceStatus: 'loading',
    persistenceError: null,
    cloudStatus: offline ? 'offline' : 'pending',
    cloudError: null,
    lastFinishedId: null,
  });
  suppressPersistence = false;
  try {
    await hydrateFromDisk(true);
    if (epoch !== accountEpoch) return;
    const cached = await loadPersisted(account.id);
    if (offline) {
      if (!cached)
        throw new Error(
          'No saved copy of this account is available on this device. Sign in online first.',
        );
      synchronizer = makeSynchronizer(account, epoch);
      useStore.setState({
        accountMode: 'offline',
        cloudStatus: 'offline',
        cloudError:
          'Working with this device’s saved copy. Reconnect to synchronize.',
      });
      return;
    }
    const remote = await fetchAccountData(account.id);
    if (epoch !== accountEpoch) return;
    rememberAccount(account);
    if (useStore.getState().persistenceStatus === 'conflict') {
      useStore.setState({
        accountMode: 'online',
        cloudStatus: 'conflict',
        cloudError:
          'Export the recovered local copy before choosing the latest cloud profile.',
      });
      return;
    }
    if (!cached) {
      await installAccountSnapshot(
        remote.data ?? accountDefaults(account),
        remote.revision,
        remote.data === null,
        savedRevision,
        epoch,
      );
    } else {
      const sync = cached.sync ?? { ...emptyAccountSync(), dirty: true };
      if (
        !sync.pending &&
        remote.data &&
        JSON.stringify(parseBackup(cached.data)) === JSON.stringify(remote.data)
      ) {
        if (sync.dirty || sync.remoteRevision !== remote.revision)
          await installAccountSnapshot(
            remote.data,
            remote.revision,
            false,
            cached.revision,
            epoch,
          );
      } else if (!sync.dirty && !sync.pending) {
        if (remote.revision < sync.remoteRevision) {
          useStore.setState({
            accountMode: 'online',
            cloudStatus: 'conflict',
            cloudError:
              'The cloud profile is older than the saved device copy. Export this copy before replacing it.',
          });
          return;
        }
        if (remote.revision !== sync.remoteRevision)
          await installAccountSnapshot(
            remote.data ?? accountDefaults(account),
            remote.revision,
            remote.data === null,
            cached.revision,
            epoch,
          );
      } else if (!sync.pending && remote.revision !== sync.remoteRevision) {
        useStore.setState({
          accountMode: 'online',
          cloudStatus: 'conflict',
          cloudError:
            'Another device saved changes while this copy was offline. Export this copy or load the latest cloud profile.',
        });
        return;
      }
    }
    useStore.setState({ accountMode: 'online' });
    synchronizer = makeSynchronizer(account, epoch);
    const latest = await loadPersisted(account.id);
    if (latest?.sync?.pending) await synchronizer.flush();
    else if (latest?.sync?.dirty) synchronizer.schedule();
    else useStore.setState({ cloudStatus: 'idle', cloudError: null });
  } catch (error) {
    if (epoch === accountEpoch) {
      if (error instanceof AccountApiError && error.status === 409) {
        useStore.setState({
          accountMode: 'online',
          cloudStatus: 'conflict',
          cloudError:
            'Another device saved a newer log. Export this local copy or load the latest cloud profile.',
        });
        return;
      }
      if (
        error instanceof AccountApiError &&
        (error.status === 401 || error.status === 403)
      ) {
        markSessionExpired();
        useStore.setState({
          accountMode: 'locked',
          cloudStatus: 'session-expired',
          cloudError: error.message,
        });
      } else
        useStore.setState({
          accountMode: 'locked',
          cloudStatus: 'offline',
          cloudError: errorMessage(error),
        });
    }
    throw error;
  }
}

async function reloadCloudProfile(): Promise<void> {
  const account = useStore.getState().account;
  if (!account) throw new Error('Sign in before loading a cloud profile.');
  await synchronizer?.stop();
  synchronizer = null;
  const epoch = accountEpoch;
  useStore.setState({ isCommitting: true });
  try {
    await flushQueued();
    // Explicit user confirmation authorizes discarding this account’s local copy.
    const remote = await fetchAccountData(account.id);
    const cached = await loadPersisted(account.id);
    if (epoch !== accountEpoch) return;
    await installAccountSnapshot(
      remote.data ?? accountDefaults(account),
      remote.revision,
      remote.data === null,
      cached?.revision ?? 0,
      epoch,
    );
    clearPendingSnapshot(account.id);
    synchronizer = makeSynchronizer(account, epoch);
    useStore.setState({ accountMode: 'online' });
    if (!remote.data) synchronizer.schedule();
  } catch (error) {
    if (
      error instanceof AccountApiError &&
      (error.status === 401 || error.status === 403)
    ) {
      markSessionExpired();
      useStore.setState({
        accountMode: 'locked',
        cloudStatus: 'session-expired',
        cloudError: error.message,
      });
    }
    throw error;
  } finally {
    if (epoch === accountEpoch) useStore.setState({ isCommitting: false });
  }
}

function canMutate(state: Store): boolean {
  return (
    state.hydrated &&
    !state.isCommitting &&
    (state.persistenceStatus === 'idle' ||
      state.persistenceStatus === 'saving') &&
    state.cloudStatus !== 'conflict' &&
    state.cloudStatus !== 'session-expired' &&
    (state.account === null || state.accountMode !== 'locked')
  );
}

function startBlocked(state: Store): StartResult | null {
  if (!canMutate(state)) return { status: 'read-only' };
  return state.data.active ? { status: 'active-exists' } : null;
}

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'Browser storage is unavailable. Export your unsaved log and retry.';
}

function persistenceFailed(error: unknown) {
  useStore.setState({
    persistenceStatus:
      error instanceof PersistenceConflictError ? 'conflict' : 'error',
    persistenceError: errorMessage(error),
  });
}

async function hydrateFromDisk(
  rethrow: boolean,
  discardPending = false,
): Promise<void> {
  const before = useStore.getState();
  const scope = activeAccountId,
    epoch = accountEpoch;
  if (before.isCommitting) {
    if (rethrow) throw new Error('Wait for the current save to finish.');
    return;
  }
  useStore.setState({ isCommitting: true });
  let rawPending: unknown;
  let pendingReadSucceeded = false;
  let replayCandidate: AppData | null = null;
  try {
    rawPending = readPendingSnapshot(scope);
    pendingReadSucceeded = true;
    if (savePromise) await savePromise.catch(() => undefined);
    const loaded = await loadPersisted(scope);
    if (epoch !== accountEpoch) return;
    recoveryData =
      rawPending === undefined
        ? loaded?.raw
        : { saved: loaded?.raw, pending: rawPending };
    let data = loaded
      ? parseBackup(loaded.data)
      : accountDefaults(before.account);
    savedRevision = loaded?.revision ?? 0;
    lastPersistedData = data;
    suppressPersistence = true;
    const pending = discardPending ? null : parsePendingSnapshot(rawPending);
    if (pending && JSON.stringify(pending.data) !== JSON.stringify(data)) {
      replayCandidate = pending.data;
      const ownPendingWrite =
        pending.inFlightToken !== undefined &&
        pending.inFlightToken === loaded?.commitToken;
      if (pending.baseRevision !== savedRevision && !ownPendingWrite) {
        useStore.setState({
          data: pending.data,
          hydrated: true,
          persistenceStatus: 'conflict',
          persistenceError:
            'This tab has unsaved changes and another tab saved a newer log. Export the unsaved copy or reload the latest log.',
          lastFinishedId: null,
        });
        return;
      }
      inFlightToken = crypto.randomUUID();
      writePendingSnapshot(
        {
          version: 1,
          data: pending.data,
          baseRevision: savedRevision,
          inFlightToken,
        },
        scope,
      );
      savedRevision = await savePersisted(
        pending.data,
        savedRevision,
        inFlightToken,
        scope,
      );
      data = pending.data;
      lastPersistedData = data;
    }
    clearPendingSnapshot(scope);
    useStore.setState({
      data,
      hydrated: true,
      persistenceStatus: 'idle',
      persistenceError: null,
      lastFinishedId: null,
    });
  } catch (error) {
    // Metadata validation can fail while the underlying raw record is readable.
    // Retain both sources for export without publishing either as a new log.
    let rawStored: unknown;
    try {
      rawStored = await loadRawPersisted(scope);
    } catch {
      /* Retry remains available when storage cannot be read. */
    }
    if (rawPending !== undefined)
      recoveryData = { saved: rawStored, pending: rawPending };
    else if (rawStored !== undefined)
      recoveryData = pendingReadSucceeded
        ? rawStored
        : { saved: rawStored, pendingRecoveryError: errorMessage(error) };
    if (error instanceof PersistenceConflictError && replayCandidate) {
      suppressPersistence = true;
      useStore.setState({
        data: replayCandidate,
        hydrated: true,
        persistenceStatus: 'conflict',
        persistenceError: errorMessage(error),
        lastFinishedId: null,
      });
    } else {
      useStore.setState({
        persistenceStatus:
          before.persistenceStatus === 'conflict' ? 'conflict' : 'error',
        persistenceError: errorMessage(error),
      });
    }
    if (rethrow) throw error;
  } finally {
    inFlightToken = undefined;
    suppressPersistence = false;
    useStore.setState({ isCommitting: false });
  }
}

function journalLatest(): boolean {
  const scope = activeAccountId;
  const state = useStore.getState();
  if (!state.hydrated) return true;
  const snapshot = pendingCommitData ?? state.data;
  if (snapshot === lastPersistedData) {
    clearPendingSnapshot(scope);
    return true;
  }
  return writePendingSnapshot(
    {
      version: 1,
      data: snapshot,
      baseRevision: savedRevision,
      inFlightToken,
    },
    scope,
  );
}

function flushQueued(): Promise<void> {
  cancelScheduledPersist();
  const scope = activeAccountId,
    epoch = accountEpoch;
  const state = useStore.getState();
  if (!state.hydrated)
    return Promise.reject(
      new Error('Load your saved log before making changes.'),
    );
  if (state.persistenceStatus === 'conflict')
    return Promise.reject(new PersistenceConflictError());
  if (savePromise) return savePromise;
  savePromise = (async () => {
    try {
      while (
        epoch === accountEpoch &&
        useStore.getState().data !== lastPersistedData
      ) {
        const snapshot = useStore.getState().data;
        useStore.setState({
          persistenceStatus: 'saving',
          persistenceError: null,
        });
        inFlightToken = crypto.randomUUID();
        journalLatest();
        savedRevision = await savePersisted(
          snapshot,
          savedRevision,
          inFlightToken,
          scope,
        );
        if (epoch !== accountEpoch) return;
        lastPersistedData = snapshot;
        if (scope) synchronizer?.schedule();
        journalLatest();
      }
      useStore.setState({ persistenceStatus: 'idle', persistenceError: null });
    } catch (error) {
      persistenceFailed(error);
      throw error;
    }
  })().finally(() => {
    savePromise = null;
    inFlightToken = undefined;
    journalLatest();
  });
  return savePromise;
}

async function commitData(data: AppData): Promise<void> {
  const scope = activeAccountId,
    epoch = accountEpoch;
  if (!canMutate(useStore.getState()))
    throw new Error('Resolve storage recovery before replacing your log.');
  useStore.setState({ isCommitting: true });
  pendingCommitData = data;
  journalLatest();
  try {
    await flushQueued();
    useStore.setState({ persistenceStatus: 'saving', persistenceError: null });
    inFlightToken = crypto.randomUUID();
    journalLatest();
    savedRevision = await savePersisted(
      data,
      savedRevision,
      inFlightToken,
      scope,
    );
    if (epoch !== accountEpoch) return;
    lastPersistedData = data;
    if (scope) synchronizer?.schedule();
    suppressPersistence = true;
    useStore.setState({
      data,
      persistenceStatus: 'idle',
      persistenceError: null,
    });
  } catch (error) {
    persistenceFailed(error);
    throw error;
  } finally {
    pendingCommitData = null;
    inFlightToken = undefined;
    journalLatest();
    suppressPersistence = false;
    useStore.setState({ isCommitting: false });
  }
}

useStore.subscribe((state, previous) => {
  if (suppressPersistence || !state.hydrated || state.data === previous.data)
    return;
  if (
    state.persistenceStatus === 'conflict' ||
    state.persistenceStatus === 'error'
  )
    return;
  if (state.persistenceStatus !== 'saving')
    useStore.setState({ persistenceStatus: 'saving' });
  schedulePersist();
});

if (typeof window !== 'undefined') {
  const refreshCloud = () => {
    const state = useStore.getState();
    if (
      state.account &&
      state.accountMode !== 'locked' &&
      state.cloudStatus !== 'conflict'
    )
      void synchronizer?.flush(true).catch(() => undefined);
  };
  window.addEventListener('online', refreshCloud);
  window.addEventListener('focus', refreshCloud);
  window.addEventListener('storage', (event) => {
    if (
      event.key !== SESSION_EVENT_KEY ||
      !event.newValue ||
      !useStore.getState().account
    )
      return;
    try {
      const changed = JSON.parse(event.newValue) as {
        accountId?: string | null;
        expectedAccountId?: string;
      };
      if (
        changed.expectedAccountId &&
        changed.expectedAccountId !== useStore.getState().account?.id
      )
        return;
      if (changed.accountId !== useStore.getState().account?.id) {
        markSessionExpired();
        void synchronizer?.stop();
        useStore.setState({
          accountMode: 'locked',
          cloudStatus: 'session-expired',
          cloudError:
            'The signed-in account changed in another tab. Sign in again; this account’s local changes have been kept.',
        });
      }
    } catch {
      /* Ignore unrelated malformed preference events. */
    }
  });
  window.addEventListener('beforeunload', (event) => {
    if (!journalLatest()) {
      event.preventDefault();
      event.returnValue = '';
    }
  });
  window.addEventListener('pagehide', () => {
    journalLatest();
    if (useStore.getState().hydrated) void flushQueued().catch(() => undefined);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && useStore.getState().hydrated) {
      journalLatest();
      void flushQueued().catch(() => undefined);
    }
  });
}

export type { Store };
