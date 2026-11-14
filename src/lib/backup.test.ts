import { describe, expect, it } from 'vitest';
import { parseBackup } from './backup';
import { defaultData } from './defaults';

function activeWithEditedFields(editedFields: unknown) {
  return {
    ...defaultData(),
    active: {
      id: 'active', startedAt: Date.now(), currentIndex: 0, pausedTotalSec: 0,
      exercises: [{
        uid: 'bench', id: 'bench', name: 'Bench', primary: 'chest',
        sets: [{ reps: 8, weight: 40, done: false, kind: 'normal', editedFields }],
      }],
    },
  };
}

describe('backup validation', () => {
  it('normalizes legacy v1 missing nested fields without rewriting historical metrics', () => {
    const source = {
      sessions: [
        {
          id: 'old',
          date: '2025-01-02T00:00:00Z',
          durationSec: 120,
          exercises: [
            {
              id: 'custom-deleted',
              name: 'Old movement',
              primary: 'back',
              sets: [{ reps: 4, left: 7, right: 4, weight: 10, sec: 5 }],
            },
          ],
        },
      ],
      routines: [],
      settings: { unit: 'lb' },
      nutrition: { goals: { kcal: 1800 } },
    };
    const result = parseBackup(source);
    expect(result.version).toBe(1);
    expect(result.settings.restSec).toBe(90);
    expect(result.nutrition.goals.protein).toBe(160);
    expect(result.sessions[0].exercises[0].sets[0]).toEqual({
      kind: 'normal',
      reps: 4,
      left: 7,
      right: 4,
      weight: 10,
      sec: 5,
    });
    expect(result.sessions[0].exercises[0].mode).toBeUndefined();
  });

  it('round trips existing data and strips private storage revisions', () => {
    const data = defaultData();
    expect(parseBackup({ ...data, __storageRevision: 17 })).toEqual(data);
    expect(
      parseBackup({
        ...data,
        __storageRevision: 17,
        __storageCommit: 'private-local-token',
        __accountSync: {
          remoteRevision: 2,
          dirty: true,
          pending: { data: { private: 'outbox' } },
        },
      }),
    ).toEqual(data);
  });

  it('round trips per-field edits and leaves legacy edit provenance unknown', () => {
    const snapshot = activeWithEditedFields({ weight: true, reps: false });
    const restored = parseBackup(JSON.parse(JSON.stringify(snapshot)));
    expect(restored.active?.exercises[0].sets[0].editedFields).toEqual({
      weight: true, reps: false,
    });
    expect(parseBackup(activeWithEditedFields(undefined)).active?.exercises[0].sets[0].editedFields).toBeUndefined();
  });

  it.each([
    { editedFields: null },
    { editedFields: [] },
    { editedFields: { weight: 'yes' } },
    { editedFields: { unknown: true } },
  ])('rejects malformed set edit metadata: $editedFields', ({ editedFields }) => {
    expect(() => parseBackup(activeWithEditedFields(editedFields))).toThrow('editedFields');
  });

  it('preserves saved start timestamps and rejects invalid start dates', () => {
    const session = {
      id: 'workout', date: '2026-11-13T04:04:57.000Z',
      startedAt: '2026-11-13T04:02:45.000Z', durationSec: 132, exercises: [],
    };
    expect(parseBackup({ ...defaultData(), sessions: [session] }).sessions[0].startedAt).toBe(session.startedAt);
    expect(() => parseBackup({
      ...defaultData(), sessions: [{ ...session, startedAt: 'invalid' }],
    })).toThrow('sessions[0].startedAt');
  });

  it('keeps legacy body fat measurements readable for correction', () => {
    const data = defaultData();
    data.measures.push({ id: 'legacy', key: 'bodyfat', date: '2026-11-13', value: 101 });
    expect(parseBackup(data).measures[0].value).toBe(101);
  });

  it.each(['name', 'note', 'routineId'])(
    'rejects object-valued optional session %s before replacement',
    (field) => {
      const data = defaultData();
      const session = {
        id: 'w',
        date: '2026-01-01T00:00:00Z',
        durationSec: 1,
        exercises: [],
        [field]: { bad: true },
      };
      expect(() => parseBackup({ ...data, sessions: [session] })).toThrow(
        `sessions[0].${field}`,
      );
    },
  );

  it('validates optional rendered and behavior fields throughout restored records', () => {
    const badRows: Record<string, unknown>[] = [
      { active: { id: 's', startedAt: 1, exercises: [], name: {} } },
      { active: { id: 's', startedAt: 1, exercises: [], manual: 'yes' } },
      {
        notes: [
          {
            id: 'n',
            exerciseId: '',
            date: '2026-01-01',
            createdAt: '2026-01-01T00:00:00Z',
            kind: 'note',
            text: 'x',
            folder: {},
          },
        ],
      },
      {
        notes: [
          {
            id: 'n',
            exerciseId: '',
            date: '2026-01-01',
            createdAt: '2026-01-01T00:00:00Z',
            kind: 'note',
            text: 'x',
            pinned: {},
          },
        ],
      },
      {
        routines: [
          {
            id: 'r',
            name: 'r',
            createdAt: '2026-01-01T00:00:00Z',
            exerciseIds: [],
            group: {},
          },
        ],
      },
    ];
    for (const bad of badRows)
      expect(() => parseBackup({ ...defaultData(), ...bad })).toThrow();
  });

  it('normalizes a fractional active index to a valid integer', () => {
    const exercise = {
      id: 'e',
      uid: 'u',
      name: 'e',
      primary: 'chest',
      sets: [{ reps: 10, weight: 0, done: false }],
    };
    const data = parseBackup({
      ...defaultData(),
      active: {
        id: 's',
        startedAt: 1,
        currentIndex: 0.7,
        exercises: [exercise],
      },
    });
    expect(data.active?.currentIndex).toBe(0);
  });

  it.each([
    { ...defaultData(), version: 2 },
    { ...defaultData(), settings: null },
    { ...defaultData(), nutrition: { entries: null } },
    { ...defaultData(), active: { id: 'broken' } },
    {
      ...defaultData(),
      sessions: [{ id: 'x', date: 'bad', durationSec: 0, exercises: [] }],
    },
    {
      ...defaultData(),
      routines: [{ id: 'r', name: 'r', exerciseIds: [], sets: { x: -1 } }],
    },
  ])('rejects malformed/future input without modifying it', (input) => {
    const before = JSON.stringify(input);
    expect(() => parseBackup(input)).toThrow();
    expect(JSON.stringify(input)).toBe(before);
  });
});
