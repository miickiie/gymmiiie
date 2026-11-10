import { create } from 'zustand';
import { produce, type Draft } from 'immer';
import type {
  ActiveSession, AppData, BodyMeasure, BodyweightEntry, CustomFood, Exercise, GymPass, LoggedSession,
  MealEntry, Note, NutritionGoals, Profile, Routine, SessionExercise, SessionSet, Settings,
} from '../types';
import { dateKey, isoNow } from './date';
import { loadPersisted, savePersisted } from './db';
import { newId, oneRm, weightStep } from './stats';
import { EXERCISES, calculatePlates, defaultPicks, makeSessionExercise, openingSets } from './exercises';

export interface ProgramTemplate {
  id: string;
  name: string;
  detail: string;
  days: { name: string; weekday: number; exercises: { name: string; sets: number }[] }[];
}

export const PROGRAM_TEMPLATES: ProgramTemplate[] = [
  {
    id: 'fullbody',
    name: 'Full Body',
    detail: '3 days · squat, press, pull',
    days: [1, 3, 5].map((weekday, i) => ({
      name: `Full Body ${'ABC'[i] ?? i + 1}`, weekday,
      exercises: [
        { name: 'Barbell Full Squat', sets: 3 }, { name: 'Barbell Bench Press', sets: 3 },
        { name: 'Barbell Bent Over Row', sets: 3 }, { name: 'Barbell Seated Overhead Press', sets: 3 },
        { name: 'Barbell Romanian Deadlift', sets: 3 }, { name: 'Plank', sets: 3 },
      ],
    })),
  },
  {
    id: 'ppl',
    name: 'Push Pull Legs',
    detail: '3 days · classic split',
    days: [
      { name: 'Push', weekday: 1, exercises: [
        { name: 'Barbell Bench Press', sets: 4 }, { name: 'Dumbbell Incline Bench Press', sets: 3 },
        { name: 'Barbell Seated Overhead Press', sets: 3 }, { name: 'Dumbbell Lateral Raise', sets: 3 }, { name: 'V-Bar Triceps Pushdown', sets: 3 },
      ] },
      { name: 'Pull', weekday: 3, exercises: [
        { name: 'Pull-up', sets: 4 }, { name: 'Barbell Bent Over Row', sets: 4 }, { name: 'Wide-Grip Lat Pulldown', sets: 3 },
        { name: 'Face Pull', sets: 3 }, { name: 'Barbell Curl', sets: 3 },
      ] },
      { name: 'Legs', weekday: 5, exercises: [
        { name: 'Barbell Full Squat', sets: 4 }, { name: 'Barbell Romanian Deadlift', sets: 3 }, { name: 'Leg Press', sets: 3 },
        { name: 'Lying Leg Curl', sets: 3 }, { name: 'Barbell Standing Calf Raise', sets: 4 },
      ] },
    ],
  },
  {
    id: 'upperlower',
    name: 'Upper Lower',
    detail: '4 days · balanced',
    days: [
      { name: 'Upper A', weekday: 1, exercises: [
        { name: 'Barbell Bench Press', sets: 4 }, { name: 'Barbell Bent Over Row', sets: 4 }, { name: 'Barbell Seated Overhead Press', sets: 3 },
        { name: 'Wide-Grip Lat Pulldown', sets: 3 }, { name: 'Barbell Curl', sets: 3 }, { name: 'V-Bar Triceps Pushdown', sets: 3 },
      ] },
      { name: 'Lower A', weekday: 2, exercises: [
        { name: 'Barbell Full Squat', sets: 4 }, { name: 'Barbell Romanian Deadlift', sets: 3 }, { name: 'Leg Press', sets: 3 },
        { name: 'Lying Leg Curl', sets: 3 }, { name: 'Barbell Standing Calf Raise', sets: 4 },
      ] },
      { name: 'Upper B', weekday: 4, exercises: [
        { name: 'Dumbbell Incline Bench Press', sets: 4 }, { name: 'Pull-up', sets: 4 }, { name: 'Dumbbell Lateral Raise', sets: 4 },
        { name: 'Cable Seated Row', sets: 3 }, { name: 'Dumbbell Hammer Curl', sets: 3 }, { name: 'Barbell Lying Triceps Extension', sets: 3 },
      ] },
      { name: 'Lower B', weekday: 5, exercises: [
        { name: 'Barbell Front Squat', sets: 3 }, { name: 'Leg Press', sets: 4 }, { name: 'Leg Extension', sets: 3 },
        { name: 'Lying Leg Curl', sets: 3 }, { name: 'Barbell Seated Calf Raise', sets: 4 },
      ] },
    ],
  },
  {
    id: 'arnold',
    name: 'Arnold Split',
    detail: '6 days · chest & back / shoulders & arms / legs',
    days: [
      { name: 'Chest & Back', weekday: 1, exercises: [
        { name: 'Barbell Bench Press', sets: 4 }, { name: 'Dumbbell Incline Bench Press', sets: 3 }, { name: 'Flat Bench Cable Fly', sets: 3 },
        { name: 'Pull-up', sets: 4 }, { name: 'Barbell Bent Over Row', sets: 4 }, { name: 'Cable Seated Row', sets: 3 },
      ] },
      { name: 'Shoulders & Arms', weekday: 2, exercises: [
        { name: 'Barbell Seated Overhead Press', sets: 4 }, { name: 'Dumbbell Lateral Raise', sets: 4 }, { name: 'Face Pull', sets: 3 },
        { name: 'Barbell Curl', sets: 3 }, { name: 'Dumbbell Hammer Curl', sets: 3 }, { name: 'Barbell Lying Triceps Extension', sets: 3 },
        { name: 'V-Bar Triceps Pushdown', sets: 3 },
      ] },
      { name: 'Legs', weekday: 3, exercises: [
        { name: 'Barbell Full Squat', sets: 4 }, { name: 'Barbell Romanian Deadlift', sets: 3 }, { name: 'Leg Press', sets: 3 },
        { name: 'Leg Extension', sets: 3 }, { name: 'Lying Leg Curl', sets: 3 }, { name: 'Barbell Standing Calf Raise', sets: 4 },
      ] },
      { name: 'Chest & Back', weekday: 4, exercises: [
        { name: 'Barbell Bench Press', sets: 4 }, { name: 'Dumbbell Incline Bench Press', sets: 3 }, { name: 'Flat Bench Cable Fly', sets: 3 },
        { name: 'Pull-up', sets: 4 }, { name: 'Barbell Bent Over Row', sets: 4 }, { name: 'Cable Seated Row', sets: 3 },
      ] },
      { name: 'Shoulders & Arms', weekday: 5, exercises: [
        { name: 'Barbell Seated Overhead Press', sets: 4 }, { name: 'Dumbbell Lateral Raise', sets: 4 }, { name: 'Face Pull', sets: 3 },
        { name: 'Barbell Curl', sets: 3 }, { name: 'Dumbbell Hammer Curl', sets: 3 }, { name: 'Barbell Lying Triceps Extension', sets: 3 },
        { name: 'V-Bar Triceps Pushdown', sets: 3 },
      ] },
      { name: 'Legs', weekday: 6, exercises: [
        { name: 'Barbell Full Squat', sets: 4 }, { name: 'Barbell Romanian Deadlift', sets: 3 }, { name: 'Leg Press', sets: 3 },
        { name: 'Leg Extension', sets: 3 }, { name: 'Lying Leg Curl', sets: 3 }, { name: 'Barbell Standing Calf Raise', sets: 4 },
      ] },
    ],
  },
];

const DEFAULT_GOALS: NutritionGoals = {
  kcal: 2400, protein: 160, carbs: 260, fat: 80, waterMl: 2500, glassMl: 250, fiber: 30,
};

export function defaultData(): AppData {
  return {
    version: 1,
    onboarded: false,
    profile: { name: '', sex: 'male', age: 28, heightCm: 175, weightKg: 75, activity: 1.55 },
    settings: {
      unit: 'kg', theme: 'dark', restSec: 90, miniRestSec: 20, weeklyGoal: 4, weekStart: 1,
      autoRest: true, autoAdvance: true, sound: true, vibrate: false, effort: 'off', barWeight: 20,
      plates: [25, 20, 15, 10, 5, 2.5, 1.25], countdown: false,
    },
    sessions: [],
    active: null,
    routines: [],
    weekPlan: {},
    daysOff: {},
    checkins: [],
    favorites: {},
    customExercises: [],
    archived: [],
    notes: [],
    bodyweights: [],
    measures: [],
    nutrition: { goals: DEFAULT_GOALS, goalsSet: false, entries: [], water: {}, customFoods: [] },
    passes: [],
  } as AppData;
}

interface Store {
  data: AppData;
  hydrated: boolean;
  lastFinishedId: string | null;
  hydrate: () => Promise<void>;
  update: (fn: (d: Draft<AppData>) => void) => void;
  completeOnboarding: (profile: Partial<Profile>) => void;
  setProfile: (p: Partial<Profile>) => void;
  setSettings: (s: Partial<Settings>) => void;
  setNutritionGoals: (g: Partial<NutritionGoals>) => void;
  startFromMuscles: (muscles: string[]) => void;
  startFromRoutine: (routineId: string) => void;
  startEmpty: () => void;
  cancelSession: () => void;
  addExerciseToSession: (exerciseId: string) => void;
  removeSessionExercise: (uid: string) => void;
  replaceSessionExercise: (uid: string, exerciseId: string) => void;
  updateSet: (uid: string, index: number, patch: Partial<SessionSet>) => void;
  toggleSet: (uid: string, index: number) => boolean;
  addSet: (uid: string) => void;
  removeSet: (uid: string, index: number) => void;
  setCurrentExercise: (index: number) => void;
  toggleSessionLink: (uid: string) => void;
  moveSessionExercise: (from: number, to: number) => void;
  setSessionName: (name: string) => void;
  toggleSessionPause: () => void;
  startRest: (seconds?: number) => void;
  skipRest: () => void;
  nudgeRest: (seconds: number) => void;
  finishSession: () => void;
  discardSession: () => void;
  deleteSession: (id: string) => void;
  startFromSession: (id: string) => void;
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
  replaceData: (data: AppData) => void;
  resetAll: () => void;
}

function recalcActive(data: AppData) {
  if (!data.active) return;
  data.active.exercises.forEach((e) => {
    if (!e.sets.length) {
      e.sets.push({ reps: 10, weight: 20, done: false, kind: 'normal' });
    }
  });
  data.active.currentIndex = Math.max(0, Math.min(data.active.currentIndex, data.active.exercises.length - 1));
}

function makeActive(exercises: SessionExercise[], routineId?: string): ActiveSession {
  return {
    id: newId('s'),
    startedAt: Date.now(),
    exercises,
    currentIndex: 0,
    pausedTotalSec: 0,
    routineId,
  };
}

export const useStore = create<Store>((set, get) => ({
  data: defaultData(),
  hydrated: false,
  lastFinishedId: null,

  hydrate: async () => {
    const saved = await loadPersisted();
    if (saved) {
      const merged = { ...defaultData(), ...saved };
      merged.settings = { ...defaultData().settings, ...saved.settings };
      merged.profile = { ...defaultData().profile, ...saved.profile };
      merged.nutrition = { ...defaultData().nutrition, ...saved.nutrition };
      set({ data: merged, hydrated: true });
    } else {
      set({ hydrated: true });
    }
  },

  update: (fn) => set((s) => ({ data: produce(s.data, fn) })),

  completeOnboarding: (profile) => get().update((d) => {
    Object.assign(d.profile, profile);
    d.onboarded = true;
    if (!d.profile.since) d.profile.since = isoNow();
  }),

  setProfile: (p) => get().update((d) => { Object.assign(d.profile, p); }),

  setSettings: (s) => get().update((d) => { Object.assign(d.settings, s); }),

  setNutritionGoals: (g) => get().update((d) => {
    Object.assign(d.nutrition.goals, g);
    d.nutrition.goalsSet = true;
  }),

  startFromMuscles: (muscles) => {
    const { data } = get();
    const picks = defaultPicks(allExercisesFor(get().data), data.sessions, muscles, data.favorites);
    const unit = data.settings.unit;
    const exercises = (picks.length ? picks : []).map((e) => makeSessionExercise(e, data.sessions, unit));
    const active = makeActive(exercises);
    set((s) => ({ data: produce(s.data, (d) => { d.active = active; }) }));
  },

  startFromRoutine: (routineId) => {
    const { data } = get();
    const routine = data.routines.find((r) => r.id === routineId);
    if (!routine) return;
    const all = allExercisesFor(get().data);
    const unit = data.settings.unit;
    const exercises: SessionExercise[] = [];
    for (const id of routine.exerciseIds) {
      const ex = all.find((e) => e.id === id);
      if (!ex) continue;
      const sets = routine.sets[id] ?? 3;
      exercises.push(makeSessionExercise(ex, data.sessions, unit, sets));
    }
    const active = makeActive(exercises, routineId);
    if (routine.name) active.name = routine.name;
    set((s) => ({ data: produce(s.data, (d) => { d.active = active; }) }));
  },

  startEmpty: () => {
    const active = makeActive([]);
    set((s) => ({ data: produce(s.data, (d) => { d.active = active; }) }));
  },

  cancelSession: () => set((s) => ({ data: produce(s.data, (d) => { d.active = null; }), lastFinishedId: null })),

  addExerciseToSession: (exerciseId) => {
    const { data } = get();
    const ex = allExercisesFor(get().data).find((e) => e.id === exerciseId);
    if (!ex) return;
    get().update((d) => {
      if (!d.active) return;
      if (d.active.exercises.some((e) => e.id === exerciseId)) return;
      d.active.exercises.push(makeSessionExercise(ex, data.sessions, d.settings.unit));
    });
  },

  removeSessionExercise: (uid) => get().update((d) => {
    if (!d.active) return;
    d.active.exercises = d.active.exercises.filter((e) => e.uid !== uid);
    recalcActive(d);
  }),

  replaceSessionExercise: (uid, exerciseId) => {
    const { data } = get();
    const ex = allExercisesFor(get().data).find((e) => e.id === exerciseId);
    if (!ex) return;
    get().update((d) => {
      if (!d.active) return;
      const target = d.active.exercises.find((e) => e.uid === uid);
      if (!target) return;
      target.swappedFrom = target.id;
      target.id = ex.id;
      target.name = ex.name;
      target.primary = ex.primary;
      target.sets = openingSets(ex, data.sessions, d.settings.unit);
    });
  },

  updateSet: (uid, index, patch) => get().update((d) => {
    const ex = d.active?.exercises.find((e) => e.uid === uid);
    const st = ex?.sets[index];
    if (st) Object.assign(st, patch);
  }),

  toggleSet: (uid, index) => {
    const { data } = get();
    const ex = data.active?.exercises.find((e) => e.uid === uid);
    const st = ex?.sets[index];
    if (!st) return false;
    const becomingDone = !st.done;
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

  addSet: (uid) => get().update((d) => {
    const ex = d.active?.exercises.find((e) => e.uid === uid);
    if (!ex) return;
    const last = ex.sets[ex.sets.length - 1];
    ex.sets.push(last
      ? { reps: last.reps, weight: last.weight, done: false, kind: last.kind, sec: last.sec, km: last.km, repsR: last.repsR }
      : { reps: 10, weight: 20, done: false, kind: 'normal' });
  }),

  removeSet: (uid, index) => get().update((d) => {
    const ex = d.active?.exercises.find((e) => e.uid === uid);
    if (!ex || ex.sets.length <= 1) return;
    ex.sets.splice(index, 1);
  }),

  setCurrentExercise: (index) => get().update((d) => {
    if (!d.active) return;
    d.active.currentIndex = Math.max(0, Math.min(index, d.active.exercises.length - 1));
  }),

  toggleSessionLink: (uid) => get().update((d) => {
    const ex = d.active?.exercises.find((e) => e.uid === uid);
    if (ex) ex.linkedNext = !ex.linkedNext;
  }),

  moveSessionExercise: (from, to) => get().update((d) => {
    if (!d.active) return;
    const list = d.active.exercises;
    if (from < 0 || from >= list.length) return;
    const [item] = list.splice(from, 1);
    list.splice(Math.max(0, Math.min(to, list.length)), 0, item);
    d.active.currentIndex = Math.max(0, Math.min(d.active.currentIndex, list.length - 1));
  }),

  setSessionName: (name) => get().update((d) => { if (d.active) d.active.name = name; }),

  toggleSessionPause: () => get().update((d) => {
    const a = d.active;
    if (!a) return;
    if (a.pausedAt) {
      a.pausedTotalSec += (Date.now() - a.pausedAt) / 1000;
      a.pausedAt = undefined;
      if (a.restFrozen) {
        a.restEndsAt = Date.now() + a.restFrozen * 1000;
        a.restFrozen = undefined;
      }
    } else {
      a.pausedAt = Date.now();
      if (a.restEndsAt) {
        a.restFrozen = Math.max(0, Math.ceil((a.restEndsAt - Date.now()) / 1000));
        a.restEndsAt = undefined;
      }
    }
  }),

  startRest: (seconds) => get().update((d) => {
    const a = d.active;
    if (!a) return;
    const sec = seconds ?? d.settings.restSec;
    if (sec <= 0) { a.restEndsAt = undefined; a.restFrozen = undefined; return; }
    a.restTotal = sec;
    if (a.pausedAt) a.restFrozen = sec;
    else a.restEndsAt = Date.now() + sec * 1000;
  }),

  skipRest: () => get().update((d) => {
    if (!d.active) return;
    d.active.restEndsAt = undefined;
    d.active.restFrozen = undefined;
  }),

  nudgeRest: (seconds) => get().update((d) => {
    const a = d.active;
    if (!a) return;
    if (a.restFrozen) a.restFrozen = Math.max(5, a.restFrozen + seconds);
    else if (a.restEndsAt) {
      const left = (a.restEndsAt - Date.now()) / 1000;
      a.restEndsAt = Date.now() + Math.max(5, left + seconds) * 1000;
    }
  }),

  finishSession: () => {
    const { data } = get();
    const a = data.active;
    if (!a) return;
    const elapsed = Math.max(1, Math.floor((Date.now() - a.startedAt - a.pausedTotalSec * 1000) / 1000));
    const exercises = a.exercises
      .map((e) => ({
        id: e.id,
        name: e.name,
        primary: e.primary,
        sets: e.sets.filter((s) => s.done).map((s) => ({
          reps: s.repsR != null ? Math.min(s.reps, s.repsR) : s.reps,
          weight: s.weight,
          kind: s.kind,
          rpe: s.rpe,
          sec: s.sec,
          km: s.km,
          note: s.note,
          left: s.repsR != null ? s.reps : undefined,
          right: s.repsR != null ? s.repsR : undefined,
        })),
      }))
      .filter((e) => e.sets.length > 0);
    if (!exercises.length) {
      set((s) => ({ data: produce(s.data, (d) => { d.active = null; }) }));
      return;
    }
    const session: LoggedSession = {
      id: newId('w'),
      date: isoNow(),
      durationSec: elapsed,
      exercises,
      routineId: a.routineId,
      name: a.name,
      deload: a.deload,
    };
    set((s) => ({
      data: produce(s.data, (d) => {
        d.sessions.push(session);
        d.active = null;
        const day = dateKey(session.date);
        d.checkins = d.checkins.filter((c) => c !== day);
        if (d.profile.since == null) d.profile.since = isoNow();
        if (session.exercises.length) {
          const weight = d.profile.weightKg;
          if (!d.bodyweights.some((b) => b.date === day) && weight > 0) {
            // keep bodyweight log explicit; do not auto-insert
          }
        }
      }),
      lastFinishedId: session.id,
    }));
  },

  discardSession: () => set((s) => ({ data: produce(s.data, (d) => { d.active = null; }), lastFinishedId: null })),

  deleteSession: (id) => get().update((d) => {
    d.sessions = d.sessions.filter((s) => s.id !== id);
    if (d.checkins.length) d.checkins = d.checkins.filter((c) => !d.sessions.some((s) => dateKey(s.date) === c));
  }),

  startFromSession: (id) => {
    const { data } = get();
    const session = data.sessions.find((s) => s.id === id);
    if (!session) return;
    const exercises: SessionExercise[] = session.exercises.map((e) => ({
      uid: `${e.id}-${Math.random().toString(36).slice(2, 8)}`,
      id: e.id,
      name: e.name,
      primary: e.primary,
      sets: e.sets.map((s) => ({
        reps: s.reps,
        repsR: s.left != null && s.right != null && s.left !== s.right ? s.right : undefined,
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
    set((s) => ({ data: produce(s.data, (d) => { d.active = active; }) }));
  },

  createRoutine: (r) => {
    const id = newId('r');
    get().update((d) => {
      d.routines.push({ ...r, id, createdAt: isoNow() });
    });
    return id;
  },

  updateRoutine: (id, patch) => get().update((d) => {
    const r = d.routines.find((x) => x.id === id);
    if (r) Object.assign(r, patch);
  }),

  deleteRoutine: (id) => get().update((d) => {
    d.routines = d.routines.filter((r) => r.id !== id);
    for (const k of Object.keys(d.weekPlan)) if (d.weekPlan[k] === id) delete d.weekPlan[k];
  }),

  addTemplate: (templateId) => {
    const { data } = get();
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
      const routineName = day.name.toLowerCase().startsWith(tpl.name.toLowerCase()) ? day.name : `${tpl.name} · ${day.name}`;
      get().update((d) => {
        d.routines.push({ id, name: routineName, exerciseIds, sets, rest: {}, createdAt: isoNow() });
        d.weekPlan[String(day.weekday)] = id;
      });
    }
    void data;
    return created;
  },

  setWeekPlan: (weekday, routineId) => get().update((d) => {
    if (routineId) d.weekPlan[String(weekday)] = routineId;
    else delete d.weekPlan[String(weekday)];
  }),

  toggleFavorite: (id) => get().update((d) => {
    if (d.favorites[id]) delete d.favorites[id];
    else d.favorites[id] = true;
  }),

  toggleArchived: (id) => get().update((d) => {
    if (d.archived.includes(id)) d.archived = d.archived.filter((x) => x !== id);
    else d.archived.push(id);
  }),

  addCustomExercise: (e) => get().update((d) => {
    if (!d.customExercises.some((x) => x.id === e.id)) d.customExercises.push(e);
  }),

  deleteCustomExercise: (id) => get().update((d) => {
    d.customExercises = d.customExercises.filter((e) => e.id !== id);
    d.archived = d.archived.filter((x) => x !== id);
  }),

  saveNote: (n) => get().update((d) => {
    if (n.id) {
      const existing = d.notes.find((x) => x.id === n.id);
      if (existing) Object.assign(existing, n);
    } else {
      d.notes.unshift({ ...n, id: newId('n'), createdAt: isoNow() });
    }
  }),

  deleteNote: (id) => get().update((d) => { d.notes = d.notes.filter((n) => n.id !== id); }),

  addBodyweight: (kg, day = dateKey(), note = '') => get().update((d) => {
    const existing = d.bodyweights.find((b) => b.date === day);
    if (existing) { existing.kg = kg; existing.note = note; }
    else d.bodyweights.push({ date: day, kg, note });
    d.bodyweights.sort((a, b) => a.date.localeCompare(b.date));
    d.profile.weightKg = kg;
  }),

  deleteBodyweight: (day) => get().update((d) => { d.bodyweights = d.bodyweights.filter((b) => b.date !== day); }),

  addMeasure: (key, value, day = dateKey()) => get().update((d) => {
    const existing = d.measures.find((m) => m.key === key && m.date === day);
    if (existing) existing.value = value;
    else d.measures.push({ id: newId('m'), key, date: day, value });
  }),

  deleteMeasure: (id) => get().update((d) => { d.measures = d.measures.filter((m) => m.id !== id); }),

  addMealEntry: (entry) => get().update((d) => {
    d.nutrition.entries.push({ ...entry, id: newId('e'), createdAt: isoNow() });
  }),

  deleteMealEntry: (id) => get().update((d) => {
    d.nutrition.entries = d.nutrition.entries.filter((e) => e.id !== id);
  }),

  addWater: (ml, day = dateKey()) => get().update((d) => {
    d.nutrition.water[day] = Math.max(0, (d.nutrition.water[day] ?? 0) + ml);
  }),

  setWater: (ml, day = dateKey()) => get().update((d) => {
    d.nutrition.water[day] = Math.max(0, ml);
  }),

  addCustomFood: (food) => {
    const created: CustomFood = { ...food, id: newId('cf') };
    get().update((d) => { d.nutrition.customFoods.push(created); });
    return created;
  },

  toggleDayOff: (day, reason) => get().update((d) => {
    if (reason) {
      d.daysOff[day] = reason;
      d.checkins = d.checkins.filter((c) => c !== day);
    } else {
      delete d.daysOff[day];
    }
  }),

  toggleCheckin: (day) => get().update((d) => {
    if (d.sessions.some((s) => dateKey(s.date) === day)) return;
    if (d.checkins.includes(day)) d.checkins = d.checkins.filter((c) => c !== day);
    else { d.checkins.push(day); delete d.daysOff[day]; }
  }),

  addPass: (pass) => get().update((d) => { d.passes.push({ ...pass, id: newId('p') }); }),

  deletePass: (id) => get().update((d) => { d.passes = d.passes.filter((p) => p.id !== id); }),

  replaceData: (data) => set({ data: { ...defaultData(), ...data } }),

  resetAll: () => set({ data: defaultData(), lastFinishedId: null }),
}));

export function allExercises(): Exercise[] {
  return allExercisesFor(useStore.getState().data);
}

function allExercisesFor(data: AppData): Exercise[] {
  return [...EXERCISES, ...data.customExercises];
}

// Persist on every data change.
let saveTimer: ReturnType<typeof setTimeout> | null = null;
useStore.subscribe((state, prev) => {
  if (state.data === prev.data || !state.hydrated) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    void savePersisted(useStore.getState().data);
  }, 250);
});

export function currentWeightStep(unit: 'kg' | 'lb') {
  return weightStep(unit);
}

export function plannedWeight(kg: number, bar: number, plates: number[], unit: 'kg' | 'lb') {
  return calculatePlates(kg, bar, plates, unit);
}

export function prScore(weight: number, reps: number, rpe?: number) {
  return oneRm(weight, reps, rpe);
}

export function makeNoteId() {
  return newId('n');
}

export type { Store };
