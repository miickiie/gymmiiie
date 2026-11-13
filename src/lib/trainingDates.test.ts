import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LoggedSession } from '../types';
import { dateKey, sessionTrainingDate } from './date';
import { defaultData } from './defaults';
import {
  currentStreak,
  dailyVolume,
  daysDoneThisWeek,
  exerciseHistory,
  heatmapLevels,
  muscleSetsBetween,
  sessionVolumeOfDay,
  sortedSessions,
  weeklyVolume,
  workoutsThisWeek,
} from './stats';

function workout(start: Date, finish: Date): LoggedSession {
  return {
    id: start.toISOString(),
    startedAt: start.toISOString(),
    date: finish.toISOString(),
    durationSec: (finish.getTime() - start.getTime()) / 1000,
    exercises: [{
      id: 'bench', name: 'Bench press', primary: 'chest', mode: '', loadKind: 'external',
      sets: [
        { weight: 22.5, reps: 10, kind: 'normal' },
        { weight: 20, reps: 8, kind: 'normal' },
      ],
    }],
  };
}

afterEach(() => vi.useRealTimers());

describe('workout training dates', () => {
  it('counts a 23:50–01:15 workout and its start-day check-in as one training day', () => {
    const start = new Date(2026, 10, 13, 23, 50);
    const finish = new Date(2026, 10, 14, 1, 15);
    vi.useFakeTimers();
    vi.setSystemTime(finish);
    const saved = workout(start, finish);
    const data = defaultData();
    data.sessions = [saved];
    data.checkins = [dateKey(start)];
    data.settings.weekStart = 1;

    expect(sessionTrainingDate(saved)).toBe(start.toISOString());
    expect(daysDoneThisWeek(data)).toBe(1);
    expect(workoutsThisWeek(data)).toBe(1);
    expect(currentStreak(data)).toBe(1);
    expect(sessionVolumeOfDay(data.sessions, dateKey(start))).toBe(385);
    expect(sessionVolumeOfDay(data.sessions, dateKey(finish))).toBe(0);
    expect(dailyVolume(data.sessions, 2)).toEqual([
      { date: dateKey(start), value: 385 },
      { date: dateKey(finish), value: 0 },
    ]);
    expect(heatmapLevels(data.sessions, 2)).toEqual([4, 0]);
    expect(muscleSetsBetween(data.sessions, new Date(2026, 10, 13), new Date(2026, 10, 14))).toMatchObject({ chest: 2 });
    expect(muscleSetsBetween(data.sessions, new Date(2026, 10, 14), new Date(2026, 10, 15))).toEqual({});
  });

  it('keeps Sunday-night work in the previous week when it finishes Monday', () => {
    const start = new Date(2026, 10, 15, 23, 50);
    const finish = new Date(2026, 10, 16, 1, 15);
    vi.useFakeTimers();
    vi.setSystemTime(finish);
    const data = defaultData();
    data.settings.weekStart = 1;
    data.sessions = [workout(start, finish)];
    data.checkins = [dateKey(start)];

    expect(workoutsThisWeek(data)).toBe(0);
    expect(daysDoneThisWeek(data)).toBe(0);
    expect(currentStreak(data)).toBe(1);
    expect(weeklyVolume(data.sessions, 2).map((week) => week.value)).toEqual([385, 0]);
    expect(weeklyVolume(data.sessions, 2).map((week) => week.sets)).toEqual([2, 0]);
  });

  it('keeps the start month/year in exercise history and sorts by training start', () => {
    const overnight = workout(new Date(2026, 11, 31, 23, 50), new Date(2027, 0, 1, 1, 15));
    const laterStart = workout(new Date(2027, 0, 1, 0, 30), new Date(2027, 0, 1, 0, 40));

    expect(dateKey(sessionTrainingDate(overnight))).toBe('2026-12-31');
    expect(sortedSessions([overnight, laterStart]).map((entry) => entry.id)).toEqual([laterStart.id, overnight.id]);
    expect(exerciseHistory([overnight], 'bench')[0].date).toBe(overnight.startedAt);
  });

  it('uses the recorded date for legacy workouts without an actual start', () => {
    const start = new Date(2026, 10, 13, 23, 50);
    const finish = new Date(2026, 10, 14, 1, 15);
    const saved = workout(start, finish);
    delete saved.startedAt;
    vi.useFakeTimers();
    vi.setSystemTime(finish);

    expect(sessionTrainingDate(saved)).toBe(finish.toISOString());
    expect(sessionVolumeOfDay([saved], dateKey(start))).toBe(0);
    expect(sessionVolumeOfDay([saved], dateKey(finish))).toBe(385);
    expect(heatmapLevels([saved], 2)).toEqual([0, 4]);
  });
});
