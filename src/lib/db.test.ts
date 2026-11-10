import 'fake-indexeddb/auto';
import { clear, get, set } from 'idb-keyval';
import { beforeEach, describe, expect, it } from 'vitest';
import { defaultData } from './defaults';
import { loadPersisted, PersistenceConflictError, savePersisted } from './db';

beforeEach(() => clear());

describe('local revision writes', () => {
  it('loads raw legacy v1 records as revision zero and keeps metadata private', async () => {
    const data = defaultData();
    await set('gymmiie:data:v1', data);
    expect(await loadPersisted()).toMatchObject({ data, revision: 0 });
    expect(await savePersisted(data, 0)).toBe(1);
    expect(await loadPersisted()).toMatchObject({ data, revision: 1 });
    expect((await get('gymmiie:data:v1')).__storageRevision).toBe(1);
  });

  it('atomically rejects one of two tabs writing the same revision', async () => {
    const one = {
      ...defaultData(),
      profile: { ...defaultData().profile, name: 'one' },
    };
    const two = {
      ...defaultData(),
      profile: { ...defaultData().profile, name: 'two' },
    };
    const results = await Promise.allSettled([
      savePersisted(one, 0),
      savePersisted(two, 0),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find((r) => r.status === 'rejected');
    expect(rejected?.status === 'rejected' && rejected.reason).toBeInstanceOf(
      PersistenceConflictError,
    );
    const saved = await loadPersisted();
    expect(saved?.revision).toBe(1);
  });
});
