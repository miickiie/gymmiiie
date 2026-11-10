import { describe, expect, it } from 'vitest';
import { parseBackup } from './backup';
import { defaultData } from './defaults';

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
      { passes: [{ id: 'p', name: 'gym', code: '123', hue: 10, member: {} }] },
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
