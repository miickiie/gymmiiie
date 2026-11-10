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
import { allExercises, useStore } from '../lib/store';

export default function Dashboard() {
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
  const trainedDays = new Set(data.sessions.map((s) => dateKey(s.date)));
  const isOff = !!data.daysOff[today];
  const isCheckin = data.checkins.includes(today);
  const todayEntries = data.nutrition.entries.filter((e) => e.date === today);
  const kcal = todayEntries.reduce((n, e) => n + e.kcal, 0);
  const kcalGoal = data.nutrition.goals.kcal;
  const lastWeights = data.bodyweights.slice(-10).map((b) => b.kg);
  const unit = data.settings.unit;
  const greeting =
    new Date().getHours() < 12
      ? 'Good morning'
      : new Date().getHours() < 18
        ? 'Good afternoon'
        : 'Good evening';

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
            ? 'You have a workout in progress. Pick up where you left off.'
            : isOff
              ? 'Rest day. Recovery is training too.'
              : 'Tap a muscle or follow today’s plan.'
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
              <p className="label text-[var(--accent)]">Workout in progress</p>
              <p className="mt-0.5 truncate text-sm font-black">
                {active.name || 'Freestyle session'}
              </p>
              <p className="text-xs font-semibold text-dim">
                {active.exercises.length} exercises ·{' '}
                {fmtTime(new Date(active.startedAt))} start
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

      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
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
                  of {goal}
                </p>
              </div>
            </Ring>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1 rounded-full bg-[var(--warn)]/10 px-2 py-1 text-[11px] font-black text-[var(--warn)]">
                  <Flame size={13} /> {streak} day streak
                </span>
                <span className="rounded-full bg-[var(--surface-2)] px-2 py-1 text-[11px] font-black text-mute">
                  Lv {level.level}
                </span>
              </div>
              <h2 className="mt-2 text-xl font-black tracking-tight">
                {week >= goal
                  ? 'Weekly goal smashed.'
                  : week === 0
                    ? 'Week starts with one rep.'
                    : `${goal - week} more to hit your goal.`}
              </h2>
              <p className="mt-1 text-xs font-semibold text-dim">
                {todayRoutine
                  ? `Today’s plan: ${todayRoutine.name} · ${todayRoutine.exerciseIds.length} exercises`
                  : isOff
                    ? 'You marked today as a rest day.'
                    : 'No plan set for today. Train by muscle instead.'}
              </p>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--surface-3)]">
                <div
                  className="h-full rounded-full bg-[var(--accent)] transition-all"
                  style={{ width: `${Math.min(100, level.progress)}%` }}
                />
              </div>
              <p className="mt-1 text-[10px] font-bold text-mute">
                {level.xp.toLocaleString()} XP ·{' '}
                {level.next - (level.xp % level.next)} to level{' '}
                {level.level + 1}
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
                Resume workout
              </Btn>
            ) : (
              <Btn
                variant="primary"
                size="lg"
                onClick={() => navigate('/train')}
                icon={<Zap size={17} />}
              >
                Start workout
              </Btn>
            )}
          </div>
        </Card>

        <Card className="p-5">
          <SectionHeader
            title="This week"
            action={
              <Link
                to="/progress"
                className="text-[11px] font-black text-[var(--accent)]"
              >
                Progress
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
                <div key={key} className="flex flex-col items-center gap-1.5">
                  <span className="text-[9px] font-black uppercase text-mute">
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'][d.getDay()]}
                  </span>
                  <div
                    className={`grid h-9 w-9 place-items-center rounded-xl border text-xs font-black transition ${done ? 'border-transparent bg-[var(--good)] text-black' : off ? 'border-line bg-[var(--surface-2)] text-mute' : planned ? 'border-[var(--accent-line)] bg-[var(--accent-soft)] text-[var(--accent)]' : isToday ? 'border-strong bg-[var(--surface-2)]' : 'border-line bg-[var(--surface-2)] text-dim'}`}
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
                ? 'Trained today'
                : isCheckin
                  ? 'Checked in'
                  : 'Check in'}
            </button>
            <button
              onClick={() => toggleDayOff(today, isOff ? null : 'Rest day')}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-[11px] font-black transition ${isOff ? 'border-transparent bg-[var(--surface-3)] text-[var(--text)]' : 'border-line bg-[var(--surface-2)] text-dim hover:border-strong'}`}
            >
              <Moon size={13} /> {isOff ? 'Rest day' : 'Mark rest'}
            </button>
          </div>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          {
            label: 'Workouts',
            value: data.sessions.length,
            sub: `${daysDoneThisWeek(data)} this week`,
            icon: <Dumbbell size={14} />,
          },
          {
            label: 'Working sets',
            value: sets.toLocaleString(),
            sub: 'all time',
            icon: <TrendingUp size={14} />,
          },
          {
            label: 'Volume',
            value: volumeLabel(volume, unit),
            sub: 'total lifted',
            icon: <Activity size={14} />,
          },
          {
            label: 'Calories',
            value: `${Math.round(kcal)}`,
            sub: `of ${kcalGoal} kcal`,
            icon: <Salad size={14} />,
          },
        ].map((s) => (
          <Card key={s.label} className="p-4">
            <Stat label={s.label} value={s.value} sub={s.sub} icon={s.icon} />
          </Card>
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        <div>
          <SectionHeader
            title="Today’s plan"
            subtitle={
              isOff
                ? 'Rest and recover'
                : todayRoutine
                  ? `${todayRoutine.exerciseIds.length} exercises ready`
                  : 'No routine planned'
            }
            action={
              <Link
                to="/routines"
                className="text-[11px] font-black text-[var(--accent)]"
              >
                Edit plan
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
                    {todayRoutine.exerciseIds.length} exercises ·{' '}
                    {Object.values(todayRoutine.sets).reduce(
                      (a, b) => a + b,
                      0,
                    )}{' '}
                    sets
                  </p>
                </div>
                <Btn size="sm" onClick={startRoutine}>
                  Start routine
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
                          {MUSCLE_LABEL[ex.primary] ?? ex.primary} ·{' '}
                          {todayRoutine.sets[id] ?? 3} sets
                        </p>
                      </div>
                      <ChevronRight size={16} className="text-mute" />
                    </Link>
                  );
                })}
                {todayRoutine.exerciseIds.length > 5 && (
                  <p className="px-4 py-2.5 text-[11px] font-bold text-mute">
                    +{todayRoutine.exerciseIds.length - 5} more exercises
                  </p>
                )}
              </div>
            </Card>
          ) : (
            <EmptyState
              icon={<CalendarDays size={24} />}
              title={isOff ? 'Rest day' : 'Nothing planned for today'}
              body={
                isOff
                  ? 'Recovery is part of the program. Come back stronger tomorrow.'
                  : 'Pick muscles and let Gymmiie suggest the session, or set a weekly plan.'
              }
              action={
                <Btn
                  variant="primary"
                  size="sm"
                  onClick={() => navigate('/train')}
                >
                  Pick muscles
                </Btn>
              }
            />
          )}

          <SectionHeader
            title="Recent workouts"
            action={
              <Link
                to="/history"
                className="text-[11px] font-black text-[var(--accent)]"
              >
                View all
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
                        {s.name || s.exercises[0]?.name || 'Workout'}
                      </p>
                      <p className="text-[11px] font-bold text-mute">
                        {fmtDate(s.date, {
                          weekday: 'short',
                          day: 'numeric',
                          month: 'short',
                        })}{' '}
                        · {fmtDuration(s.durationSec)} · {s.exercises.length}{' '}
                        exercises
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="num text-sm font-black">
                        {volumeLabel(vol, unit).replace(` ${unit}`, '')}
                      </p>
                      <p className="text-[9px] font-black uppercase text-mute">
                        {unit} vol
                      </p>
                    </div>
                  </Link>
                );
              })}
            </Card>
          ) : (
            <EmptyState
              icon={<Dumbbell size={24} />}
              title="No workouts yet"
              body="Start with a muscle group and Gymmiie will build a session with warm-ups."
              action={
                <Btn
                  variant="primary"
                  size="sm"
                  onClick={() => navigate('/train')}
                >
                  Start training
                </Btn>
              }
            />
          )}
        </div>

        <div>
          <SectionHeader title="Quick start" />
          <div className="grid grid-cols-2 gap-2">
            {[
              {
                title: 'By muscle',
                hint: 'Body map picks',
                icon: <Dumbbell size={18} />,
                to: '/train',
              },
              {
                title: 'Browse',
                hint: '466 exercises',
                icon: <BookOpen size={18} />,
                to: '/library',
              },
              {
                title: 'Routines',
                hint: 'Plans & splits',
                icon: <CalendarDays size={18} />,
                to: '/routines',
              },
              {
                title: 'Food',
                hint: '561 foods',
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
                title="Recent bests"
                action={
                  <Link
                    to="/progress"
                    className="text-[11px] font-black text-[var(--accent)]"
                  >
                    All PRs
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
                        {p.kind === 'weight' ? 'Top weight' : p.kind}
                      </p>
                    </div>
                    <span className="num text-sm font-black">
                      {p.kind === 'weight'
                        ? `${toDisplayWeight(p.best, unit).toFixed(1)} ${unit}`
                        : p.kind === 'time'
                          ? `${p.best}s`
                          : p.kind === 'distance'
                            ? `${p.best} km`
                            : `${p.best} reps`}
                    </span>
                  </Link>
                ))}
              </Card>
            </>
          )}

          <SectionHeader
            title="Bodyweight"
            action={
              <Link
                to="/progress"
                className="text-[11px] font-black text-[var(--accent)]"
              >
                Log
              </Link>
            }
          />
          <Card className="p-4">
            <div className="flex items-end justify-between">
              <div>
                <p className="label">Latest</p>
                <p className="num mt-1 text-2xl font-black">
                  {toDisplayWeight(data.profile.weightKg, unit).toFixed(1)}{' '}
                  <span className="text-sm text-mute">{unit}</span>
                </p>
              </div>
              {data.bodyGoalKg != null && (
                <p className="text-[11px] font-bold text-mute">
                  Goal {toDisplayWeight(data.bodyGoalKg, unit).toFixed(1)}{' '}
                  {unit}
                </p>
              )}
            </div>
            <div className="mt-3">
              {lastWeights.length > 1 ? (
                <Sparkline data={lastWeights} height={44} />
              ) : (
                <p className="py-3 text-[11px] font-semibold text-mute">
                  Log your weight to see the trend.
                </p>
              )}
            </div>
          </Card>

          <SectionHeader
            title="Daily journal"
            action={
              <Link
                to="/notes"
                className="text-[11px] font-black text-[var(--accent)]"
              >
                Open
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
                  'Write a note, plan or pain flag'}
              </p>
              <p className="mt-1 text-[11px] font-bold text-mute">
                {data.notes.length
                  ? `${data.notes.length} journal entries`
                  : 'Track how training feels'}
              </p>
            </div>
          </Link>
        </div>
      </div>

      {dialogs}
      <div className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-[var(--surface)] px-4 py-3">
        <div className="flex items-center gap-2 text-[11px] font-bold text-mute">
          <Scale size={14} /> Offline logging · account sync when connected
        </div>
        <div className="flex items-center gap-3 text-[11px] font-bold text-mute">
          <Timer size={14} />{' '}
          {data.sessions.reduce((n, s) => n + s.durationSec, 0) / 3600 > 0
            ? `${(data.sessions.reduce((n, s) => n + s.durationSec, 0) / 3600).toFixed(1)} h trained`
            : 'Ready when you are'}
        </div>
      </div>
    </div>
  );
}
