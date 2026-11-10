import rawFoods from '../data/foods.json';
import rawDishes from '../data/dishes.json';

export interface Food {
  id: string;
  name: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  sugar?: number;
  sodium?: number;
  kind?: string;
  portionGrams?: number;
  cat?: string;
  liquid?: boolean;
}

export interface DishItem {
  slug: string;
  grams: number;
}

export interface Dish {
  id: string;
  name: string;
  items: DishItem[];
}

export interface Macro {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  sugar?: number;
  sodium?: number;
}

export const FOODS = rawFoods as Food[];
export const DISHES = rawDishes as Dish[];

export const FOOD_CATEGORIES = [
  'fruit', 'veg', 'legume', 'nut', 'meat', 'fish', 'egg', 'dairy',
  'grain', 'bakery', 'oil', 'pantry', 'drink', 'sauce', 'spice',
] as const;

export const CATEGORY_LABEL: Record<string, string> = {
  fruit: 'Fruit', veg: 'Vegetables', legume: 'Legumes', nut: 'Nuts', meat: 'Meat', fish: 'Fish',
  egg: 'Eggs', dairy: 'Dairy', grain: 'Grains', bakery: 'Bakery', oil: 'Oils', pantry: 'Pantry',
  drink: 'Drinks', sauce: 'Sauces', spice: 'Spices',
};

export function fold(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

export function searchFoods(query: string, list: Food[] = FOODS): Food[] {
  const q = fold(query.trim());
  if (!q) return list;
  const words = q.split(/\s+/);
  return list.filter((f) => {
    const hay = fold(`${f.name} ${f.cat ?? ''}`);
    return words.every((w) => hay.includes(w));
  });
}

export function foodBySlug(slug: string): Food | undefined {
  return FOODS.find((f) => f.id === slug || f.id.endsWith(`:${slug}`) || f.id.replace(/^\w+:/, '') === slug);
}

export function foodMacros(food: Food, grams: number): Macro {
  const k = grams / 100;
  return {
    kcal: food.kcal * k,
    protein: food.protein * k,
    carbs: food.carbs * k,
    fat: food.fat * k,
    fiber: (food.fiber ?? 0) * k,
    sugar: (food.sugar ?? 0) * k,
    sodium: (food.sodium ?? 0) * k,
  };
}

export function dishWeight(dish: Dish): number {
  return dish.items.reduce((n, i) => n + i.grams, 0);
}

export function dishMacros(dish: Dish): Macro {
  const out: Macro = { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0 };
  for (const item of dish.items) {
    const f = foodBySlug(item.slug);
    if (!f) continue;
    const m = foodMacros(f, item.grams);
    out.kcal += m.kcal;
    out.protein += m.protein;
    out.carbs += m.carbs;
    out.fat += m.fat;
    out.fiber = (out.fiber ?? 0) + (m.fiber ?? 0);
    out.sugar = (out.sugar ?? 0) + (m.sugar ?? 0);
    out.sodium = (out.sodium ?? 0) + (m.sodium ?? 0);
  }
  return out;
}

export function foodPortion(food: Food): number {
  return food.portionGrams && food.portionGrams > 0 ? food.portionGrams : 100;
}

export function roundMacro(n: number, digits = 0): number {
  const f = Math.pow(10, digits);
  return Math.round(n * f) / f;
}
