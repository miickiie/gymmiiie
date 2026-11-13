import 'fake-indexeddb/auto';
import { clear, get, set } from 'idb-keyval';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as db from './db';
import { defaultData, useStore } from './store';
import { EXERCISES } from './exercises';
import { readPendingSnapshot, writePendingSnapshot } from './pendingSnapshot';

const bench = EXERCISES.find((e) => e.name === 'Barbell Bench Press')!;
beforeEach(async () => {
  vi.restoreAllMocks();
  await useStore
    .getState()
    .flushPersistence()
    .catch(() => undefined);
  useStore.setState({
    data: defaultData(),
    hydrated: false,
    persistenceStatus: 'loading',
    persistenceError: null,
    isCommitting: false,
  });
  await clear();
  await useStore.getState().hydrate();
});
afterEach(async () => {
  vi.restoreAllMocks();
  await useStore
    .getState()
    .flushPersistence()
    .catch(() => undefined);
  vi.unstubAllGlobals();
});

function sessionJournal() {
  const values = new Map<string, string>();
  vi.stubGlobal('sessionStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
  });
}

describe('durable workout state', () => {
  it('replays the latest per-tab journal after a reload before its first write committed', async () => {
    sessionJournal();
    const latest = {
      ...defaultData(),
      profile: { ...defaultData().profile, name: 'latest unsaved' },
    };
    writePendingSnapshot({ version: 1, data: latest, baseRevision: 0 });
    useStore.setState({ hydrated: false });
    await useStore.getState().hydrate();
    expect(useStore.getState().data).toEqual(latest);
    expect((await db.loadPersisted())?.data).toEqual(latest);
    expect(readPendingSnapshot()).toBeUndefined();
  });

  it('replays pending B over committed in-flight A only when the private commit token proves ownership', async () => {
    sessionJournal();
    const a = {
      ...defaultData(),
      profile: { ...defaultData().profile, name: 'in-flight A' },
    };
    const b = {
      ...defaultData(),
      profile: { ...defaultData().profile, name: 'latest B' },
    };
    await db.savePersisted(a, 0, 'our-in-flight-write');
    writePendingSnapshot({
      version: 1,
      data: b,
      baseRevision: 0,
      inFlightToken: 'our-in-flight-write',
    });
    useStore.setState({ hydrated: false });
    await useStore.getState().hydrate();
    expect(useStore.getState().data).toEqual(b);
    expect((await db.loadPersisted())?.revision).toBe(2);
    expect((await db.loadPersisted())?.data).toEqual(b);
  });

  it('keeps an unrelated newer tab durable and exposes the journal as an unsaved conflict copy', async () => {
    sessionJournal();
    const other = {
      ...defaultData(),
      profile: { ...defaultData().profile, name: 'other tab' },
    };
    const local = {
      ...defaultData(),
      profile: { ...defaultData().profile, name: 'this unsaved tab' },
    };
    await db.savePersisted(other, 0, 'unrelated-write');
    writePendingSnapshot({
      version: 1,
      data: local,
      baseRevision: 0,
      inFlightToken: 'our-write',
    });
    useStore.setState({ hydrated: false });
    await useStore.getState().hydrate();
    expect(useStore.getState().persistenceStatus).toBe('conflict');
    expect(useStore.getState().data).toEqual(local);
    expect((await db.loadPersisted())?.data).toEqual(other);
    expect(readPendingSnapshot()).toBeDefined();
    await useStore.getState().reloadPersisted();
    expect(useStore.getState().data).toEqual(other);
    expect(readPendingSnapshot()).toBeUndefined();
  });

  it('does not replay a journal when the durable database cannot be read', async () => {
    sessionJournal();
    const other = defaultData();
    await db.savePersisted(other, 0);
    writePendingSnapshot({
      version: 1,
      data: { ...other, onboarded: true },
      baseRevision: 1,
    });
    useStore.setState({ hydrated: false });
    vi.spyOn(db, 'loadPersisted').mockRejectedValueOnce(
      new Error('read denied'),
    );
    await useStore.getState().hydrate();
    expect(useStore.getState().hydrated).toBe(false);
    expect(useStore.getState().persistenceStatus).toBe('error');
    expect((await db.loadPersisted())?.data).toEqual(other);
    expect(readPendingSnapshot()).toBeDefined();
  });

  it('distinguishes a transient journal read failure from an absent journal and safely retries', async () => {
    sessionJournal();
    const latest = {
      ...defaultData(),
      profile: {
        ...defaultData().profile,
        name: 'pending survives read failure',
      },
    };
    writePendingSnapshot({ version: 1, data: latest, baseRevision: 0 });
    vi.spyOn(sessionStorage, 'getItem').mockImplementationOnce(() => {
      throw new Error('temporarily unavailable');
    });
    useStore.setState({ hydrated: false });
    await useStore.getState().hydrate();
    expect(useStore.getState().hydrated).toBe(false);
    expect(useStore.getState().persistenceStatus).toBe('error');
    expect(await db.loadPersisted()).toBeNull();
    await useStore.getState().retryPersistence();
    expect(useStore.getState().data).toEqual(latest);
    expect((await db.loadPersisted())?.data).toEqual(latest);
  });

  it('exports both raw durable data and the pending journal when storage metadata is invalid', async () => {
    sessionJournal();
    const raw = {
      ...defaultData(),
      futureRecords: ['keep raw'],
      __storageRevision: 'invalid-metadata',
    };
    await set('gymmiie:data:v1', raw);
    const pending = {
      version: 1 as const,
      data: { ...defaultData(), onboarded: true },
      baseRevision: 0,
    };
    writePendingSnapshot(pending);
    useStore.setState({ hydrated: false });
    await useStore.getState().hydrate();
    expect(useStore.getState().hydrated).toBe(false);
    const download = vi
      .spyOn(db, 'downloadFile')
      .mockImplementation(() => undefined);
    await useStore.getState().recoveryExport();
    expect(JSON.parse(download.mock.calls[0][1])).toEqual({
      saved: raw,
      pending,
    });
  });

  it('preserves an unsaved conflict copy if another writer wins between recovery read and replay', async () => {
    sessionJournal();
    const local = {
      ...defaultData(),
      profile: { ...defaultData().profile, name: 'local pending' },
    };
    const other = {
      ...defaultData(),
      profile: { ...defaultData().profile, name: 'racing writer' },
    };
    writePendingSnapshot({ version: 1, data: local, baseRevision: 0 });
    useStore.setState({ hydrated: false });
    const original = db.savePersisted;
    vi.spyOn(db, 'savePersisted').mockImplementationOnce(
      async (data, revision, token) => {
        await original(other, revision, 'other-writer');
        return original(data, revision, token);
      },
    );
    await useStore.getState().hydrate();
    expect(useStore.getState().hydrated).toBe(true);
    expect(useStore.getState().persistenceStatus).toBe('conflict');
    expect(useStore.getState().data).toEqual(local);
    expect((await db.loadPersisted())?.data).toEqual(other);
  });

  it('journals the authorized finish candidate rather than reverting a durable finish to its old active workout', async () => {
    sessionJournal();
    useStore.getState().startFromExercises([bench.id]);
    const uid = useStore.getState().data.active!.exercises[0].uid;
    useStore.getState().updateSet(uid, 0, { done: true });
    await useStore.getState().flushPersistence();
    const original = db.savePersisted;
    let release!: () => void;
    const wait = new Promise<void>((resolve) => {
      release = resolve;
    });
    vi.spyOn(db, 'savePersisted').mockImplementationOnce(
      async (data, revision, token) => {
        await wait;
        return original(data, revision, token);
      },
    );
    const finish = useStore.getState().finishSession();
    expect(readPendingSnapshot()).toMatchObject({
      data: { active: null, sessions: [{ exercises: [{ id: bench.id }] }] },
    });
    release();
    expect((await finish).status).toBe('saved');
    expect(readPendingSnapshot()).toBeUndefined();
  });
  it('keeps load errors distinct from an empty new log', async () => {
    await set('gymmiie:data:v1', { ...defaultData(), onboarded: true });
    useStore.setState({ hydrated: false });
    vi.spyOn(db, 'loadPersisted').mockRejectedValueOnce(
      new Error('storage denied'),
    );
    await useStore.getState().hydrate();
    expect(useStore.getState().hydrated).toBe(false);
    expect(useStore.getState().persistenceStatus).toBe('error');
    expect((await get('gymmiie:data:v1')).onboarded).toBe(true);
  });

  it('rejects malformed replacement without changing memory or disk', async () => {
    useStore.getState().setProfile({ name: 'keep me' });
    await useStore.getState().flushPersistence();
    const before = useStore.getState().data;
    await expect(
      useStore
        .getState()
        .replaceData({ sessions: [], routines: [], settings: null }),
    ).rejects.toThrow();
    expect(useStore.getState().data).toBe(before);
    expect((await db.loadPersisted())?.data).toEqual(before);
  });

  it('exports the original future-format record after hydration validation fails', async () => {
    const original = {
      ...defaultData(),
      version: 99,
      futureRecords: ['preserve me'],
      __storageRevision: 8,
    };
    await set('gymmiie:data:v1', original);
    useStore.setState({ hydrated: false });
    await useStore.getState().hydrate();
    expect(useStore.getState().hydrated).toBe(false);
    const download = vi
      .spyOn(db, 'downloadFile')
      .mockImplementation(() => undefined);
    await useStore.getState().recoveryExport();
    expect(JSON.parse(download.mock.calls[0][1])).toEqual(original);
    expect(JSON.parse(download.mock.calls[0][1])).not.toEqual(defaultData());
  });

  it('leaves valid current state intact if a replacement cannot be persisted', async () => {
    useStore.getState().setProfile({ name: 'original' });
    await useStore.getState().flushPersistence();
    const candidate = {
      ...defaultData(),
      profile: { ...defaultData().profile, name: 'replacement' },
    };
    vi.spyOn(db, 'savePersisted').mockRejectedValueOnce(
      new Error('quota full'),
    );
    await expect(useStore.getState().replaceData(candidate)).rejects.toThrow(
      'quota full',
    );
    expect(useStore.getState().data.profile.name).toBe('original');
    expect((await db.loadPersisted())?.data).toMatchObject({
      profile: { name: 'original' },
    });
  });

  it('serializes rapid changes and persists the latest snapshot', async () => {
    const original = db.savePersisted;
    let release!: () => void;
    const wait = new Promise<void>((resolve) => {
      release = resolve;
    });
    const spy = vi
      .spyOn(db, 'savePersisted')
      .mockImplementationOnce(async (data, revision) => {
        await wait;
        return original(data, revision);
      });
    useStore.getState().setSettings({ restSec: 30 });
    const pending = useStore.getState().flushPersistence();
    useStore.getState().setSettings({ restSec: 45 });
    release();
    await pending;
    expect((await db.loadPersisted())?.data).toMatchObject({
      settings: { restSec: 45 },
    });
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('drains a delayed older save before durable replacement and blocks overlapping edits', async () => {
    const original = db.savePersisted;
    let release!: () => void;
    const wait = new Promise<void>((resolve) => {
      release = resolve;
    });
    vi.spyOn(db, 'savePersisted').mockImplementationOnce(
      async (data, revision) => {
        await wait;
        return original(data, revision);
      },
    );
    useStore.getState().setProfile({ name: 'older' });
    const pending = useStore.getState().flushPersistence();
    const replacement = {
      ...defaultData(),
      profile: { ...defaultData().profile, name: 'restored' },
    };
    const restore = useStore.getState().replaceData(replacement);
    useStore.getState().setProfile({ name: 'must not overlap' });
    release();
    await pending;
    await restore;
    expect(useStore.getState().data).toEqual(replacement);
    expect((await db.loadPersisted())?.data).toEqual(replacement);
    await useStore.getState().flushPersistence();
    expect((await db.loadPersisted())?.data).toEqual(replacement);
  });

  it('retains unsaved state and blocks editing after a cross-tab conflict', async () => {
    await db.savePersisted(
      {
        ...defaultData(),
        profile: { ...defaultData().profile, name: 'other tab' },
      },
      0,
    );
    useStore.getState().setProfile({ name: 'unsaved tab' });
    await expect(useStore.getState().flushPersistence()).rejects.toBeInstanceOf(
      db.PersistenceConflictError,
    );
    expect(useStore.getState().data.profile.name).toBe('unsaved tab');
    useStore.getState().setProfile({ name: 'must not apply' });
    expect(useStore.getState().data.profile.name).toBe('unsaved tab');
    await useStore.getState().reloadPersisted();
    expect(useStore.getState().data.profile.name).toBe('other tab');
    expect(useStore.getState().persistenceStatus).toBe('idle');
  });

  it('refuses all implicit starts while a workout is active', () => {
    expect(useStore.getState().startEmpty().status).toBe('started');
    const active = useStore.getState().data.active;
    expect(useStore.getState().startEmpty().status).toBe('active-exists');
    expect(useStore.getState().startFromExercises([bench.id]).status).toBe(
      'active-exists',
    );
    expect(useStore.getState().startFromRoutine('missing').status).toBe(
      'active-exists',
    );
    expect(useStore.getState().startFromSession('missing').status).toBe(
      'active-exists',
    );
    expect(useStore.getState().data.active).toBe(active);
  });

  it('reports unresolved exercise/routine starts instead of silently creating empty workouts', () => {
    expect(useStore.getState().startFromExercises(['missing']).status).toBe(
      'not-found',
    );
    const id = useStore.getState().createRoutine({
      name: 'Deleted custom',
      exerciseIds: ['missing'],
      sets: {},
      rest: {},
    });
    expect(useStore.getState().startFromRoutine(id).status).toBe('not-found');
    expect(useStore.getState().startFromMuscles([]).status).toBe('not-found');
    expect(useStore.getState().data.active).toBeNull();
    expect(useStore.getState().startEmpty().status).toBe('started');
  });

  it('locks paused logging and finishes with frozen duration', async () => {
    const now = vi
      .spyOn(Date, 'now')
      .mockReturnValue(Date.parse('2026-01-01T00:00:00Z'));
    useStore.getState().startFromExercises([bench.id]);
    const uid = useStore.getState().data.active!.exercises[0].uid;
    useStore.getState().updateSet(uid, 0, { weight: 20, reps: 10, done: true });
    useStore.getState().startRest(90);
    now.mockReturnValue(Date.parse('2026-01-01T00:00:10Z'));
    useStore.getState().toggleSessionPause();
    const paused = useStore.getState().data.active;
    expect(paused?.restFrozen).toBe(80);
    useStore.getState().updateSet(uid, 0, { reps: 99 });
    useStore.getState().toggleSet(uid, 0);
    useStore.getState().addSet(uid);
    useStore.getState().removeSessionExercise(uid);
    useStore.getState().startRest(100);
    useStore.getState().skipRest();
    useStore.getState().removeSet(uid, 0);
    useStore.getState().nudgeRest(30);
    useStore.getState().addExerciseToSession(EXERCISES[0].id);
    useStore.getState().replaceSessionExercise(uid, EXERCISES[0].id);
    useStore.getState().moveSessionExercise(0, 1);
    useStore.getState().setCurrentExercise(2);
    expect(useStore.getState().data.active).toBe(paused);
    now.mockReturnValue(Date.parse('2026-01-01T00:02:00Z'));
    const result = await useStore.getState().finishSession();
    expect(result.status).toBe('saved');
    expect(useStore.getState().data.sessions[0].durationSec).toBe(10);
    expect((await db.loadPersisted())?.data).toMatchObject({
      active: null,
      sessions: [{ durationSec: 10 }],
    });
  });

  it('keeps the active workout if durable finish fails, then supports retry', async () => {
    useStore.getState().startFromExercises([bench.id]);
    const uid = useStore.getState().data.active!.exercises[0].uid;
    useStore.getState().updateSet(uid, 0, { done: true });
    vi.spyOn(db, 'savePersisted').mockRejectedValueOnce(
      new Error('quota full'),
    );
    expect(await useStore.getState().finishSession()).toEqual({
      status: 'error',
      message: 'quota full',
    });
    expect(useStore.getState().data.active).not.toBeNull();
    expect(useStore.getState().data.sessions).toHaveLength(0);
    expect(useStore.getState().lastFinishedId).toBeNull();
    const failedSnapshot = useStore.getState().data;
    useStore.getState().setSettings({ restSec: 250 });
    useStore.getState().addMealEntry({
      date: '2026-01-01',
      meal: 'snacks',
      name: 'blocked',
      grams: 100,
      kcal: 20,
      protein: 0,
      carbs: 1,
      fat: 0,
    });
    expect(useStore.getState().data).toBe(failedSnapshot);
    await useStore.getState().retryPersistence();
    expect((await useStore.getState().finishSession()).status).toBe('saved');
    useStore.getState().startEmpty();
    expect(await useStore.getState().finishSession()).toEqual({
      status: 'empty',
    });
    expect(useStore.getState().lastFinishedId).toBeNull();
    expect(useStore.getState().data.sessions).toHaveLength(1);
  });

  it('prefills only later unfinished sets from the completed set', () => {
    useStore.getState().startFromExercises([bench.id, '25GPyDY']);
    useStore.getState().update((data) => {
      data.settings.autoRest = false;
      data.active!.exercises[0].sets = [
        { reps: 3, weight: 5, done: false, kind: 'normal' },
        { reps: 8, weight: 42.5, done: false, kind: 'normal' },
        {
          reps: 10,
          repsR: 6,
          weight: 10,
          done: false,
          kind: 'warmup',
          rest: 30,
          rpe: 6,
          note: 'Keep this note',
          editedFields: {},
        },
        { reps: 11, weight: 70, done: true, kind: 'normal' },
        { reps: 9, weight: 25, done: false, kind: 'normal', editedFields: {} },
      ];
    });
    const before = useStore.getState().data.active!;
    expect(useStore.getState().toggleSet(before.exercises[0].uid, 1)).toBe(true);
    const after = useStore.getState().data.active!;
    expect(after.exercises[0].sets).toEqual([
      before.exercises[0].sets[0],
      { ...before.exercises[0].sets[1], done: true },
      {
        reps: 8,
        weight: 42.5,
        done: false,
        kind: 'warmup',
        rest: 30,
        rpe: 6,
        note: 'Keep this note',
        editedFields: {},
      },
      before.exercises[0].sets[3],
      { reps: 8, weight: 42.5, done: false, kind: 'normal', editedFields: {} },
    ]);
    expect(after.exercises[1]).toEqual(before.exercises[1]);
  });

  it('prefills untouched fields while preserving independently edited weight and repetitions', () => {
    useStore.getState().startFromExercises([bench.id]);
    useStore.getState().setSettings({ autoRest: false });
    const uid = useStore.getState().data.active!.exercises[0].uid;
    useStore.getState().updateSet(uid, 0, { weight: 40, reps: 12 });
    useStore.getState().updateSet(uid, 1, { weight: 45 });
    useStore.getState().updateSet(uid, 2, { reps: 6 });

    useStore.getState().toggleSet(uid, 0);

    expect(useStore.getState().data.active!.exercises[0].sets[1]).toMatchObject({
      weight: 45, reps: 12, done: false,
    });
    expect(useStore.getState().data.active!.exercises[0].sets[2]).toMatchObject({
      weight: 40, reps: 6, done: false,
    });
  });

  it('preserves explicit default values and cleared right repetitions during automatic prefill', () => {
    useStore.getState().startFromExercises([bench.id]);
    useStore.getState().setSettings({ autoRest: false });
    const uid = useStore.getState().data.active!.exercises[0].uid;
    useStore.getState().updateSet(uid, 0, { weight: 50, reps: 12, repsR: 8 });
    useStore.getState().updateSet(uid, 1, { weight: 0, reps: 10 });
    useStore.getState().updateSet(uid, 2, { repsR: undefined });

    useStore.getState().toggleSet(uid, 0);

    expect(useStore.getState().data.active!.exercises[0].sets[1]).toMatchObject({
      weight: 0, reps: 10, repsR: 8,
    });
    const last = useStore.getState().data.active!.exercises[0].sets[2];
    expect(last).toMatchObject({ weight: 50, reps: 12 });
    expect(last.repsR).toBeUndefined();
  });

  it('retains per-field edit protection after persistence and hydration', async () => {
    useStore.getState().startFromExercises([bench.id]);
    useStore.getState().setSettings({ autoRest: false });
    const uid = useStore.getState().data.active!.exercises[0].uid;
    useStore.getState().updateSet(uid, 0, { weight: 40, reps: 12 });
    useStore.getState().updateSet(uid, 1, { weight: 45 });
    await useStore.getState().flushPersistence();
    useStore.setState({ data: defaultData(), hydrated: false });
    await useStore.getState().hydrate();

    useStore.getState().toggleSet(uid, 0);

    expect(useStore.getState().data.active!.exercises[0].sets[1]).toMatchObject({
      weight: 45, reps: 12, editedFields: { weight: true },
    });
  });

  it('preserves pending legacy rows whose edit provenance is unknown', () => {
    useStore.getState().startFromExercises([bench.id]);
    useStore.getState().setSettings({ autoRest: false });
    const uid = useStore.getState().data.active!.exercises[0].uid;
    useStore.getState().updateSet(uid, 0, { weight: 40, reps: 12 });
    useStore.getState().update((data) => {
      const legacy = data.active!.exercises[0].sets[1];
      legacy.weight = 45;
      legacy.reps = 7;
      delete legacy.editedFields;
    });

    useStore.getState().toggleSet(uid, 0);

    expect(useStore.getState().data.active!.exercises[0].sets[1]).toMatchObject({
      weight: 45, reps: 7,
    });
  });

  it('stores the actual workout start separately from the finish date', async () => {
    useStore.getState().startFromExercises([bench.id]);
    useStore.getState().setSettings({ autoRest: false });
    const startedAt = Date.now() - 120_000;
    useStore.getState().update((data) => { data.active!.startedAt = startedAt; });
    const uid = useStore.getState().data.active!.exercises[0].uid;
    useStore.getState().updateSet(uid, 0, { reps: 8, weight: 40 });
    useStore.getState().toggleSet(uid, 0);

    const result = await useStore.getState().finishSession();

    expect(result.status).toBe('saved');
    const saved = useStore.getState().data.sessions[0];
    expect(saved.startedAt).toBe(new Date(startedAt).toISOString());
    expect(new Date(saved.date).getTime()).toBeGreaterThanOrEqual(startedAt + 120_000);
  });

  it('can finish legacy active workouts with an out-of-range numeric start date', async () => {
    useStore.getState().startFromExercises([bench.id]);
    useStore.getState().setSettings({ autoRest: false });
    useStore.getState().update((data) => { data.active!.startedAt = 1e20; });
    const uid = useStore.getState().data.active!.exercises[0].uid;
    useStore.getState().updateSet(uid, 0, { weight: 40, reps: 8 });
    useStore.getState().toggleSet(uid, 0);

    const result = await useStore.getState().finishSession();

    expect(result.status).toBe('saved');
    expect(useStore.getState().data.sessions[0].startedAt).toBeUndefined();
  });

  it('rejects body fat above 100 without replacing a valid measurement', () => {
    useStore.getState().addMeasure('bodyfat', 16.5);
    useStore.getState().addMeasure('bodyfat', 101);
    expect(useStore.getState().data.measures).toHaveLength(1);
    expect(useStore.getState().data.measures[0].value).toBe(16.5);
    useStore.getState().addMeasure('bodyfat', 100);
    expect(useStore.getState().data.measures[0].value).toBe(100);
  });

  it('carries forward the latest completed left/right reps without propagating undo', () => {
    useStore.getState().startFromExercises([bench.id]);
    useStore.getState().update((data) => {
      data.settings.autoRest = false;
      data.active!.exercises[0].sets = [
        { reps: 12, repsR: 9, weight: 15, done: false, kind: 'normal' },
        { reps: 8, weight: 10, done: false, kind: 'normal', editedFields: {} },
        { reps: 8, weight: 10, done: false, kind: 'normal', editedFields: {} },
      ];
    });
    const uid = useStore.getState().data.active!.exercises[0].uid;
    useStore.getState().toggleSet(uid, 0);
    expect(useStore.getState().data.active!.exercises[0].sets[1]).toMatchObject({
      reps: 12,
      repsR: 9,
      weight: 15,
      done: false,
    });
    useStore.getState().updateSet(uid, 1, { reps: 10, repsR: 7, weight: 17.5 });
    useStore.getState().toggleSet(uid, 1);
    expect(useStore.getState().data.active!.exercises[0].sets[2]).toMatchObject({
      reps: 10,
      repsR: 7,
      weight: 17.5,
      done: false,
    });
    useStore.getState().updateSet(uid, 2, { reps: 6, weight: 20 });
    const next = useStore.getState().data.active!.exercises[0].sets[2];
    expect(useStore.getState().toggleSet(uid, 1)).toBe(false);
    expect(useStore.getState().data.active!.exercises[0].sets[2]).toEqual(next);
  });

  it('selects a newly added exercise without changing selection for a duplicate', () => {
    useStore.getState().startFromExercises([bench.id]);
    useStore.getState().addExerciseToSession('25GPyDY');
    expect(useStore.getState().data.active!.currentIndex).toBe(1);
    expect(useStore.getState().data.active!.exercises[1].id).toBe('25GPyDY');
    useStore.getState().setCurrentExercise(0);
    useStore.getState().addExerciseToSession('25GPyDY');
    expect(useStore.getState().data.active!.currentIndex).toBe(0);
    expect(useStore.getState().data.active!.exercises).toHaveLength(2);
  });

  it('honors routine working-set counts/rest and preserves unequal left/right reps on repeat', async () => {
    const id = useStore.getState().createRoutine({
      name: 'Two sets',
      exerciseIds: [bench.id],
      sets: { [bench.id]: 2 },
      rest: { [bench.id]: 42 },
    });
    useStore.getState().startFromRoutine(id);
    const ex = useStore.getState().data.active!.exercises[0];
    expect(ex.sets.filter((s) => s.kind !== 'warmup')).toHaveLength(2);
    expect(ex.sets.every((s) => s.rest === 42)).toBe(true);
    useStore.getState().updateSet(ex.uid, 0, { reps: 9, repsR: 5, done: true });
    const finished = await useStore.getState().finishSession();
    if (finished.status !== 'saved')
      throw new Error('Expected a saved workout');
    useStore.getState().startFromSession(finished.id);
    expect(useStore.getState().data.active!.exercises[0].sets[0]).toMatchObject(
      { reps: 9, repsR: 5, done: false },
    );
  });

  it('retains saved mode/load for custom history even after a catalog correction', async () => {
    const custom = {
      ...bench,
      id: 'custom:timed',
      name: 'Custom hold',
      mode: 'time' as const,
      loadKind: 'added' as const,
    };
    useStore.getState().addCustomExercise(custom);
    useStore.getState().startFromExercises([bench.id]);
    useStore.getState().addExerciseToSession(custom.id);
    const active = useStore.getState().data.active!;
    expect(active.exercises[0]).toMatchObject({
      mode: '',
      loadKind: bench.loadKind,
    });
    expect(active.exercises[1]).toMatchObject({
      mode: 'time',
      loadKind: 'added',
    });
    useStore
      .getState()
      .replaceSessionExercise(active.exercises[0].uid, custom.id);
    const swapped = useStore.getState().data.active!.exercises[0];
    expect(swapped).toMatchObject({ mode: 'time', loadKind: 'added' });
    useStore.getState().updateSet(swapped.uid, 0, { sec: 45, done: true });
    const result = await useStore.getState().finishSession();
    if (result.status !== 'saved') throw new Error('Expected a saved session');
    useStore.getState().deleteCustomExercise(custom.id);
    useStore
      .getState()
      .addCustomExercise({ ...custom, mode: '', loadKind: 'external' });
    useStore.getState().startFromSession(result.id);
    expect(useStore.getState().data.active!.exercises[0]).toMatchObject({
      id: custom.id,
      mode: 'time',
      loadKind: 'added',
    });
    expect(useStore.getState().data.sessions[0].exercises[0]).toMatchObject({
      mode: 'time',
      loadKind: 'added',
    });
  });

  it('supports subtracting water without allowing negative totals or invalid meals', () => {
    useStore.getState().addWater(250, '2026-01-01');
    useStore.getState().addWater(-500, '2026-01-01');
    expect(useStore.getState().data.nutrition.water['2026-01-01']).toBe(0);
    useStore.getState().addMealEntry({
      date: '2026-01-01',
      meal: 'snacks',
      name: 'invalid',
      grams: -1,
      kcal: 20,
      protein: 0,
      carbs: 1,
      fat: 0,
    });
    expect(useStore.getState().data.nutrition.entries).toHaveLength(0);
  });

  it('rejects completing empty metric sets but permits undoing imported invalid done sets', () => {
    const cardio = EXERCISES.find((e) => e.mode === 'cardio')!;
    useStore.getState().startFromExercises([cardio.id]);
    const ex = useStore.getState().data.active!.exercises[0];
    expect(useStore.getState().toggleSet(ex.uid, 0)).toBe(false);
    expect(useStore.getState().data.active!.exercises[0].sets[0].done).toBe(
      false,
    );
    useStore.getState().updateSet(ex.uid, 0, { km: 1 });
    expect(useStore.getState().toggleSet(ex.uid, 0)).toBe(true);
    useStore.getState().updateSet(ex.uid, 0, { km: 0 });
    expect(useStore.getState().toggleSet(ex.uid, 0)).toBe(false);
    expect(useStore.getState().data.active!.exercises[0].sets[0].done).toBe(
      false,
    );
  });

  it('rejects non-finite numeric actions before they can corrupt the saved log', async () => {
    const before = useStore.getState().data;
    useStore.getState().setProfile({ weightKg: Infinity });
    useStore.getState().setProfile({ heightCm: -1 });
    useStore.getState().setSettings({ plates: [20, Number('1e309')] });
    useStore.getState().setSettings({ restSec: NaN });
    useStore.getState().setSettings({ weeklyGoal: Infinity });
    useStore.getState().setNutritionGoals({ kcal: Infinity });
    useStore.getState().setNutritionGoals({ glassMl: 0 });
    useStore.getState().addBodyweight(Infinity);
    useStore.getState().addBodyweight(0);
    useStore.getState().addMeasure('waist', Infinity);
    useStore.getState().addMeasure('waist', -1);
    expect(useStore.getState().data).toBe(before);
    useStore.getState().setSettings({ restSec: 0 });
    useStore
      .getState()
      .setNutritionGoals({ kcal: 0, protein: 0, glassMl: 100 });
    useStore.getState().addBodyweight(70);
    useStore.getState().addMeasure('waist', 80);
    await useStore.getState().flushPersistence();
    await useStore.getState().reloadPersisted();
    expect(useStore.getState().data.settings.restSec).toBe(0);
    expect(useStore.getState().data.profile.weightKg).toBe(70);
    expect(useStore.getState().data.nutrition.goals.kcal).toBe(0);
    expect(useStore.getState().data.measures[0].value).toBe(80);
  });
});
