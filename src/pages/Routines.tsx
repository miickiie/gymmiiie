import {
  ArrowRight,
  CalendarDays,
  Clock,
  Copy,
  Dumbbell,
  Moon,
  Pencil,
  Play,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ExerciseIcon } from '../components/ExerciseTile';
import {
  Btn,
  Card,
  Confirm,
  EmptyState,
  PageHeader,
  SectionHeader,
  useToast,
} from '../components/ui';
import { useWorkoutStart } from '../components/WorkoutStart';
import { routineForWeek } from '../lib/stats';
import { PROGRAM_TEMPLATES, allExercises, useStore } from '../lib/store';
import { useI18n } from '../lib/i18n';
import type { Routine } from '../types';

const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const TH: Record<string, string> = {
  Routines: 'ตารางฝึก',
  'Your weekly plan': 'แผนรายสัปดาห์ของคุณ',
  '{n} routines · tap a day to plan it · start any routine in one tap':
    '{n} ตาราง · แตะวันเพื่อวางแผน · เริ่มตารางได้ในแตะเดียว',
  'New routine': 'ตารางใหม่',
  'This week': 'สัปดาห์นี้',
  'Assign routines to weekdays. Rest days are part of the plan.':
    'กำหนดตารางให้แต่ละวัน พักก็เป็นส่วนหนึ่งของแผน',
  'Rest / unplanned': 'พัก / ยังไม่วางแผน',
  'Today: {name}': 'วันนี้: {name}',
  'Start now': 'เริ่มเลย',
  Templates: 'เทมเพลต',
  'Add a proven split instantly': 'เพิ่มสปลิตที่พิสูจน์แล้วได้ทันที',
  Add: 'เพิ่ม',
  'Templates replace the weekday plan for their training days. You can edit every exercise afterwards.':
    'เทมเพลตจะแทนแผนของวันที่ต้องฝึก และแก้ไขท่าได้ทีหลัง',
  'All routines': 'ตารางทั้งหมด',
  '{n} saved': 'บันทึกไว้ {n}',
  '{n} exercises · {n2} sets': '{n} ท่า · {n2} เซ็ต',
  'No exercises yet.': 'ยังไม่มีท่า',
  '+{n} more': '+{n} เพิ่ม',
  unscheduled: 'ยังไม่ตั้งวัน',
  Start: 'เริ่ม',
  Edit: 'แก้ไข',
  'No routines yet': 'ยังไม่มีตาราง',
  'Create a blank routine and add your exercises, or drop in a template like Push/Pull/Legs.':
    'สร้างตารางเปล่าแล้วเพิ่มท่า หรือเลือกเทมเพลตอย่าง Push/Pull/Legs',
  'Create routine': 'สร้างตาราง',
  'Add PPL': 'เพิ่ม PPL',
  'Set default rest per exercise inside the routine editor. Automatic rest still follows Settings.':
    'ตั้งเวลาพักเริ่มต้นของแต่ละท่าในหน้าแก้ไขตาราง ส่วนพักอัตโนมัติยังใช้ค่าจากการตั้งค่า',
  'Rest settings': 'ตั้งค่าการพัก',
  'Delete routine?': 'ลบตาราง?',
  '“{name}” will be removed and any scheduled days cleared. Workout history is untouched.':
    'จะลบ “{name}” และล้างวันที่ตั้งไว้ ประวัติการฝึกยังอยู่',
  'Delete routine': 'ลบตาราง',
  'Routine deleted': 'ลบตารางแล้ว',
  '{name} added · {n} routines': 'เพิ่ม {name} แล้ว · {n} ตาราง',
  'Could not match template exercises': 'จับคู่ท่าในเทมเพลตไม่ได้',
  'Full Body': 'ทั้งตัว',
  'Push Pull Legs': 'ดัน ดึง ขา',
  'Upper Lower': 'บน ล่าง',
  'Arnold Split': 'ตาราง Arnold',
  '3 days · squat, press, pull': '3 วัน · สควอต เพรส ดึง',
  '3 days · classic split': '3 วัน · สปลิตคลาสสิก',
  '4 days · balanced': '4 วัน · สมดุล',
  '6 days · chest & back / shoulders & arms / legs':
    '6 วัน · อกและหลัง / ไหล่และแขน / ขา',
  Sun: 'อา.',
  Mon: 'จ.',
  Tue: 'อ.',
  Wed: 'พ.',
  Thu: 'พฤ.',
  Fri: 'ศ.',
  Sat: 'ส.',
};

export default function Routines() {
  const { t } = useI18n(TH);
  const navigate = useNavigate();
  const toast = useToast();
  const { requestStart, dialogs } = useWorkoutStart();
  const data = useStore((s) => s.data);
  const createRoutine = useStore((s) => s.createRoutine);
  const deleteRoutine = useStore((s) => s.deleteRoutine);
  const startFromRoutine = useStore((s) => s.startFromRoutine);
  const setWeekPlan = useStore((s) => s.setWeekPlan);
  const addTemplate = useStore((s) => s.addTemplate);
  const [confirm, setConfirm] = useState<Routine | null>(null);

  const all = useMemo(() => allExercises(), [data.customExercises]);
  const todayRoutine = routineForWeek(data);
  const order = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => (i + data.settings.weekStart) % 7),
    [data.settings.weekStart],
  );

  const start = (id: string) => {
    requestStart(() => startFromRoutine(id));
  };

  const create = () => {
    const id = createRoutine({
      name: t('New routine'),
      exerciseIds: [],
      sets: {},
      rest: {},
    });
    navigate(`/routines/${id}`);
  };

  const applyTemplate = (id: string, name: string) => {
    const created = addTemplate(id);
    if (created.length) {
      toast.push(
        t('{name} added · {n} routines', { name: t(name), n: created.length }),
        'good',
      );
      navigate('/routines');
    } else {
      toast.push(t('Could not match template exercises'), 'bad');
    }
  };

  return (
    <div className="page-enter">
      <PageHeader
        eyebrow={t('Routines')}
        title={t('Your weekly plan')}
        subtitle={t(
          '{n} routines · tap a day to plan it · start any routine in one tap',
          { n: data.routines.length },
        )}
        action={
          <Btn
            variant="primary"
            size="sm"
            onClick={create}
            icon={<Plus size={15} />}
          >
            {t('New routine')}
          </Btn>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1.25fr_1fr]">
        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-black">{t('This week')}</p>
              <p className="text-[11px] font-semibold text-mute">
                {t('Assign routines to weekdays. Rest days are part of the plan.')}
              </p>
            </div>
            <CalendarDays size={18} className="text-mute" />
          </div>
          <div className="space-y-1.5">
            {order.map((day) => {
              const planned = data.weekPlan[String(day)];
              const routine = data.routines.find((r) => r.id === planned);
              const isToday = new Date().getDay() === day;
              return (
                <div
                  key={day}
                  className={`flex items-center gap-2 rounded-xl border px-2.5 py-2 ${isToday ? 'border-[var(--accent-line)] bg-[var(--accent-soft)]' : 'border-line bg-[var(--surface-2)]'}`}
                >
                  <span
                    className={`w-9 shrink-0 text-[10px] font-black uppercase ${isToday ? 'text-[var(--accent)]' : 'text-mute'}`}
                  >
                    {t(DAY_SHORT[day])}
                  </span>
                  <select
                    className="input !border-0 !bg-transparent !py-1 !text-xs font-extrabold"
                    value={planned ?? ''}
                    onChange={(e) => setWeekPlan(day, e.target.value || null)}
                  >
                    <option value="">{t('Rest / unplanned')}</option>
                    {data.routines.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                  {routine ? (
                    <button
                      onClick={() => start(routine.id)}
                      className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--accent)] text-[#1a0d07]"
                    >
                      <Play size={12} />
                    </button>
                  ) : (
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--surface-3)] text-mute">
                      <Moon size={12} />
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          {todayRoutine && (
            <div className="mt-3 flex items-center gap-2 rounded-xl bg-[var(--good-soft)] px-3 py-2 text-[11px] font-black text-[var(--good)]">
              <Sparkles size={13} />{' '}
              {t('Today: {name}', { name: todayRoutine.name })}
              <button
                onClick={() => start(todayRoutine.id)}
                className="ml-auto underline underline-offset-2"
              >
                {t('Start now')}
              </button>
            </div>
          )}
        </Card>

        <div>
          <SectionHeader
            title={t('Templates')}
            subtitle={t('Add a proven split instantly')}
          />
          <div className="space-y-2">
            {PROGRAM_TEMPLATES.map((tpl) => (
              <Card key={tpl.id} className="flex items-center gap-3 p-3.5">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--surface-2)] text-[var(--accent)]">
                  <Dumbbell size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-black">{t(tpl.name)}</p>
                  <p className="text-[11px] font-semibold text-mute">
                    {t(tpl.detail)}
                  </p>
                </div>
                <Btn
                  size="sm"
                  variant="soft"
                  onClick={() => applyTemplate(tpl.id, tpl.name)}
                  icon={<Copy size={13} />}
                >
                  {t('Add')}
                </Btn>
              </Card>
            ))}
          </div>
          <p className="mt-2 text-[10px] font-semibold leading-relaxed text-mute">
            {t(
              'Templates replace the weekday plan for their training days. You can edit every exercise afterwards.',
            )}
          </p>
        </div>
      </div>

      <SectionHeader
        title={t('All routines')}
        subtitle={t('{n} saved', { n: data.routines.length })}
      />
      {data.routines.length ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {data.routines.map((r) => {
            const plannedDays = Object.entries(data.weekPlan)
              .filter(([, id]) => id === r.id)
              .map(([d]) => DAY_SHORT[Number(d)]);
            const totalSets = r.exerciseIds.reduce(
              (n, id) => n + (r.sets[id] ?? 3),
              0,
            );
            const preview = r.exerciseIds
              .slice(0, 3)
              .map((id) => all.find((e) => e.id === id))
              .filter(Boolean);
            return (
              <Card key={r.id} className="flex flex-col p-4">
                <div className="flex items-start gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
                    <CalendarDays size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link
                      to={`/routines/${r.id}`}
                      className="block truncate text-sm font-black hover:text-[var(--accent)]"
                    >
                      {r.name}
                    </Link>
                    <p className="text-[11px] font-bold text-mute">
                      {t('{n} exercises · {n2} sets', {
                        n: r.exerciseIds.length,
                        n2: totalSets,
                      })}
                      {r.group ? ` · ${r.group}` : ''}
                    </p>
                  </div>
                  <button
                    onClick={() => setConfirm(r)}
                    className="grid h-7 w-7 place-items-center rounded-full text-mute hover:bg-[var(--surface-3)] hover:text-[var(--bad)]"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                <div className="mt-3 flex-1 space-y-1">
                  {preview.length ? (
                    preview.map(
                      (ex) =>
                        ex && (
                          <div key={ex.id} className="flex items-center gap-2">
                            <ExerciseIcon ex={ex} size={24} />
                            <span className="truncate text-[11px] font-bold text-dim">
                              {ex.name}
                            </span>
                            <span className="ml-auto text-[10px] font-black text-mute">
                              {r.sets[ex.id] ?? 3}×
                            </span>
                          </div>
                        ),
                    )
                  ) : (
                    <p className="text-[11px] font-semibold text-mute">
                      {t('No exercises yet.')}
                    </p>
                  )}
                  {r.exerciseIds.length > 3 && (
                    <p className="text-[10px] font-bold text-mute">
                      {t('+{n} more', { n: r.exerciseIds.length - 3 })}
                    </p>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap gap-1">
                  {plannedDays.length ? (
                    plannedDays.map((d) => (
                      <span
                        key={d}
                        className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[9px] font-black uppercase text-mute"
                      >
                        {t(d)}
                      </span>
                    ))
                  ) : (
                    <span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[9px] font-black uppercase text-mute">
                      {t('unscheduled')}
                    </span>
                  )}
                </div>

                <div className="mt-3 flex gap-1.5">
                  <Btn
                    size="sm"
                    variant="primary"
                    className="flex-1"
                    onClick={() => start(r.id)}
                    icon={<Play size={13} />}
                    disabled={!r.exerciseIds.length}
                  >
                    {t('Start')}
                  </Btn>
                  <Link
                    to={`/routines/${r.id}`}
                    className="btn btn-soft px-3 py-1.5 text-xs"
                  >
                    <Pencil size={13} /> {t('Edit')}
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={<CalendarDays size={24} />}
          title={t('No routines yet')}
          body={t(
            'Create a blank routine and add your exercises, or drop in a template like Push/Pull/Legs.',
          )}
          action={
            <div className="flex gap-2">
              <Btn variant="primary" onClick={create} icon={<Plus size={15} />}>
                {t('Create routine')}
              </Btn>
              <Btn onClick={() => applyTemplate('ppl', 'Push Pull Legs')}>
                {t('Add PPL')}
              </Btn>
            </div>
          }
        />
      )}

      <div className="mt-6 flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-[var(--surface)] px-4 py-3">
        <Clock size={14} className="text-mute" />
        <p className="text-[11px] font-semibold text-mute">
          {t(
            'Set default rest per exercise inside the routine editor. Automatic rest still follows Settings.',
          )}
        </p>
        <Link
          to="/settings"
          className="ml-auto flex items-center gap-1 text-[11px] font-black text-[var(--accent)]"
        >
          {t('Rest settings')} <ArrowRight size={12} />
        </Link>
      </div>

      {dialogs}
      <Confirm
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          if (confirm) {
            deleteRoutine(confirm.id);
            toast.push(t('Routine deleted'));
          }
        }}
        title={t('Delete routine?')}
        body={t(
          '“{name}” will be removed and any scheduled days cleared. Workout history is untouched.',
          { name: confirm?.name ?? '' },
        )}
        confirmLabel={t('Delete routine')}
      />
    </div>
  );
}
