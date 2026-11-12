export type Unit = 'kg' | 'lb';
export type ThemePref =
  | 'dark'
  | 'midnight'
  | 'forest'
  | 'light'
  | 'mist'
  | 'sage';
export type SetKind =
  'normal' | 'warmup' | 'drop' | 'failure' | 'restPause' | 'cluster';
export type EffortMode = 'off' | 'rpe' | 'rir';
/** Empty mode is the existing repetition-based logging format. */
export type ExerciseMode = '' | 'time' | 'cardio';
export type LoadKind = 'external' | 'added' | 'assistance' | 'none';
export type MuscleId =
  | 'chest'
  | 'shoulders'
  | 'biceps'
  | 'abdomen'
  | 'obliques'
  | 'quads'
  | 'forearm'
  | 'trapezius'
  | 'back'
  | 'lowerback'
  | 'triceps'
  | 'glutes'
  | 'hamstrings'
  | 'calves';

export interface Exercise {
  id: string;
  name: string;
  primary: string;
  secondary: string[];
  equipment: string;
  difficulty: string;
  art: string;
  steps: string[];
  mode: ExerciseMode;
  loadKind?: LoadKind;
  /** Reviewed movement family used only to diversify automatic suggestions. */
  suggestionGroup?: string;
  aliases: string[];
  kind: string;
}

export interface LoggedSet {
  reps: number;
  weight: number;
  kind: SetKind;
  rpe?: number;
  sec?: number;
  km?: number;
  note?: string;
  left?: number;
  right?: number;
}

export interface LoggedExercise {
  id: string;
  name: string;
  primary: string;
  mode?: ExerciseMode;
  loadKind?: LoadKind;
  sets: LoggedSet[];
}

export interface LoggedSession {
  id: string;
  date: string; // ISO timestamp at finish
  durationSec: number;
  exercises: LoggedExercise[];
  routineId?: string;
  name?: string;
  deload?: boolean;
  note?: string;
}

export interface SessionSet {
  reps: number;
  repsR?: number;
  weight: number;
  done: boolean;
  kind: SetKind;
  rpe?: number;
  sec?: number;
  km?: number;
  rest?: number;
  note?: string;
}

export interface SessionExercise {
  uid: string;
  id: string;
  name: string;
  primary: string;
  mode?: ExerciseMode;
  loadKind?: LoadKind;
  weightUnit?: Unit;
  sets: SessionSet[];
  linkedNext?: boolean;
  swappedFrom?: string;
}

export interface ActiveSession {
  id: string;
  startedAt: number;
  routineId?: string;
  name?: string;
  manual?: boolean;
  deload?: boolean;
  exercises: SessionExercise[];
  currentIndex: number;
  pausedAt?: number;
  pausedTotalSec: number;
  restEndsAt?: number;
  restFrozen?: number;
  restTotal?: number;
}

export interface Routine {
  id: string;
  name: string;
  exerciseIds: string[];
  sets: Record<string, number>;
  rest: Record<string, number>;
  group?: string;
  color?: number;
  archived?: boolean;
  createdAt: string;
}

export interface Note {
  id: string;
  exerciseId: string; // '' for general
  date: string; // YYYY-MM-DD
  kind: 'note' | 'plan' | 'done' | 'pain';
  text: string;
  pinned?: boolean;
  folder?: string;
  createdAt: string;
}

export interface BodyweightEntry {
  date: string; // YYYY-MM-DD
  kg: number;
  note?: string;
}

export interface BodyMeasure {
  id: string;
  date: string;
  key: string;
  value: number;
}

export interface Profile {
  name: string;
  sex: 'male' | 'female' | 'other';
  age: number;
  heightCm: number;
  weightKg: number;
  activity: number;
  since?: string;
}

export interface Settings {
  unit: Unit;
  theme: ThemePref;
  language: 'en' | 'th';
  restSec: number;
  miniRestSec: number;
  weeklyGoal: number;
  weekStart: 0 | 1 | 6;
  autoRest: boolean;
  autoAdvance: boolean;
  sound: boolean;
  vibrate: boolean;
  effort: EffortMode;
  barWeight: number;
  plates: number[];
  countdown: boolean;
}

export interface NutritionGoals {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  waterMl: number;
  glassMl: number;
  fiber: number;
}

export interface MealEntry {
  id: string;
  date: string; // YYYY-MM-DD
  meal: 'breakfast' | 'lunch' | 'dinner' | 'snacks';
  name: string;
  foodId?: string;
  grams: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  sugar?: number;
  sodium?: number;
  createdAt: string;
}

export interface CustomFood {
  id: string;
  name: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  serving: number;
}

export interface GymPass {
  id: string;
  name: string;
  code: string;
  member?: string;
  hue: number;
}

export interface NutritionData {
  goals: NutritionGoals;
  goalsSet: boolean;
  entries: MealEntry[];
  water: Record<string, number>;
  customFoods: CustomFood[];
}

export interface AppData {
  version: 1;
  onboarded: boolean;
  profile: Profile;
  settings: Settings;
  sessions: LoggedSession[];
  active: ActiveSession | null;
  routines: Routine[];
  weekPlan: Record<string, string>; // weekday 0..6 (Sun..Sat) -> routine id
  daysOff: Record<string, string>;
  checkins: string[];
  favorites: Record<string, boolean>;
  customExercises: Exercise[];
  archived: string[];
  notes: Note[];
  bodyweights: BodyweightEntry[];
  measures: BodyMeasure[];
  nutrition: NutritionData;
  passes: GymPass[];
  bodyGoalKg?: number;
}

export interface PR {
  id: string;
  name: string;
  kind: 'weight' | 'distance' | 'time' | 'reps';
  best: number;
  oneRm: number;
}
