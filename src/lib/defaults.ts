import type { AppData, NutritionGoals } from '../types';

const DEFAULT_GOALS: NutritionGoals = {
  kcal: 2400,
  protein: 160,
  carbs: 260,
  fat: 80,
  waterMl: 2500,
  glassMl: 250,
  fiber: 30,
};

export function defaultData(): AppData {
  return {
    version: 1,
    onboarded: false,
    profile: {
      name: '',
      sex: 'male',
      age: 28,
      heightCm: 175,
      weightKg: 75,
      activity: 1.55,
    },
    settings: {
      unit: 'kg',
      theme: 'dark',
      language: 'en',
      restSec: 90,
      miniRestSec: 20,
      weeklyGoal: 4,
      weekStart: 1,
      autoRest: true,
      autoAdvance: true,
      sound: true,
      vibrate: false,
      effort: 'off',
      barWeight: 20,
      plates: [25, 20, 15, 10, 5, 2.5, 1.25],
      countdown: false,
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
    nutrition: {
      goals: DEFAULT_GOALS,
      goalsSet: false,
      entries: [],
      water: {},
      customFoods: [],
    },
  } as AppData;
}
