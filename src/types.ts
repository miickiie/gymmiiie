export type Unit = 'kg' | 'lb';
export type ThemePref = 'dark' | 'volt' | 'abyss' | 'solar' | 'light' | 'dune';
export type SetKind =
  'normal' | 'warmup' | 'drop' | 'failure' | 'restPause' | 'cluster';
export type EffortMode = 'off' | 'rpe' | 'rir';
/**
 * GymMane v2.2.0 logging taxonomy. Legacy `time`/`cardio`/empty values remain
 * valid for saved workouts and user-created exercises.
 */
export type ExerciseMode =
  | ''
  | 'time'
  | 'cardio'
  | 'distance_duration'
  | 'duration'
  | 'weight_duration'
  | 'assisted_bodyweight'
  | 'bodyweight_reps'
  | 'weight_reps';
/** How a movement is driven for tracking and PR leaderboards. */
export type ExerciseKind = 'strength' | 'cardio' | 'mobility' | 'sport';
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
  kind: ExerciseKind | 'custom';
  /** One limb at a time; offers the between-sides rest timer while logging. */
  unilateral?: boolean;
  /** Attachment or machine variant, e.g. `Smith Machine`, `Trap Bar`, `EZ-Bar`. */
  sub_equipment?: string | null;
  /** Deterministic swap candidates ranked by artwork and muscle overlap. */
  similar_ids?: string[];
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
  /** Snapshot of the catalog kind; older logs fall back to the catalog lookup. */
  kind?: ExerciseKind | 'custom';
  unilateral?: boolean;
  sets: LoggedSet[];
}

export interface LoggedSession {
  startedAt?: string; // ISO timestamp at start; absent on older sessions
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
  // Missing metadata preserves legacy values; an empty object permits prefill.
  editedFields?: Partial<Record<'weight' | 'reps' | 'repsR', boolean>>;
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
  /** Snapshot of the catalog kind; a mobility row never feeds strength PRs. */
  kind?: ExerciseKind | 'custom';
  /** Whether each side is trained separately for the between-sides rest cue. */
  unilateral?: boolean;
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
  bodyGoalKg?: number;
}

export interface PR {
  id: string;
  name: string;
  kind: 'weight' | 'distance' | 'time' | 'reps';
  best: number;
  oneRm: number;
}
