import 'fake-indexeddb/auto';
import { clear } from 'idb-keyval';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import * as db from './db';
import { defaultData, useStore } from './store';
import { EXERCISES } from './exercises';

const exercise = EXERCISES.find(item => item.name === 'Barbell Bench Press')!;
const draft = { name: 'Reviewed routine', exerciseIds: [exercise.id], sets: { [exercise.id]: 4 }, rest: { [exercise.id]: 90 } };
beforeEach(async () => {
  vi.restoreAllMocks();
  await useStore.getState().flushPersistence().catch(() => undefined);
  useStore.setState({ data: defaultData(), account: null, accountMode: 'locked', cloudStatus: 'idle', hydrated: false, persistenceStatus: 'loading', isCommitting: false });
  await clear();
  await useStore.getState().hydrate();
  useStore.setState({ account: { id: 'owner', name: 'Owner' }, accountMode: 'online' });
});
afterEach(async () => {
  vi.restoreAllMocks();
  await useStore.getState().flushPersistence().catch(() => undefined);
});

it('reports success only after durable save and stores no historical weights or AI reasons', async () => {
  const save = vi.spyOn(db, 'savePersisted');
  const result = await useStore.getState().saveGeneratedRoutine(draft, 'owner');
  expect(result.status).toBe('saved');
  expect(save).toHaveBeenCalled();
  const routine = useStore.getState().data.routines.at(-1)!;
  expect(routine).toMatchObject(draft);
  expect(Object.keys(routine).sort()).toEqual(['createdAt', 'exerciseIds', 'id', 'name', 'rest', 'sets']);
  useStore.getState().startFromRoutine(routine.id);
  expect(useStore.getState().data.active?.exercises[0].sets.filter(set => set.kind !== 'warmup')).toHaveLength(4);
  expect(useStore.getState().data.active?.exercises[0].sets.every(set => set.rest === 90)).toBe(true);
});

it('does not save after account mismatch, persistence conflict, invalid values, or archived exercises', async () => {
  const initial = useStore.getState().data.routines.length;
  expect((await useStore.getState().saveGeneratedRoutine(draft, 'another-account')).status).toBe('error');
  useStore.setState({ persistenceStatus: 'conflict' });
  expect((await useStore.getState().saveGeneratedRoutine(draft, 'owner')).status).toBe('error');
  useStore.setState({ persistenceStatus: 'idle' });
  expect((await useStore.getState().saveGeneratedRoutine({ ...draft, sets: { [exercise.id]: 13 } }, 'owner')).status).toBe('error');
  useStore.setState(state => ({ data: { ...state.data, archived: [exercise.id] } }));
  expect((await useStore.getState().saveGeneratedRoutine(draft, 'owner')).status).toBe('error');
  expect(useStore.getState().data.routines).toHaveLength(initial);
});

it('keeps the draft unsaved if the durable write fails', async () => {
  vi.spyOn(db, 'savePersisted').mockRejectedValueOnce(new Error('Disk full'));
  const initial = useStore.getState().data.routines.length;
  expect((await useStore.getState().saveGeneratedRoutine(draft, 'owner')).status).toBe('error');
  expect(useStore.getState().data.routines).toHaveLength(initial);
});
