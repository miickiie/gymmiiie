import {
  Apple,
  Beef,
  ChevronLeft,
  ChevronRight,
  Cookie,
  Droplets,
  Moon,
  Plus,
  Salad,
  Search,
  Settings2,
  Sun,
  Sunrise,
  Trash2,
  Utensils,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  Btn,
  Card,
  Chip,
  EmptyState,
  Field,
  NumericInput,
  PageHeader,
  Ring,
  SectionHeader,
  Segmented,
  Sheet,
  useToast,
} from '../components/ui';
import { addDaysKey, dateKey, fmtDate, parseKey } from '../lib/date';
import {
  CATEGORY_LABEL,
  DISHES,
  dishMacros,
  dishWeight,
  FOOD_CATEGORIES,
  foodMacros,
  foodPortion,
  FOODS,
  roundMacro,
  searchFoods,
  type Dish,
  type Food,
  type Macro,
} from '../lib/foods';
import { useI18n } from '../lib/i18n';
import { useStore } from '../lib/store';
import type { CustomFood, MealEntry } from '../types';

type Meal = MealEntry['meal'];
const MEALS: { id: Meal; label: string; icon: React.ReactNode }[] = [
  { id: 'breakfast', label: 'Breakfast', icon: <Sunrise size={16} /> },
  { id: 'lunch', label: 'Lunch', icon: <Sun size={16} /> },
  { id: 'dinner', label: 'Dinner', icon: <Moon size={16} /> },
  { id: 'snacks', label: 'Snacks', icon: <Cookie size={16} /> },
];

const TH: Record<string, string> = {
  Nutrition: 'อาหาร',
  'Fuel the work': 'เติมพลังให้การฝึก',
  '{foods} foods · {dishes} dishes · macros stay on your device':
    '{foods} อาหาร · {dishes} เมนู · ข้อมูลสารอาหารอยู่ในเครื่องคุณ',
  Goals: 'เป้าหมาย',
  Today: 'วันนี้',
  'of {n}': 'จาก {n}',
  '{n} kcal left': 'เหลือ {n} kcal',
  '{n} kcal over': 'เกิน {n} kcal',
  '{n} items logged · {p}g protein': 'บันทึก {n} รายการ · โปรตีน {p}g',
  Protein: 'โปรตีน',
  Carbs: 'คาร์บ',
  Fat: 'ไขมัน',
  Fiber: 'ไฟเบอร์',
  Sugar: 'น้ำตาล',
  'of {n}g': 'จาก {n}g',
  Water: 'น้ำ',
  '{water} ml · {n} of {total} glasses': '{water} ml · {n} จาก {total} แก้ว',
  '+{n}ml': '+{n} ml',
  'Nothing logged': 'ยังไม่บันทึก',
  Add: 'เพิ่ม',
  'Macro goals': 'เป้าหมายสารอาหาร',
  'Daily targets': 'เป้าหมายต่อวัน',
  Edit: 'แก้ไข',
  Calories: 'แคลอรี',
  'These are starter targets. Set your own to make them meaningful.':
    'นี่คือค่าเริ่มต้น ตั้งเป้าหมายของคุณเองเพื่อให้มีความหมาย',
  'Today’s plate': 'จานวันนี้',
  'Macro split': 'สัดส่วนสารอาหาร',
  'Quick add': 'เพิ่มเร็ว',
  'Food library': 'คลังอาหาร',
  'Add {name}': 'เพิ่ม {name}',
  'Browse all {n} foods': 'ดูอาหารทั้งหมด {n} รายการ',
  'Nutrition data is approximate and sourced from common food databases. It is a guide, not medical advice.':
    'ข้อมูลโภชนาการเป็นค่าประมาณจากฐานข้อมูลอาหารทั่วไป ใช้เป็นแนวทางเท่านั้น ไม่ใช่คำแนะนำทางการแพทย์',
  '{name} added': 'เพิ่ม {name} แล้ว',
  Breakfast: 'เช้า',
  Lunch: 'กลางวัน',
  Dinner: 'เย็น',
  Snacks: 'ของว่าง',
  'Add to {meal}': 'เพิ่มในมื้อ{meal}',
  'Portion in grams': 'ปริมาณเป็นกรัม',
  'Pick a food, dish or custom entry to continue.':
    'เลือกอาหาร เมนู หรือรายการที่สร้างเองเพื่อไปต่อ',
  'Enter a portion greater than zero grams.': 'ใส่ปริมาณมากกว่า 0 กรัม',
  'Nutrition amounts must be finite and cannot be negative.':
    'ค่าสารอาหารต้องเป็นจำนวนจริงและไม่ติดลบ',
  'Name your food.': 'ตั้งชื่ออาหาร',
  'Enter nonnegative, finite nutrition amounts per 100 g.':
    'ใส่ค่าสารอาหารต่อ 100 g ที่ไม่ติดลบ',
  'Custom food saved': 'บันทึกอาหารที่สร้างเองแล้ว',
  Foods: 'อาหาร',
  Dishes: 'เมนู',
  Custom: 'กำหนดเอง',
  'New food': 'สร้างอาหาร',
  'Food name': 'ชื่ออาหาร',
  '{macro} per 100 grams': '{macro} ต่อ 100 g',
  kcal: 'kcal',
  protein: 'โปรตีน',
  carbs: 'คาร์บ',
  fat: 'ไขมัน',
  'Values per 100 g.': 'ค่าต่อ 100 g',
  'Save custom food': 'บันทึกอาหารที่สร้างเอง',
  'Search foods…': 'ค้นหาอาหาร…',
  All: 'ทั้งหมด',
  Fruit: 'ผลไม้',
  Vegetables: 'ผัก',
  Legumes: 'ถั่วเมล็ด',
  Nuts: 'ถั่ว',
  Meat: 'เนื้อ',
  Fish: 'ปลา',
  Eggs: 'ไข่',
  Dairy: 'นม',
  Grains: 'ธัญพืช',
  Bakery: 'เบเกอรี',
  Oils: 'น้ำมัน',
  Pantry: 'ของแห้ง',
  Drinks: 'เครื่องดื่ม',
  Sauces: 'ซอส',
  Spices: 'เครื่องเทศ',
  food: 'อาหาร',
  'No foods match.': 'ไม่พบอาหารที่ตรงกัน',
  'No dishes match.': 'ไม่พบเมนูที่ตรงกัน',
  '{n} ingredients · {g} g': '{n} วัตถุดิบ · {g} g',
  'P{p} C{c} F{f} per 100g': 'P{p} C{c} F{f} ต่อ 100g',
  'No custom foods': 'ไม่มีอาหารที่สร้างเอง',
  'Create one with the New food button above.':
    'สร้างได้จากปุ่มสร้างอาหารด้านบน',
  'Selected: {name}': 'เลือก: {name}',
  'Daily goals': 'เป้าหมายต่อวัน',
  'Glass size': 'ขนาดแก้ว',
  'Use finite, nonnegative goals and a glass size greater than zero.':
    'ใส่เป้าหมายที่ไม่ติดลบ และขนาดแก้วมากกว่า 0',
  'Save goals': 'บันทึกเป้าหมาย',
  'Goals saved': 'บันทึกเป้าหมายแล้ว',
  'Targets are personal. Adjust them with a coach or dietitian if you have specific health goals.':
    'เป้าหมายขึ้นกับแต่ละคน ปรับกับโค้ชหรือนักโภชนาการถ้ามีเป้าหมายสุขภาพเฉพาะ',
};

export default function Nutrition() {
  const { t } = useI18n(TH);
  const toast = useToast();
  const data = useStore((s) => s.data);
  const addMealEntry = useStore((s) => s.addMealEntry);
  const deleteMealEntry = useStore((s) => s.deleteMealEntry);
  const addWater = useStore((s) => s.addWater);
  const [day, setDay] = useState(dateKey());
  const [addOpen, setAddOpen] = useState(false);
  const [initialFood, setInitialFood] = useState<Food | null>(null);
  const [meal, setMeal] = useState<Meal>('breakfast');
  const [goalsOpen, setGoalsOpen] = useState(false);

  const goals = data.nutrition.goals;
  const entries = data.nutrition.entries.filter((e) => e.date === day);
  const totals = entries.reduce(
    (t, e) => ({
      kcal: t.kcal + e.kcal,
      protein: t.protein + e.protein,
      carbs: t.carbs + e.carbs,
      fat: t.fat + e.fat,
      fiber: t.fiber + (e.fiber ?? 0),
      sugar: t.sugar + (e.sugar ?? 0),
      sodium: t.sodium + (e.sodium ?? 0),
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0 },
  );
  const water = data.nutrition.water[day] ?? 0;
  const glass = goals.glassMl || 250;
  const glasses = Math.round(water / glass);
  const kcalPct = Math.min(100, (totals.kcal / Math.max(1, goals.kcal)) * 100);
  const remaining = goals.kcal - totals.kcal;
  const isToday = day === dateKey();

  const openAdd = (m: Meal) => {
    setInitialFood(null);
    setMeal(m);
    setAddOpen(true);
  };

  return (
    <div className="page-enter">
      <PageHeader
        eyebrow={t('Nutrition')}
        title={t('Fuel the work')}
        subtitle={t(
          '{foods} foods · {dishes} dishes · macros stay on your device',
          { foods: FOODS.length, dishes: DISHES.length },
        )}
        action={
          <Btn
            variant="soft"
            size="sm"
            onClick={() => setGoalsOpen(true)}
            icon={<Settings2 size={14} />}
          >
            {t('Goals')}
          </Btn>
        }
      />

      <Card className="mb-4 flex flex-wrap items-center gap-2 p-3">
        <button
          onClick={() => setDay(addDaysKey(day, -1))}
          className="grid h-9 w-9 place-items-center rounded-full bg-[var(--surface-2)] text-dim"
        >
          <ChevronLeft size={17} />
        </button>
        <div className="text-center">
          <p className="text-sm font-black">
            {isToday
              ? t('Today')
              : fmtDate(parseKey(day), { weekday: 'long' })}
          </p>
          <p className="text-[10px] font-bold text-mute">
            {fmtDate(parseKey(day), {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </p>
        </div>
        <button
          onClick={() => setDay(addDaysKey(day, 1))}
          className="grid h-9 w-9 place-items-center rounded-full bg-[var(--surface-2)] text-dim"
        >
          <ChevronRight size={17} />
        </button>
        <input
          type="date"
          className="input ml-auto max-w-[160px] !py-1.5 text-xs"
          value={day}
          onChange={(e) => e.target.value && setDay(e.target.value)}
        />
        {!isToday && (
          <Btn size="sm" variant="soft" onClick={() => setDay(dateKey())}>
            {t('Today')}
          </Btn>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        <div>
          <Card className="p-5">
            <div className="flex flex-wrap items-center gap-5">
              <Ring value={kcalPct} size={112} stroke={9}>
                <div className="text-center">
                  <p className="num text-2xl font-black leading-none">
                    {Math.round(totals.kcal)}
                  </p>
                  <p className="text-[9px] font-black uppercase text-mute">
                    {t('of {n}', { n: goals.kcal })}
                  </p>
                </div>
              </Ring>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-black">
                  {remaining >= 0
                    ? t('{n} kcal left', { n: Math.round(remaining) })
                    : t('{n} kcal over', { n: Math.round(-remaining) })}
                </p>
                <p className="mt-0.5 text-[11px] font-semibold text-mute">
                  {t('{n} items logged · {p}g protein', {
                    n: entries.length,
                    p: Math.round(totals.protein),
                  })}
                </p>
                <div className="mt-3 space-y-2">
                  <MacroBar
                    label={t('Protein')}
                    value={totals.protein}
                    goal={goals.protein}
                    tone="var(--accent)"
                  />
                  <MacroBar
                    label={t('Carbs')}
                    value={totals.carbs}
                    goal={goals.carbs}
                    tone="var(--good)"
                  />
                  <MacroBar
                    label={t('Fat')}
                    value={totals.fat}
                    goal={goals.fat}
                    tone="var(--warn)"
                  />
                </div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {[
                {
                  label: 'Protein',
                  v: totals.protein,
                  g: goals.protein,
                  unit: 'g',
                },
                { label: 'Fiber', v: totals.fiber, g: goals.fiber, unit: 'g' },
                { label: 'Sugar', v: totals.sugar, g: 0, unit: 'g' },
              ].map((m) => (
                <div
                  key={m.label}
                  className="rounded-xl bg-[var(--surface-2)] p-2.5"
                >
                  <p className="label">{t(m.label)}</p>
                  <p className="num mt-0.5 text-base font-black">
                    {Math.round(m.v)}
                    <span className="text-[10px] text-mute">{m.unit}</span>
                  </p>
                  {m.g > 0 && (
                    <p className="text-[9px] font-bold text-mute">
                      {t('of {n}g', { n: m.g })}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </Card>

          <SectionHeader
            title={t('Water')}
            subtitle={t('{water} ml · {n} of {total} glasses', {
              water,
              n: glasses,
              total: Math.ceil(goals.waterMl / glass),
            })}
            action={
              <div className="flex gap-1">
                <Btn
                  size="sm"
                  variant="soft"
                  onClick={() => addWater(-glass, day)}
                >
                  −
                </Btn>
                <Btn
                  size="sm"
                  variant="primary"
                  onClick={() => addWater(glass, day)}
                  icon={<Droplets size={13} />}
                >
                  {t('+{n}ml', { n: glass })}
                </Btn>
              </div>
            }
          />
          <Card className="p-4">
            <div className="flex flex-wrap gap-1.5">
              {Array.from(
                { length: Math.max(8, Math.ceil(goals.waterMl / glass)) },
                (_, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      const next = (i + 1) * glass;
                      useStore
                        .getState()
                        .setWater(next <= water ? i * glass : next, day);
                    }}
                    className={`grid h-9 flex-1 place-items-center rounded-lg border transition ${i < glasses ? 'border-transparent bg-[var(--accent)]/20 text-[var(--accent)]' : 'border-line bg-[var(--surface-2)] text-mute'}`}
                    title={`${(i + 1) * glass} ml`}
                  >
                    <Droplets
                      size={15}
                      fill={i < glasses ? 'currentColor' : 'none'}
                    />
                  </button>
                ),
              )}
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--surface-3)]">
              <div
                className="h-full rounded-full bg-[var(--accent)]"
                style={{
                  width: `${Math.min(100, (water / Math.max(1, goals.waterMl)) * 100)}%`,
                }}
              />
            </div>
            <p className="mt-1 text-center text-[10px] font-bold text-mute">
              {water} / {goals.waterMl} ml
            </p>
          </Card>

          {MEALS.map((m) => {
            const list = entries.filter((e) => e.meal === m.id);
            const kcal = list.reduce((n, e) => n + e.kcal, 0);
            return (
              <div key={m.id} className="mt-4">
                <div className="mb-2 flex items-center gap-2">
                  <span className="grid h-8 w-8 place-items-center rounded-xl bg-[var(--surface-2)] text-[var(--accent)]">
                    {m.icon}
                  </span>
                  <div className="flex-1">
                    <p className="text-sm font-black">{t(m.label)}</p>
                    <p className="text-[10px] font-bold text-mute">
                      {kcal
                        ? `${Math.round(kcal)} kcal`
                        : t('Nothing logged')}
                    </p>
                  </div>
                  <Btn
                    size="sm"
                    variant="soft"
                    onClick={() => openAdd(m.id)}
                    icon={<Plus size={13} />}
                  >
                    {t('Add')}
                  </Btn>
                </div>
                {list.length > 0 && (
                  <Card className="divide-y divide-[var(--line)] overflow-hidden">
                    {list.map((e) => (
                      <div
                        key={e.id}
                        className="flex items-center gap-2 px-3 py-2.5"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-extrabold">
                            {e.name}
                          </p>
                          <p className="text-[10px] font-bold text-mute">
                            {Math.round(e.grams)} g · P{' '}
                            {roundMacro(e.protein, 1)} · C{' '}
                            {roundMacro(e.carbs, 1)} · F {roundMacro(e.fat, 1)}
                          </p>
                        </div>
                        <span className="num text-xs font-black">
                          {Math.round(e.kcal)}
                        </span>
                        <button
                          onClick={() => deleteMealEntry(e.id)}
                          className="grid h-7 w-7 place-items-center rounded-full text-mute hover:text-[var(--bad)]"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </Card>
                )}
              </div>
            );
          })}
        </div>

        <div>
          <SectionHeader
            title={t('Macro goals')}
            subtitle={t('Daily targets')}
            action={
              <button
                onClick={() => setGoalsOpen(true)}
                className="text-[11px] font-black text-[var(--accent)]"
              >
                {t('Edit')}
              </button>
            }
          />
          <Card className="p-4">
            <div className="grid grid-cols-2 gap-2">
              {[
                {
                  label: 'Calories',
                  value: goals.kcal,
                  unit: 'kcal',
                  tone: 'var(--accent)',
                },
                {
                  label: 'Protein',
                  value: goals.protein,
                  unit: 'g',
                  tone: 'var(--good)',
                },
                {
                  label: 'Carbs',
                  value: goals.carbs,
                  unit: 'g',
                  tone: 'var(--warn)',
                },
                {
                  label: 'Fat',
                  value: goals.fat,
                  unit: 'g',
                  tone: 'var(--bad)',
                },
              ].map((g) => (
                <div
                  key={g.label}
                  className="rounded-xl bg-[var(--surface-2)] p-3"
                >
                  <span
                    className="block h-1 w-6 rounded-full"
                    style={{ background: g.tone }}
                  />
                  <p className="label mt-2">{t(g.label)}</p>
                  <p className="num text-lg font-black">
                    {g.value}
                    <span className="ml-0.5 text-[10px] text-mute">
                      {g.unit}
                    </span>
                  </p>
                </div>
              ))}
            </div>
            {!data.nutrition.goalsSet && (
              <p className="mt-2 text-[10px] font-bold text-[var(--warn)]">
                {t(
                  'These are starter targets. Set your own to make them meaningful.',
                )}
              </p>
            )}
          </Card>

          <SectionHeader
            title={t('Today’s plate')}
            subtitle={t('Macro split')}
          />
          <Card className="p-4">
            <MacroDonut
              protein={totals.protein}
              carbs={totals.carbs}
              fat={totals.fat}
            />
            <div className="mt-3 space-y-1.5 text-[11px] font-bold">
              {[
                {
                  label: 'Protein',
                  v: totals.protein * 4,
                  color: 'var(--accent)',
                },
                { label: 'Carbs', v: totals.carbs * 4, color: 'var(--good)' },
                { label: 'Fat', v: totals.fat * 9, color: 'var(--warn)' },
              ].map((x) => {
                const all =
                  totals.protein * 4 + totals.carbs * 4 + totals.fat * 9 || 1;
                return (
                  <div key={x.label} className="flex items-center gap-2">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ background: x.color }}
                    />
                    <span className="flex-1 text-dim">{t(x.label)}</span>
                    <span className="text-mute">
                      {Math.round((x.v / all) * 100)}%
                    </span>
                  </div>
                );
              })}
            </div>
          </Card>

          <SectionHeader title={t('Quick add')} />
          <div className="grid grid-cols-2 gap-2">
            {MEALS.map((m) => (
              <button
                key={m.id}
                onClick={() => openAdd(m.id)}
                className="card flex items-center gap-2 p-3 text-left transition hover:border-strong"
              >
                <span className="text-[var(--accent)]">{m.icon}</span>
                <span className="text-xs font-extrabold">{t(m.label)}</span>
                <Plus size={13} className="ml-auto text-mute" />
              </button>
            ))}
          </div>

          <SectionHeader title={t('Food library')} />
          <Card className="divide-y divide-[var(--line)] overflow-hidden">
            {FOODS.slice(0, 5).map((f) => (
              <button
                key={f.id}
                aria-label={t('Add {name}', { name: f.name })}
                onClick={() => {
                  setInitialFood(f);
                  setMeal('snacks');
                  setAddOpen(true);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-[var(--surface-2)]"
              >
                <Apple size={13} className="text-[var(--good)]" />
                <span className="min-w-0 flex-1 truncate text-[11px] font-bold">
                  {f.name}
                </span>
                <span className="text-[10px] font-black text-mute">
                  {Math.round(f.kcal)}/100g
                </span>
              </button>
            ))}
            <button
              onClick={() => openAdd('snacks')}
              className="w-full px-3 py-2 text-center text-[11px] font-black text-[var(--accent)]"
            >
              {t('Browse all {n} foods', { n: FOODS.length })}
            </button>
          </Card>

          <div className="mt-4 rounded-2xl border border-line bg-[var(--surface)] p-4 text-[11px] font-semibold leading-relaxed text-mute">
            <Salad size={14} className="mb-1 text-[var(--good)]" />
            {t(
              'Nutrition data is approximate and sourced from common food databases. It is a guide, not medical advice.',
            )}
          </div>
        </div>
      </div>

      <AddFoodSheet
        open={addOpen}
        initialFood={initialFood}
        onClose={() => setAddOpen(false)}
        meal={meal}
        day={day}
        onAdd={(entry) => {
          addMealEntry(entry);
          setAddOpen(false);
          toast.push(t('{name} added', { name: entry.name }), 'good');
        }}
      />
      <GoalsSheet open={goalsOpen} onClose={() => setGoalsOpen(false)} />
    </div>
  );
}

function MacroBar({
  label,
  value,
  goal,
  tone,
}: {
  label: string;
  value: number;
  goal: number;
  tone: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-[10px] font-black">
        <span className="text-dim">{label}</span>
        <span className="text-mute">
          {Math.round(value)} / {goal}g
        </span>
      </div>
      <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-[var(--surface-3)]">
        <div
          className="h-full rounded-full"
          style={{
            width: `${Math.min(100, (value / Math.max(1, goal)) * 100)}%`,
            background: tone,
          }}
        />
      </div>
    </div>
  );
}

function MacroDonut({
  protein,
  carbs,
  fat,
}: {
  protein: number;
  carbs: number;
  fat: number;
}) {
  const p = protein * 4;
  const c = carbs * 4;
  const f = fat * 9;
  const total = p + c + f;
  const r = 34;
  const circ = 2 * Math.PI * r;
  const segs = [
    { v: p, color: 'var(--accent)' },
    { v: c, color: 'var(--good)' },
    { v: f, color: 'var(--warn)' },
  ];
  let offset = 0;
  return (
    <div className="relative mx-auto grid h-[92px] w-[92px] place-items-center">
      <svg viewBox="0 0 92 92" className="h-[92px] w-[92px] -rotate-90">
        <circle
          cx="46"
          cy="46"
          r={r}
          fill="none"
          stroke="var(--surface-3)"
          strokeWidth="12"
        />
        {total > 0 &&
          segs.map((s, i) => {
            const len = (s.v / total) * circ;
            const el = (
              <circle
                key={i}
                cx="46"
                cy="46"
                r={r}
                fill="none"
                stroke={s.color}
                strokeWidth="12"
                strokeDasharray={`${len} ${circ - len}`}
                strokeDashoffset={-offset}
              />
            );
            offset += len;
            return el;
          })}
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <p className="text-sm font-black">
            {total > 0 ? Math.round(total) : 0}
          </p>
          <p className="text-[8px] font-black uppercase text-mute">kcal</p>
        </div>
      </div>
    </div>
  );
}

function AddFoodSheet({
  open,
  onClose,
  meal,
  day,
  onAdd,
  initialFood,
}: {
  open: boolean;
  onClose: () => void;
  meal: Meal;
  day: string;
  initialFood: Food | null;
  onAdd: (entry: Omit<MealEntry, 'id' | 'createdAt'>) => void;
}) {
  const { t, language } = useI18n(TH);
  const mealLabel = MEALS.find((m) => m.id === meal)?.label ?? meal;
  const data = useStore((s) => s.data);
  const addCustomFood = useStore((s) => s.addCustomFood);
  const deleteCustomFood = (id: string) =>
    useStore.getState().update((d) => {
      d.nutrition.customFoods = d.nutrition.customFoods.filter(
        (f) => f.id !== id,
      );
    });
  const toast = useToast();
  const [tab, setTab] = useState<'foods' | 'dishes' | 'custom'>('foods');
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<string | null>(null);
  const [selected, setSelected] = useState<
    | { kind: 'food'; food: Food }
    | { kind: 'dish'; dish: Dish }
    | { kind: 'custom'; food: CustomFood }
    | null
  >(null);
  const [grams, setGrams] = useState('100');
  const [creating, setCreating] = useState(false);
  const [cf, setCf] = useState({
    name: '',
    kcal: '',
    protein: '',
    carbs: '',
    fat: '',
  });
  const [error, setError] = useState('');
  useEffect(() => {
    if (!open) return;
    setError('');
    setQ('');
    setCat(null);
    setCreating(false);
    setSelected(initialFood ? { kind: 'food', food: initialFood } : null);
    if (initialFood) {
      setTab('foods');
      setGrams(String(foodPortion(initialFood)));
    }
  }, [open, initialFood]);

  const foods = useMemo(() => {
    let list = searchFoods(q);
    if (cat) list = list.filter((f) => f.cat === cat);
    return list.slice(0, 60);
  }, [q, cat]);
  const dishes = useMemo(
    () =>
      DISHES.filter(
        (d) => !q || d.name.toLowerCase().includes(q.toLowerCase()),
      ),
    [q],
  );

  const selectFood = (food: Food) => {
    setSelected({ kind: 'food', food });
    setGrams(String(foodPortion(food)));
  };
  const selectDish = (dish: Dish) => {
    setSelected({ kind: 'dish', dish });
    setGrams(String(dishWeight(dish)));
  };
  const selectCustom = (food: CustomFood) => {
    setSelected({ kind: 'custom', food });
    setGrams('100');
  };

  const preview: Macro | null = selected
    ? selected.kind === 'food'
      ? foodMacros(selected.food, Number(grams) || 0)
      : selected.kind === 'custom'
        ? {
            kcal: (selected.food.kcal * (Number(grams) || 0)) / 100,
            protein: (selected.food.protein * (Number(grams) || 0)) / 100,
            carbs: (selected.food.carbs * (Number(grams) || 0)) / 100,
            fat: (selected.food.fat * (Number(grams) || 0)) / 100,
          }
        : (() => {
            const m = dishMacros(selected.dish);
            const scale =
              (Number(grams) || 0) / Math.max(1, dishWeight(selected.dish));
            return {
              kcal: m.kcal * scale,
              protein: m.protein * scale,
              carbs: m.carbs * scale,
              fat: m.fat * scale,
              fiber: (m.fiber ?? 0) * scale,
              sugar: (m.sugar ?? 0) * scale,
              sodium: (m.sodium ?? 0) * scale,
            };
          })()
    : null;

  const confirm = () => {
    if (!selected || !preview || !grams) return;
    const g = Number(grams);
    if (!Number.isFinite(g) || g <= 0) {
      setError(t('Enter a portion greater than zero grams.'));
      return;
    }
    if (
      ![preview.kcal, preview.protein, preview.carbs, preview.fat].every(
        (value) => Number.isFinite(value) && value >= 0,
      )
    ) {
      setError(t('Nutrition amounts must be finite and cannot be negative.'));
      return;
    }
    setError('');
    const name =
      selected.kind === 'food'
        ? selected.food.name
        : selected.kind === 'dish'
          ? selected.dish.name
          : selected.food.name;
    const foodId =
      selected.kind === 'food'
        ? selected.food.id
        : selected.kind === 'custom'
          ? selected.food.id
          : undefined;
    onAdd({
      date: day,
      meal,
      name,
      foodId,
      grams: g,
      kcal: preview.kcal,
      protein: preview.protein,
      carbs: preview.carbs,
      fat: preview.fat,
      fiber: preview.fiber,
      sugar: preview.sugar,
      sodium: preview.sodium,
    });
    setSelected(null);
    setQ('');
    setCat(null);
  };

  const createCustom = () => {
    if (!cf.name.trim()) {
      setError(t('Name your food.'));
      return;
    }
    if (
      ![cf.kcal, cf.protein, cf.carbs, cf.fat].every(
        (value) => Number.isFinite(Number(value)) && Number(value) >= 0,
      )
    ) {
      setError(t('Enter nonnegative, finite nutrition amounts per 100 g.'));
      return;
    }
    setError('');
    const created = addCustomFood({
      name: cf.name.trim(),
      kcal: Number(cf.kcal) || 0,
      protein: Number(cf.protein) || 0,
      carbs: Number(cf.carbs) || 0,
      fat: Number(cf.fat) || 0,
      serving: 100,
    });
    setCf({ name: '', kcal: '', protein: '', carbs: '', fat: '' });
    setCreating(false);
    setTab('custom');
    selectCustom(created);
    toast.push(t('Custom food saved'), 'good');
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('Add to {meal}', {
        meal: language === 'th' ? t(mealLabel) : meal,
      })}
      size="lg"
      footer={
        selected && preview ? (
          <div className="flex flex-wrap items-center gap-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-black">
                {selected.kind === 'food'
                  ? selected.food.name
                  : selected.kind === 'dish'
                    ? selected.dish.name
                    : selected.food.name}
              </p>
              <p className="text-[10px] font-bold text-mute">
                {Math.round(preview.kcal)} kcal · P
                {roundMacro(preview.protein, 1)} C{roundMacro(preview.carbs, 1)}{' '}
                F{roundMacro(preview.fat, 1)}
              </p>
            </div>
            <div className="relative w-24">
              <NumericInput
                className="input py-2 pr-8 text-right text-xs"
                unit="g"
                aria-label={t('Portion in grams')}
                min="0.1"
                step="any"
                inputMode="decimal"
                value={grams}
                onValueChange={setGrams}
              />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-black text-mute">
                g
              </span>
            </div>
            <Btn variant="primary" onClick={confirm} icon={<Plus size={15} />}>
              {t('Add')}
            </Btn>
          </div>
        ) : (
          <p className="text-center text-[11px] font-semibold text-mute">
            {t('Pick a food, dish or custom entry to continue.')}
          </p>
        )
      }
    >
      {error && (
        <p role="alert" className="mb-3 text-sm font-bold text-[var(--bad)]">
          {error}
        </p>
      )}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Segmented
          value={tab}
          onChange={(v) => {
            setTab(v);
            setSelected(null);
          }}
          options={[
            { value: 'foods', label: t('Foods') },
            { value: 'dishes', label: t('Dishes') },
            { value: 'custom', label: t('Custom') },
          ]}
          className="flex-1"
        />
        <Btn
          size="sm"
          variant="soft"
          onClick={() => setCreating(!creating)}
          icon={<Plus size={13} />}
        >
          {t('New food')}
        </Btn>
      </div>

      {creating && (
        <Card className="mb-3 space-y-2 p-3">
          <input
            className="input py-2 text-sm"
            placeholder={t('Food name')}
            value={cf.name}
            onChange={(e) => setCf({ ...cf, name: e.target.value })}
          />
          <div className="grid grid-cols-4 gap-1.5">
            {(['kcal', 'protein', 'carbs', 'fat'] as const).map((k) => (
              <label key={k} className="relative">
                <NumericInput
                  className="input py-2 pr-7 text-right text-xs"
                  unit={k === 'kcal' ? 'cal' : 'g'}
                  aria-label={t('{macro} per 100 grams', { macro: t(k) })}
                  min="0"
                  step="any"
                  placeholder={t(k)}
                  value={cf[k]}
                  onValueChange={(raw) => setCf({ ...cf, [k]: raw })}
                />
                <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[8px] font-black uppercase text-mute">
                  {k === 'kcal' ? 'cal' : 'g'}
                </span>
              </label>
            ))}
          </div>
          <p className="text-[9px] font-bold text-mute">
            {t('Values per 100 g.')}
          </p>
          <Btn
            size="sm"
            variant="primary"
            className="w-full"
            onClick={createCustom}
          >
            {t('Save custom food')}
          </Btn>
        </Card>
      )}

      {tab !== 'dishes' && (
        <div className="relative mb-2">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-mute"
          />
          <input
            className="input pl-9"
            placeholder={t('Search foods…')}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          {q && (
            <button
              onClick={() => setQ('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-mute"
            >
              <X size={14} />
            </button>
          )}
        </div>
      )}

      {tab === 'foods' && (
        <>
          <div className="scroll-x mb-2 pb-1">
            <Chip on={cat == null} onClick={() => setCat(null)}>
              {t('All')}
            </Chip>
            {FOOD_CATEGORIES.map((c) => (
              <Chip
                key={c}
                on={cat === c}
                onClick={() => setCat(cat === c ? null : c)}
              >
                {t(CATEGORY_LABEL[c] ?? c)}
              </Chip>
            ))}
          </div>
          <div className="space-y-0.5">
            {foods.map((f) => (
              <button
                key={f.id}
                onClick={() => selectFood(f)}
                className={`flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left transition hover:bg-[var(--surface-2)] ${selected?.kind === 'food' && selected.food.id === f.id ? 'bg-[var(--accent-soft)]' : ''}`}
              >
                <div className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--surface-2)] text-[var(--good)]">
                  <Apple size={14} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-extrabold">{f.name}</p>
                  <p className="text-[10px] font-bold text-mute">
                    {f.cat ? t(CATEGORY_LABEL[f.cat] ?? f.cat) : t('food')} · P
                    {roundMacro(f.protein, 1)} C{roundMacro(f.carbs, 1)} F
                    {roundMacro(f.fat, 1)}
                  </p>
                </div>
                <span className="num text-[10px] font-black text-mute">
                  {Math.round(f.kcal)} kcal
                </span>
              </button>
            ))}
            {!foods.length && (
              <p className="py-8 text-center text-xs font-semibold text-mute">
                {t('No foods match.')}
              </p>
            )}
          </div>
        </>
      )}

      {tab === 'dishes' && (
        <div className="space-y-0.5">
          {dishes.map((d) => (
            <button
              key={d.id}
              onClick={() => selectDish(d)}
              className={`flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left transition hover:bg-[var(--surface-2)] ${selected?.kind === 'dish' && selected.dish.id === d.id ? 'bg-[var(--accent-soft)]' : ''}`}
            >
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--surface-2)] text-[var(--accent)]">
                <Utensils size={14} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-extrabold">{d.name}</p>
                <p className="text-[10px] font-bold text-mute">
                  {t('{n} ingredients · {g} g', {
                    n: d.items.length,
                    g: dishWeight(d),
                  })}
                </p>
              </div>
              <span className="num text-[10px] font-black text-mute">
                {Math.round(dishMacros(d).kcal)} kcal
              </span>
            </button>
          ))}
          {!dishes.length && (
            <p className="py-8 text-center text-xs font-semibold text-mute">
              {t('No dishes match.')}
            </p>
          )}
        </div>
      )}

      {tab === 'custom' && (
        <div>
          {data.nutrition.customFoods.length ? (
            data.nutrition.customFoods.map((f) => (
              <div
                key={f.id}
                className="flex items-center gap-2 rounded-xl px-2.5 py-2 hover:bg-[var(--surface-2)]"
              >
                <button
                  onClick={() => selectCustom(f)}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                >
                  <div className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--surface-2)] text-[var(--accent)]">
                    <Beef size={14} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-extrabold">{f.name}</p>
                    <p className="text-[10px] font-bold text-mute">
                      {t('P{p} C{c} F{f} per 100g', {
                        p: roundMacro(f.protein, 1),
                        c: roundMacro(f.carbs, 1),
                        f: roundMacro(f.fat, 1),
                      })}
                    </p>
                  </div>
                  <span className="num text-[10px] font-black text-mute">
                    {Math.round(f.kcal)} kcal
                  </span>
                </button>
                <button
                  onClick={() => deleteCustomFood(f.id)}
                  className="grid h-7 w-7 place-items-center rounded-full text-mute hover:text-[var(--bad)]"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))
          ) : (
            <EmptyState
              icon={<Beef size={22} />}
              title={t('No custom foods')}
              body={t('Create one with the New food button above.')}
            />
          )}
        </div>
      )}

      {selected && (
        <div className="sticky bottom-0 mt-2 rounded-xl border border-[var(--accent-line)] bg-[var(--accent-soft)] px-3 py-2 text-[10px] font-bold text-[var(--accent)]">
          {t('Selected: {name}', {
            name:
              selected.kind === 'food'
                ? selected.food.name
                : selected.kind === 'dish'
                  ? selected.dish.name
                  : selected.food.name,
          })}
        </div>
      )}
    </Sheet>
  );
}

function GoalsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n(TH);
  const goals = useStore((s) => s.data.nutrition.goals);
  const setNutritionGoals = useStore((s) => s.setNutritionGoals);
  const toast = useToast();
  const [g, setG] = useState(goals);
  const [error, setError] = useState('');
  useEffect(() => {
    if (open) {
      setG(goals);
      setError('');
    }
  }, [open, goals]);

  const fields: { key: keyof typeof goals; label: string; unit: string }[] = [
    { key: 'kcal', label: 'Calories', unit: 'kcal' },
    { key: 'protein', label: 'Protein', unit: 'g' },
    { key: 'carbs', label: 'Carbs', unit: 'g' },
    { key: 'fat', label: 'Fat', unit: 'g' },
    { key: 'fiber', label: 'Fiber', unit: 'g' },
    { key: 'waterMl', label: 'Water', unit: 'ml' },
    { key: 'glassMl', label: 'Glass size', unit: 'ml' },
  ];

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('Daily goals')}
      footer={
        <Btn
          variant="primary"
          className="w-full"
          onClick={() => {
            if (
              !Object.values(g).every(
                (value) => Number.isFinite(value) && value >= 0,
              ) ||
              g.glassMl <= 0
            ) {
              setError(
                t(
                  'Use finite, nonnegative goals and a glass size greater than zero.',
                ),
              );
              return;
            }
            setNutritionGoals(g);
            onClose();
            toast.push(t('Goals saved'), 'good');
          }}
        >
          {t('Save goals')}
        </Btn>
      }
    >
      {error && (
        <p role="alert" className="mb-3 text-sm font-bold text-[var(--bad)]">
          {error}
        </p>
      )}
      <div className="grid grid-cols-2 gap-3">
        {fields.map((f) => (
          <Field key={f.key} label={t(f.label)}>
            <div className="relative">
              <NumericInput
                className="input num pr-10 text-right"
                unit={f.unit}
                value={g[f.key]}
                onValueChange={(raw) =>
                  setG({ ...g, [f.key]: Math.max(0, Number(raw)) })
                }
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-black text-mute">
                {f.unit}
              </span>
            </div>
          </Field>
        ))}
      </div>
      <p className="mt-3 text-[11px] font-semibold text-mute">
        {t(
          'Targets are personal. Adjust them with a coach or dietitian if you have specific health goals.',
        )}
      </p>
    </Sheet>
  );
}
