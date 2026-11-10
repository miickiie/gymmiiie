import type { AppData } from '../types';
import { defaultData } from './defaults';

export class SnapshotValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotValidationError';
  }
}

type Obj = Record<string, unknown>;
const fail = (path: string): never => {
  throw new SnapshotValidationError(`Invalid backup field: ${path}`);
};
function object(value: unknown, path: string): Obj {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return fail(path);
  return value as Obj;
}
function text(value: unknown, path: string, empty = true) {
  if (typeof value !== 'string' || (!empty && !value.trim())) fail(path);
}
function number(value: unknown, path: string, min = 0) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min)
    fail(path);
}
function boolean(value: unknown, path: string) {
  if (typeof value !== 'boolean') fail(path);
}
function array(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) return fail(path);
  return value;
}
function strings(value: unknown, path: string) {
  array(value, path).forEach((v, i) => text(v, `${path}[${i}]`));
}
function enumeration(value: unknown, values: readonly unknown[], path: string) {
  if (!values.includes(value)) fail(path);
}
function optional(
  row: Obj,
  key: string,
  path: string,
  check: (v: unknown, path: string) => void,
) {
  if (row[key] !== undefined) check(row[key], `${path}.${key}`);
}
function date(value: unknown, path: string) {
  text(value, path, false);
  if (!Number.isFinite(new Date(value as string).getTime())) fail(path);
}
function merged(defaults: Obj, value: unknown, path: string): Obj {
  const result = {
    ...defaults,
    ...(value === undefined ? {} : object(value, path)),
  };
  for (const [key, fallback] of Object.entries(defaults)) {
    const field = `${path}.${key}`;
    if (typeof fallback === 'number') number(result[key], field);
    else if (typeof fallback === 'string') text(result[key], field);
    else if (typeof fallback === 'boolean') boolean(result[key], field);
    else if (Array.isArray(fallback)) array(result[key], field);
  }
  return result;
}
function snapshotMetadata(row: Obj, path: string) {
  if (row.mode !== undefined)
    enumeration(row.mode, ['', 'time', 'cardio'], `${path}.mode`);
  if (row.loadKind !== undefined)
    enumeration(
      row.loadKind,
      ['external', 'added', 'assistance', 'none'],
      `${path}.loadKind`,
    );
}
function setRow(value: unknown, path: string, active: boolean): Obj {
  const row: Obj = { kind: 'normal', ...object(value, path) };
  number(row.reps, `${path}.reps`);
  number(row.weight, `${path}.weight`);
  enumeration(
    row.kind,
    ['normal', 'warmup', 'drop', 'failure', 'restPause', 'cluster'],
    `${path}.kind`,
  );
  for (const key of ['sec', 'km', 'left', 'right', 'repsR', 'rest'])
    optional(row, key, path, number);
  optional(row, 'rpe', path, (v, p) => {
    number(v, p);
    if ((v as number) > 10) fail(p);
  });
  optional(row, 'note', path, text);
  if (active) {
    row.done ??= false;
    boolean(row.done, `${path}.done`);
  }
  return row;
}
function exerciseRow(value: unknown, path: string, active: boolean): Obj {
  const row = { ...object(value, path) };
  for (const key of ['id', 'name', 'primary'])
    text(row[key], `${path}.${key}`, false);
  if (active) {
    text(row.uid, `${path}.uid`, false);
    optional(row, 'linkedNext', path, boolean);
    optional(row, 'swappedFrom', path, text);
  }
  snapshotMetadata(row, path);
  row.sets = array(row.sets, `${path}.sets`).map((v, i) =>
    setRow(v, `${path}.sets[${i}]`, active),
  );
  return row;
}

/** Shared validation for local hydration, file import and decrypted cloud snapshots. */
export function parseBackup(input: unknown): AppData {
  const raw = object(input, 'backup');
  if (raw.version !== undefined && raw.version !== 1) {
    throw new SnapshotValidationError(
      'This backup uses an unsupported version. Your current log has not changed.',
    );
  }
  array(raw.sessions, 'sessions');
  array(raw.routines, 'routines');
  const defaults = defaultData();
  const data: Obj = { ...defaults, ...raw, version: 1 };
  delete data.__storageRevision;
  delete data.__storageCommit;
  delete data.__accountSync;
  boolean(data.onboarded, 'onboarded');
  data.profile = merged(
    defaults.profile as unknown as Obj,
    raw.profile,
    'profile',
  );
  const profile = data.profile as Obj;
  enumeration(profile.sex, ['male', 'female', 'other'], 'profile.sex');
  optional(profile, 'since', 'profile', date);
  data.settings = merged(
    defaults.settings as unknown as Obj,
    raw.settings,
    'settings',
  );
  const settings = data.settings as Obj;
  enumeration(settings.unit, ['kg', 'lb'], 'settings.unit');
  enumeration(settings.theme, ['dark', 'light', 'system'], 'settings.theme');
  enumeration(settings.weekStart, [0, 1, 6], 'settings.weekStart');
  enumeration(settings.effort, ['off', 'rpe', 'rir'], 'settings.effort');
  array(settings.plates, 'settings.plates').forEach((v, i) =>
    number(v, `settings.plates[${i}]`, Number.MIN_VALUE),
  );
  data.sessions = (raw.sessions as unknown[]).map((v, i) => {
    const path = `sessions[${i}]`,
      row = { ...object(v, path) };
    text(row.id, `${path}.id`, false);
    date(row.date, `${path}.date`);
    number(row.durationSec, `${path}.durationSec`);
    for (const key of ['name', 'note', 'routineId'])
      optional(row, key, path, text);
    optional(row, 'deload', path, boolean);
    row.exercises = array(row.exercises, `${path}.exercises`).map((ex, j) =>
      exerciseRow(ex, `${path}.exercises[${j}]`, false),
    );
    return row;
  });
  data.routines = (raw.routines as unknown[]).map((v, i) => {
    const path = `routines[${i}]`,
      row: Obj = { sets: {}, rest: {}, ...object(v, path) };
    text(row.id, `${path}.id`, false);
    text(row.name, `${path}.name`);
    strings(row.exerciseIds, `${path}.exerciseIds`);
    optional(row, 'group', path, text);
    optional(row, 'color', path, number);
    optional(row, 'archived', path, boolean);
    for (const key of ['sets', 'rest'])
      for (const [id, value] of Object.entries(
        object(row[key], `${path}.${key}`),
      )) {
        number(value, `${path}.${key}.${id}`, key === 'sets' ? 1 : 0);
        if (key === 'sets' && !Number.isInteger(value))
          fail(`${path}.${key}.${id}`);
      }
    date(row.createdAt, `${path}.createdAt`);
    return row;
  });
  if (data.active !== null) {
    const active: Obj = {
      currentIndex: 0,
      pausedTotalSec: 0,
      ...object(data.active, 'active'),
    };
    text(active.id, 'active.id', false);
    number(active.startedAt, 'active.startedAt');
    for (const key of ['name', 'routineId'])
      optional(active, key, 'active', text);
    for (const key of ['manual', 'deload'])
      optional(active, key, 'active', boolean);
    number(active.currentIndex, 'active.currentIndex');
    number(active.pausedTotalSec, 'active.pausedTotalSec');
    for (const key of ['pausedAt', 'restEndsAt', 'restFrozen', 'restTotal'])
      optional(active, key, 'active', number);
    active.exercises = array(active.exercises, 'active.exercises').map(
      (ex, i) => exerciseRow(ex, `active.exercises[${i}]`, true),
    );
    active.currentIndex = Math.max(
      0,
      Math.min(
        Math.floor(active.currentIndex as number),
        (active.exercises as unknown[]).length - 1,
      ),
    );
    data.active = active;
  }
  for (const key of ['checkins', 'archived']) strings(data[key], key);
  for (const key of ['weekPlan', 'daysOff', 'favorites']) {
    const values = object(data[key], key);
    for (const [id, value] of Object.entries(values))
      (key === 'favorites' ? boolean : text)(value, `${key}.${id}`);
  }
  data.customExercises = array(data.customExercises, 'customExercises').map(
    (v, i) => {
      const path = `customExercises[${i}]`,
        row: Obj = {
          steps: [],
          aliases: [],
          art: '',
          mode: '',
          kind: 'strength',
          ...object(v, path),
        };
      for (const key of [
        'id',
        'name',
        'primary',
        'equipment',
        'difficulty',
        'art',
        'kind',
      ])
        text(row[key], `${path}.${key}`, !['id', 'name'].includes(key));
      strings(row.secondary, `${path}.secondary`);
      strings(row.steps, `${path}.steps`);
      strings(row.aliases, `${path}.aliases`);
      optional(row, 'suggestionGroup', path, text);
      snapshotMetadata(row, path);
      return row;
    },
  );
  const simpleRows: Record<
    string,
    { strings: string[]; numbers: string[]; dates?: string[] }
  > = {
    notes: {
      strings: ['id', 'exerciseId', 'kind', 'text'],
      numbers: [],
      dates: ['date', 'createdAt'],
    },
    bodyweights: { strings: [], numbers: ['kg'], dates: ['date'] },
    measures: { strings: ['id', 'key'], numbers: ['value'], dates: ['date'] },
    passes: { strings: ['id', 'name', 'code'], numbers: ['hue'] },
  };
  for (const [key, fields] of Object.entries(simpleRows)) {
    array(data[key], key).forEach((v, i) => {
      const path = `${key}[${i}]`,
        row = object(v, path);
      fields.strings.forEach((k) => text(row[k], `${path}.${k}`));
      fields.numbers.forEach((k) => number(row[k], `${path}.${k}`));
      fields.dates?.forEach((k) => date(row[k], `${path}.${k}`));
      if (key === 'notes') {
        enumeration(row.kind, ['note', 'plan', 'done', 'pain'], `${path}.kind`);
        optional(row, 'folder', path, text);
        optional(row, 'pinned', path, boolean);
      }
      if (key === 'bodyweights') optional(row, 'note', path, text);
      if (key === 'passes') optional(row, 'member', path, text);
    });
  }
  const nutrition = {
    ...defaults.nutrition,
    ...(raw.nutrition === undefined ? {} : object(raw.nutrition, 'nutrition')),
  } as unknown as Obj;
  nutrition.goals = merged(
    defaults.nutrition.goals as unknown as Obj,
    nutrition.goals,
    'nutrition.goals',
  );
  boolean(nutrition.goalsSet, 'nutrition.goalsSet');
  for (const [key, value] of Object.entries(
    object(nutrition.water, 'nutrition.water'),
  ))
    number(value, `nutrition.water.${key}`);
  for (const key of ['entries', 'customFoods'])
    array(nutrition[key], `nutrition.${key}`).forEach((v, i) => {
      const path = `nutrition.${key}[${i}]`,
        row = object(v, path);
      text(row.id, `${path}.id`, false);
      text(row.name, `${path}.name`);
      for (const field of ['kcal', 'protein', 'carbs', 'fat'])
        number(row[field], `${path}.${field}`);
      for (const field of ['fiber', 'sugar', 'sodium'])
        optional(row, field, path, number);
      if (key === 'entries') {
        optional(row, 'foodId', path, text);
        number(row.grams, `${path}.grams`, Number.MIN_VALUE);
        date(row.date, `${path}.date`);
        date(row.createdAt, `${path}.createdAt`);
        enumeration(
          row.meal,
          ['breakfast', 'lunch', 'dinner', 'snacks'],
          `${path}.meal`,
        );
      } else number(row.serving, `${path}.serving`, Number.MIN_VALUE);
    });
  data.nutrition = nutrition;
  optional(data, 'bodyGoalKg', 'backup', number);
  return data as unknown as AppData;
}
