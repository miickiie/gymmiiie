import { useMemo } from 'react';
import {
  Activity,
  BookOpen,
  CalendarDays,
  Check,
  ChevronRight,
  Dumbbell,
  Flame,
  Moon,
  Play,
  Salad,
  Scale,
  Sparkles,
  Timer,
  TrendingUp,
  Trophy,
  Zap,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { ArtThumb } from '../components/ExerciseArt';
import { ExerciseIcon } from '../components/ExerciseTile';
import {
  Btn,
  Card,
  EmptyState,
  PageHeader,
  Ring,
  SectionHeader,
  Sparkline,
  Stat,
} from '../components/ui';
import { useWorkoutStart } from '../components/WorkoutStart';
import {
  dateKey,
  fmtDate,
  fmtDuration,
  fmtTime,
  parseKey,
  sessionTrainingDate,
  weekDates,
  weekdayIndex,
} from '../lib/date';
import {
  activeElapsed,
  currentStreak,
  daysDoneThisWeek,
  levelFor,
  MUSCLE_LABEL,
  personalRecords,
  routineForWeek,
  sessionVolume,
  sortedSessions,
  toDisplayWeight,
  totalSets,
  totalVolume,
  volumeLabel,
  workoutsThisWeek,
} from '../lib/stats';
import { useI18n } from '../lib/i18n';
import { allExercises, useStore } from '../lib/store';

const DAY_KEYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

const TH: Record<string, string> = {
  'Good morning': 'สวัสดีตอนเช้า',
  'Good afternoon': 'สวัสดีตอนบ่าย',
  'Good evening': 'สวัสดีตอนเย็น',
  'You have a workout in progress. Pick up where you left off.':
    'มีการฝึกที่ยังไม่จบ ทำต่อจากที่ค้างไว้ได้เลย',
  'Rest day. Recovery is training too.': 'วันพัก การพักก็คือการฝึก',
  'Tap a muscle or follow today’s plan.': 'แตะกล้ามเนื้อหรือทำตามแผนวันนี้',
  'Freestyle session': 'ฝึกแบบอิสระ',
  '{n} exercises · {time} start': '{n} ท่า · เริ่ม {time}',
  'of {n}': 'จาก {n}',
  '{n} day streak': 'ฝึกต่อเนื่อง {n} วัน',
  'Lv {n}': 'เลเวล {n}',
  'Weekly goal smashed.': 'ถึงเป้าหมายสัปดาห์แล้ว!',
  'Week starts with one rep.': 'เริ่มสัปดาห์ด้วย rep แรก',
  '{n} more to hit your goal.': 'อีก {n} ครั้งถึงเป้าหมาย',
  'Today’s plan: {name} · {n} exercises': 'แผนวันนี้: {name} · {n} ท่า',
  'You marked today as a rest day.': 'คุณตั้งวันนี้เป็นวันพัก',
  '{xp} XP · {n} to level {lvl}': '{xp} XP · อีก {n} ถึงเลเวล {lvl}',
  'Working sets': 'เซ็ตฝึกจริง',
  'all time': 'ทั้งหมด',
  'total lifted': 'น้ำหนักรวมที่ยก',
  '{n} this week': '{n} ครั้งสัปดาห์นี้',
  'of {n} kcal': 'จาก {n} kcal',
  'Today’s plan': 'แผนวันนี้',
  'Rest and recover': 'พักและฟื้นตัว',
  '{n} exercises ready': '{n} ท่าพร้อมแล้ว',
  'No routine planned': 'ยังไม่มีตารางฝึก',
  'Edit plan': 'แก้ไขแผน',
  '{n} exercises · {s} sets': '{n} ท่า · {s} เซ็ต',
  '{m} · {n} sets': '{m} · {n} เซ็ต',
  '+{n} more exercises': 'อีก {n} ท่า',
  'Pick muscles and let Gymmiie suggest the session, or set a weekly plan.':
    'เลือกกล้ามเนื้อเพื่อให้ Gymmiie แนะนำแผนฝึก หรือวางแผนรายสัปดาห์',
  '{date} · {dur} · {n} exercises': '{date} · {dur} · {n} ท่า',
  '{unit} vol': 'ปริมาณการฝึก ({unit})',
  'Start with a muscle group and Gymmiie will build a session with warm-ups.':
    'เลือกกลุ่มกล้ามเนื้อ แล้ว Gymmiie จะจัดแผนฝึกพร้อมเซ็ตวอร์มอัปให้',
  'By muscle': 'ตามกล้ามเนื้อ',
  'Body map picks': 'เลือกจากภาพร่างกาย',
  Browse: 'ดูทั้งหมด',
  '{n} exercises': '{n} ท่า',
  'Plans & splits': 'แผนและตาราง',
  '{n} foods': 'อาหาร {n} รายการ',
  'Top weight': 'น้ำหนักสูงสุด',
  time: 'เวลา',
  distance: 'ระยะทาง',
  reps: 'reps',
  '{n} reps': '{n} reps',
  Latest: 'ล่าสุด',
  'Goal {w} {unit}': 'เป้าหมาย {w} {unit}',
  'Log your weight to see the trend.': 'บันทึกน้ำหนักเพื่อดูแนวโน้ม',
  'Write a note, plan or pain flag': 'เขียนโน้ต แผน หรือจุดที่เจ็บ',
  '{n} journal entries': '{n} รายการบันทึก',
  'Track how training feels': 'ติดตามความรู้สึกระหว่างฝึก',
  '{n} h trained': 'ฝึกแล้ว {n} h',
  'All PRs': 'PR ทั้งหมด',
  'Bodyweight': 'น้ำหนักตัว',
  Calories: 'แคลอรี',
  'Check in': 'เช็กอิน',
  'Checked in': 'เช็กอินแล้ว',
  'Daily journal': 'บันทึกประจำวัน',
  Food: 'อาหาร',
  'Log': 'บันทึก',
  'Mark rest': 'ทำเครื่องหมายวันพัก',
  'No plan set for today. Train by muscle instead.':
    'วันนี้ยังไม่มีแผน ลองเลือกตามกล้ามเนื้อ',
  'No workouts yet': 'ยังไม่มีการฝึก',
  'Nothing planned for today': 'วันนี้ยังไม่มีแผน',
  'Offline logging · account sync when connected':
    'บันทึกแบบออฟไลน์ · ซิงก์บัญชีเมื่อออนไลน์',
  Open: 'เปิด',
  'Pick muscles': 'เลือกกล้ามเนื้อ',
  Progress: 'ความก้าวหน้า',
  'Quick start': 'เริ่มเร็ว',
  'Ready when you are': 'พร้อมเมื่อคุณพร้อม',
  'Recent bests': 'สถิติล่าสุด',
  'Recent workouts': 'การฝึกล่าสุด',
  'Recovery is part of the program. Come back stronger tomorrow.':
    'การพักคือส่วนหนึ่งของแผน พรุ่งนี้กลับมาให้ดีกว่าเดิม',
  'Rest day': 'วันพัก',
  'Resume workout': 'ฝึกต่อ',
  Routines: 'ตารางฝึก',
  'Start routine': 'เริ่มตาราง',
  'Start training': 'เริ่มฝึก',
  'Start workout': 'เริ่มฝึก',
  'This week': 'สัปดาห์นี้',
  'Trained today': 'ฝึกวันนี้แล้ว',
  'View all': 'ดูทั้งหมด',
  Volume: 'ปริมาณการฝึก',
  Workout: 'การฝึก',
  'Workout in progress': 'กำลังฝึกอยู่',
  Workouts: 'การฝึก',
};

export default function Dashboard() {
  const { t, tm, language } = useI18n(TH);
  const navigate = useNavigate();
  const data = useStore((s) => s.data);
  const startFromRoutine = useStore((s) => s.startFromRoutine);
  const { requestStart, dialogs } = useWorkoutStart();
  const toggleCheckin = useStore((s) => s.toggleCheckin);
  const toggleDayOff = useStore((s) => s.toggleDayOff);

  const today = dateKey();
  const now = parseKey(today);
  const weekday = weekdayIndex(now);
  const streak = currentStreak(data);
  const week = workoutsThisWeek(data);
  const goal = data.settings.weeklyGoal;
  const todayRoutine = routineForWeek(data, weekday);
  const active = data.active;
  const sessions = useMemo(
    () => sortedSessions(data.sessions),
    [data.sessions],
  );
  const recent = sessions.slice(0, 4);
  const level = levelFor(data.sessions);
  const prs = useMemo(
    () => personalRecords(data.sessions).slice(0, 3),
    [data.sessions],
  );
  const volume = useMemo(() => totalVolume(data.sessions), [data.sessions]);
  const sets = useMemo(() => totalSets(data.sessions), [data.sessions]);
  const days = weekDates(data.settings.weekStart, now);
  const trainedDays = new Set(data.sessions.map((s) => dateKey(sessionTrainingDate(s))));
  const isOff = !!data.daysOff[today];
  const isCheckin = data.checkins.includes(today);
  const todayEntries = data.nutrition.entries.filter((e) => e.date === today);
  const kcal = todayEntries.reduce((n, e) => n + e.kcal, 0);
  const kcalGoal = data.nutrition.goals.kcal;
  const lastWeights = data.bodyweights.slice(-10).map((b) => b.kg);
  const unit = data.settings.unit;
  const greeting =
    new Date().getHours() < 12
      ? t('Good morning')
      : new Date().getHours() < 18
        ? t('Good afternoon')
        : t('Good evening');

  const startRoutine = () => {
    if (!todayRoutine) {
      navigate('/train');
      return;
    }
    requestStart(() => startFromRoutine(todayRoutine.id));
  };

  return (
    <div className="page-enter">
      <PageHeader
        eyebrow={fmtDate(now, {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        })}
        title={`${greeting}${data.profile.name ? `, ${data.profile.name.split(' ')[0]}` : ''}`}
        subtitle={
          active
            ? t('You have a workout in progress. Pick up where you left off.')
            : isOff
              ? t('Rest day. Recovery is training too.')
              : t('Tap a muscle or follow today’s plan.')
        }
        action={
          <Link to="/settings">
            <div className="grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-[var(--accent)] to-[var(--accent-strong)] text-base font-black text-[#1a0d07] shadow-glow">
              {(data.profile.name || 'G').trim().slice(0, 2).toUpperCase()}
            </div>
          </Link>
        }
      />

      {active && (
        <Card className="mb-4 overflow-hidden border-[var(--accent-line)] bg-gradient-to-r from-[var(--accent-soft)] to-transparent">
          <div className="flex flex-wrap items-center gap-4 p-4">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--accent)] text-[#1a0d07]">
              <Activity size={22} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="label text-[var(--accent)]">
                {t('Workout in progress')}
              </p>
              <p className="mt-0.5 truncate text-sm font-black">
                {active.name || t('Freestyle session')}
              </p>
              <p className="text-xs font-semibold text-dim">
                {t('{n} exercises · {time} start', {
                  n: active.exercises.length,
                  time: fmtTime(new Date(active.startedAt)),
                })}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="num text-xl font-black text-[var(--accent)]">
                {fmtDuration(activeElapsed(active))}
              </span>
            </div>
          </div>
        </Card>
      )}

      <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Card className="relative overflow-hidden p-5">
          <div className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full bg-[var(--accent)] opacity-[0.09] blur-2xl" />
          <div className="flex flex-wrap items-center gap-5">
            <Ring
              value={Math.min(100, (week / Math.max(1, goal)) * 100)}
              size={104}
              stroke={9}
            >
              <div className="text-center">
                <p className="num text-2xl font-black leading-none">{week}</p>
                <p className="text-[10px] font-black uppercase tracking-wider text-mute">
                  {t('of {n}', { n: goal })}
                </p>
              </div>
            </Ring>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1 rounded-full bg-[var(--warn)]/10 px-2 py-1 text-[11px] font-black text-[var(--warn)]">
                  <Flame size={13} />{' '}
                  {t('{n} day streak', { n: streak })}
                </span>
                <span className="rounded-full bg-[var(--surface-2)] px-2 py-1 text-[11px] font-black text-mute">
                  {t('Lv {n}', { n: level.level })}
                </span>
              </div>
              <h2 className="mt-2 text-xl font-black tracking-tight">
                {week >= goal
                  ? t('Weekly goal smashed.')
                  : week === 0
                    ? t('Week starts with one rep.')
                    : t('{n} more to hit your goal.', { n: goal - week })}
              </h2>
              <p className="mt-1 text-xs font-semibold text-dim">
                {todayRoutine
                  ? t('Today’s plan: {name} · {n} exercises', {
                      name: todayRoutine.name,
                      n: todayRoutine.exerciseIds.length,
                    })
                  : isOff
                    ? t('You marked today as a rest day.')
                    : t('No plan set for today. Train by muscle instead.')}
              </p>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--surface-3)]">
                <div
                  className="h-full rounded-full bg-[var(--accent)] transition-all"
                  style={{ width: `${Math.min(100, level.progress)}%` }}
                />
              </div>
              <p className="mt-1 text-[10px] font-bold text-mute">
                {t('{xp} XP · {n} to level {lvl}', {
                  xp: level.xp.toLocaleString(),
                  n: level.next - (level.xp % level.next),
                  lvl: level.level + 1,
                })}
              </p>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {active ? (
              <Btn
                variant="primary"
                size="lg"
                onClick={() => navigate('/session')}
                icon={<Play size={17} />}
              >
                {t('Resume workout')}
              </Btn>
            ) : (
              <Btn
                variant="primary"
                size="lg"
                onClick={() => navigate('/train')}
                icon={<Zap size={17} />}
              >
                {t('Start workout')}
              </Btn>
            )}
          </div>
        </Card>

        <Card className="min-w-0 p-5">
          <SectionHeader
            title={t('This week')}
            action={
              <Link
                to="/progress"
                className="text-[11px] font-black text-[var(--accent)]"
              >
                {t('Progress')}
              </Link>
            }
          />
          <div className="grid grid-cols-7 gap-1.5">
            {days.map((d) => {
              const key = dateKey(d);
              const done = trainedDays.has(key);
              const off = !!data.daysOff[key];
              const planId = data.weekPlan[String(d.getDay())];
              const planned = !!planId;
              const isToday = key === today;
              return (
                <div key={key} className="flex min-w-0 flex-col items-center gap-1.5">
                  <span className="text-[9px] font-black uppercase text-mute">
                    {language === 'th'
                      ? t(DAY_KEYS[d.getDay()])
                      : DAY_KEYS[d.getDay()][0]}
                  </span>
                  <div
                    className={`grid aspect-square w-full max-w-9 place-items-center rounded-xl border text-xs font-black transition ${done ? 'border-transparent bg-[var(--good)] text-black' : off ? 'border-line bg-[var(--surface-2)] text-mute' : planned ? 'border-[var(--accent-line)] bg-[var(--accent-soft)] text-[var(--accent)]' : isToday ? 'border-strong bg-[var(--surface-2)]' : 'border-line bg-[var(--surface-2)] text-dim'}`}
                  >
                    {done ? (
                      <Check size={15} strokeWidth={3} />
                    ) : off ? (
                      <Moon size={13} />
                    ) : (
                      d.getDate()
                    )}
                  </div>
                  <span
                    className={`h-1 w-1 rounded-full ${isToday ? 'bg-[var(--accent)]' : 'bg-transparent'}`}
                  />
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={() => toggleCheckin(today)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-[11px] font-black transition ${isCheckin || trainedDays.has(today) ? 'border-transparent bg-[var(--good-soft)] text-[var(--good)]' : 'border-line bg-[var(--surface-2)] text-dim hover:border-strong'}`}
            >
              <Check size={13} />{' '}
              {trainedDays.has(today)
                ? t('Trained today')
                : isCheckin
                  ? t('Checked in')
                  : t('Check in')}
            </button>
            <button
              onClick={() =>
                toggleDayOff(today, isOff ? null : t('Rest day'))
              }
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-[11px] font-black transition ${isOff ? 'border-transparent bg-[var(--surface-3)] text-[var(--text)]' : 'border-line bg-[var(--surface-2)] text-dim hover:border-strong'}`}
            >
              <Moon size={13} /> {isOff ? t('Rest day') : t('Mark rest')}
            </button>
          </div>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          {
            label: t('Workouts'),
            value: data.sessions.length,
            sub: t('{n} this week', { n: daysDoneThisWeek(data) }),
            icon: <Dumbbell size={14} />,
          },
          {
            label: t('Working sets'),
            value: sets.toLocaleString(),
            sub: t('all time'),
            icon: <TrendingUp size={14} />,
          },
          {
            label: t('Volume'),
            value: volumeLabel(volume, unit),
            sub: t('total lifted'),
            icon: <Activity size={14} />,
          },
          {
            label: t('Calories'),
            value: `${Math.round(kcal)}`,
            sub: t('of {n} kcal', { n: kcalGoal }),
            icon: <Salad size={14} />,
          },
        ].map((s) => (
          <Card key={s.label} className="p-4">
            <Stat label={s.label} value={s.value} sub={s.sub} icon={s.icon} />
          </Card>
        ))}
      </div>

      <div className="mt-6 grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <div>
          <SectionHeader
            title={t('Today’s plan')}
            subtitle={
              isOff
                ? t('Rest and recover')
                : todayRoutine
                  ? t('{n} exercises ready', {
                      n: todayRoutine.exerciseIds.length,
                    })
                  : t('No routine planned')
            }
            action={
              <Link
                to="/routines"
                className="text-[11px] font-black text-[var(--accent)]"
              >
                {t('Edit plan')}
              </Link>
            }
          />
          {todayRoutine ? (
            <Card className="overflow-hidden">
              <div className="flex items-center gap-3 border-b border-line p-4">
                <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
                  <CalendarDays size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-black">
                    {todayRoutine.name}
                  </p>
                  <p className="text-xs font-semibold text-mute">
                    {t('{n} exercises · {s} sets', {
                      n: todayRoutine.exerciseIds.length,
                      s: Object.values(todayRoutine.sets).reduce(
                        (a, b) => a + b,
                        0,
                      ),
                    })}
                  </p>
                </div>
                <Btn size="sm" onClick={startRoutine}>
                  {t('Start routine')}
                </Btn>
              </div>
              <div className="divide-y divide-[var(--line)]">
                {todayRoutine.exerciseIds.slice(0, 5).map((id) => {
                  const ex = allExercises().find((e) => e.id === id);
                  if (!ex) return null;
                  return (
                    <Link
                      key={id}
                      to={`/library/${id}`}
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--surface-2)]"
                    >
                      <ArtThumb
                        slug={ex.art}
                        size={36}
                        fallback={<ExerciseIcon ex={ex} size={36} />}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-extrabold">
                          {ex.name}
                        </p>
                        <p className="text-[11px] font-bold text-mute">
                          {t('{m} · {n} sets', {
                            m: tm(
                              ex.primary,
                              MUSCLE_LABEL[ex.primary] ?? ex.primary,
                            ),
                            n: todayRoutine.sets[id] ?? 3,
                          })}
                        </p>
                      </div>
                      <ChevronRight size={16} className="text-mute" />
                    </Link>
                  );
                })}
                {todayRoutine.exerciseIds.length > 5 && (
                  <p className="px-4 py-2.5 text-[11px] font-bold text-mute">
                    {t('+{n} more exercises', {
                      n: todayRoutine.exerciseIds.length - 5,
                    })}
                  </p>
                )}
              </div>
            </Card>
          ) : (
            <EmptyState
              icon={<CalendarDays size={24} />}
              title={isOff ? t('Rest day') : t('Nothing planned for today')}
              body={
                isOff
                  ? t(
                      'Recovery is part of the program. Come back stronger tomorrow.',
                    )
                  : t(
                      'Pick muscles and let Gymmiie suggest the session, or set a weekly plan.',
                    )
              }
              action={
                <Btn
                  variant="primary"
                  size="sm"
                  onClick={() => navigate('/train?focus=muscles')}
                >
                  {t('Pick muscles')}
                </Btn>
              }
            />
          )}

          <SectionHeader
            title={t('Recent workouts')}
            action={
              <Link
                to="/history"
                className="text-[11px] font-black text-[var(--accent)]"
              >
                {t('View all')}
              </Link>
            }
          />
          {recent.length ? (
            <Card className="divide-y divide-[var(--line)] overflow-hidden">
              {recent.map((s) => {
                const vol = sessionVolume(s);
                return (
                  <Link
                    key={s.id}
                    to={`/history/${s.id}`}
                    className="flex items-center gap-3 p-3.5 hover:bg-[var(--surface-2)]"
                  >
                    <div className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--surface-2)] text-[var(--accent)]">
                      <Dumbbell size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-extrabold">
                        {s.name || s.exercises[0]?.name || t('Workout')}
                      </p>
                      <p className="text-[11px] font-bold text-mute">
                        {t('{date} · {dur} · {n} exercises', {
                          date: fmtDate(sessionTrainingDate(s), {
                            weekday: 'short',
                            day: 'numeric',
                            month: 'short',
                          }),
                          dur: fmtDuration(s.durationSec),
                          n: s.exercises.length,
                        })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="num text-sm font-black">
                        {volumeLabel(vol, unit).replace(` ${unit}`, '')}
                      </p>
                      <p className="text-[9px] font-black uppercase text-mute">
                        {t('{unit} vol', { unit })}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </Card>
          ) : (
            <EmptyState
              icon={<Dumbbell size={24} />}
              title={t('No workouts yet')}
              body={t(
                'Start with a muscle group and Gymmiie will build a session with warm-ups.',
              )}
              action={
                <Btn
                  variant="primary"
                  size="sm"
                  onClick={() => navigate('/train')}
                >
                  {t('Start training')}
                </Btn>
              }
            />
          )}
        </div>

        <div>
          <SectionHeader title={t('Quick start')} />
          <div className="grid grid-cols-2 gap-2">
            {[
              {
                title: t('By muscle'),
                hint: t('Body map picks'),
                icon: <Dumbbell size={18} />,
                to: '/train?focus=muscles',
              },
              {
                title: t('Browse'),
                hint: t('{n} exercises', { n: 501 }),
                icon: <BookOpen size={18} />,
                to: '/library',
              },
              {
                title: t('Routines'),
                hint: t('Plans & splits'),
                icon: <CalendarDays size={18} />,
                to: '/routines',
              },
              {
                title: t('Food'),
                hint: t('{n} foods', { n: 561 }),
                icon: <Salad size={18} />,
                to: '/nutrition',
              },
            ].map((q) => (
              <Link
                key={q.title}
                to={q.to}
                className="card p-4 transition hover:border-strong active:scale-[.99]"
              >
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--surface-2)] text-[var(--accent)]">
                  {q.icon}
                </span>
                <p className="mt-3 text-sm font-black">{q.title}</p>
                <p className="text-[11px] font-bold text-mute">{q.hint}</p>
              </Link>
            ))}
          </div>

          {prs.length > 0 && (
            <>
              <SectionHeader
                title={t('Recent bests')}
                action={
                  <Link
                    to="/progress"
                    className="text-[11px] font-black text-[var(--accent)]"
                  >
                    {t('All PRs')}
                  </Link>
                }
              />
              <Card className="divide-y divide-[var(--line)] overflow-hidden">
                {prs.map((p) => (
                  <Link
                    key={p.id}
                    to={`/library/${p.id}`}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--surface-2)]"
                  >
                    <Trophy size={17} className="text-[var(--warn)]" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-extrabold">
                        {p.name}
                      </p>
                      <p className="text-[10px] font-bold text-mute">
                        {p.kind === 'weight' ? t('Top weight') : t(p.kind)}
                      </p>
                    </div>
                    <span className="num text-sm font-black">
                      {p.kind === 'weight'
                        ? `${toDisplayWeight(p.best, unit).toFixed(1)} ${unit}`
                        : p.kind === 'time'
                          ? `${p.best}s`
                          : p.kind === 'distance'
                            ? `${p.best} km`
                            : t('{n} reps', { n: p.best })}
                    </span>
                  </Link>
                ))}
              </Card>
            </>
          )}

          <SectionHeader
            title={t('Bodyweight')}
            action={
              <Link
                to="/progress"
                className="text-[11px] font-black text-[var(--accent)]"
              >
                {t('Log')}
              </Link>
            }
          />
          <Card className="p-4">
            <div className="flex items-end justify-between">
              <div>
                <p className="label">{t('Latest')}</p>
                <p className="num mt-1 text-2xl font-black">
                  {toDisplayWeight(data.profile.weightKg, unit).toFixed(1)}{' '}
                  <span className="text-sm text-mute">{unit}</span>
                </p>
              </div>
              {data.bodyGoalKg != null && (
                <p className="text-[11px] font-bold text-mute">
                  {t('Goal {w} {unit}', {
                    w: toDisplayWeight(data.bodyGoalKg, unit).toFixed(1),
                    unit,
                  })}
                </p>
              )}
            </div>
            <div className="mt-3">
              {lastWeights.length > 1 ? (
                <Sparkline data={lastWeights} height={44} />
              ) : (
                <p className="py-3 text-[11px] font-semibold text-mute">
                  {t('Log your weight to see the trend.')}
                </p>
              )}
            </div>
          </Card>

          <SectionHeader
            title={t('Daily journal')}
            action={
              <Link
                to="/notes"
                className="text-[11px] font-black text-[var(--accent)]"
              >
                {t('Open')}
              </Link>
            }
          />
          <Link
            to="/notes"
            className="card flex items-start gap-3 p-4 transition hover:border-strong"
          >
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--surface-2)] text-[var(--accent)]">
              <Sparkles size={17} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-extrabold">
                {data.notes[0]?.text?.slice(0, 70) ||
                  t('Write a note, plan or pain flag')}
              </p>
              <p className="mt-1 text-[11px] font-bold text-mute">
                {data.notes.length
                  ? t('{n} journal entries', { n: data.notes.length })
                  : t('Track how training feels')}
              </p>
            </div>
          </Link>
        </div>
      </div>

      {dialogs}
      <div className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-[var(--surface)] px-4 py-3">
        <div className="flex items-center gap-2 text-[11px] font-bold text-mute">
          <Scale size={14} />{' '}
          {t('Offline logging · account sync when connected')}
        </div>
        <div className="flex items-center gap-3 text-[11px] font-bold text-mute">
          <Timer size={14} />{' '}
          {data.sessions.reduce((n, s) => n + s.durationSec, 0) / 3600 > 0
            ? t('{n} h trained', {
                n: (
                  data.sessions.reduce((n, s) => n + s.durationSec, 0) / 3600
                ).toFixed(1),
              })
            : t('Ready when you are')}
        </div>
      </div>
    </div>
  );
}
