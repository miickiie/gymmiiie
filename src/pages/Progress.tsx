import {
  Activity,
  Award,
  BarChart3,
  Check,
  ChevronRight,
  Dumbbell,
  Flame,
  Medal,
  Plus,
  Scale,
  Search,
  Star,
  Target,
  Trash2,
  TrendingUp,
  Trophy,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import BodyMap from '../components/BodyMap';
import { recordLabel, recordValue } from '../components/recordLabels';
import {
  BarChart,
  Btn,
  Card,
  EmptyState,
  LineChart,
  NumericInput,
  PageHeader,
  Ring,
  SectionHeader,
  Stat,
  useToast,
} from '../components/ui';
import { addDays, dateKey, fmtDate, fmtDuration } from '../lib/date';
import {
  awardsFor,
  bodyMeasureSeries,
  currentStreak,
  dailyVolume,
  latestMeasure,
  levelFor,
  MEASURE_KEYS,
  MUSCLE_LABEL,
  muscleSetsBetween,
  personalRecords,
  toDisplayWeight,
  totalSets,
  totalVolume,
  volumeLabel,
  weeklyVolume,
} from '../lib/stats';
import { useStore } from '../lib/store';
import type { PR } from '../types';

type Tab = 'overview' | 'records' | 'body' | 'awards';

export default function Progress() {
  const data = useStore((s) => s.data);
  const [tab, setTab] = useState<Tab>('overview');
  const [metric, setMetric] = useState<'volume' | 'sets'>('volume');
  const [recordQuery, setRecordQuery] = useState('');

  const unit = data.settings.unit;
  const streak = currentStreak(data);
  const level = levelFor(data.sessions);
  const weeks = useMemo(() => weeklyVolume(data.sessions, 12), [data.sessions]);
  const daily = useMemo(() => dailyVolume(data.sessions, 30), [data.sessions]);
  const prs = useMemo(() => personalRecords(data.sessions), [data.sessions]);
  const heat = useMemo(
    () =>
      muscleSetsBetween(data.sessions, addDays(new Date(), -27), new Date()),
    [data.sessions],
  );
  const heatMax = Math.max(1, ...Object.values(heat));
  const awards = useMemo(
    () => awardsFor(data.sessions, streak, data.routines),
    [data.sessions, streak, data.routines],
  );
  const earned = awards.filter((a) => a.earned).length;
  const totalTime = data.sessions.reduce((n, s) => n + s.durationSec, 0);
  const muscleOrder = Object.entries(heat).sort((a, b) => b[1] - a[1]);
  const filteredPrs = prs.filter(
    (p) =>
      !recordQuery || p.name.toLowerCase().includes(recordQuery.toLowerCase()),
  );

  return (
    <div className="page-enter">
      <PageHeader
        eyebrow="Progress"
        title="Your progress"
        subtitle={`${data.sessions.length} workouts · ${volumeLabel(totalVolume(data.sessions), unit)} lifted · ${fmtDuration(totalTime)} trained`}
      />

      <div className="scroll-x mb-4 pb-1">
        {(
          [
            ['overview', 'Overview', <BarChart3 key="i" size={14} />],
            ['records', 'Records', <Trophy key="i" size={14} />],
            ['body', 'Body', <Scale key="i" size={14} />],
            ['awards', 'Awards', <Medal key="i" size={14} />],
          ] as const
        ).map(([id, label, icon]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-black transition ${tab === id ? 'border-[var(--accent-line)] bg-[var(--accent-soft)] text-[var(--accent)]' : 'border-line bg-[var(--surface)] text-dim hover:border-strong'}`}
          >
            {icon} {label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                {
                  label: 'Streak',
                  value: `${streak}d`,
                  icon: <Flame size={14} />,
                },
                {
                  label: 'Sets',
                  value: totalSets(data.sessions).toLocaleString(),
                  icon: <Dumbbell size={14} />,
                },
                {
                  label: 'Hours',
                  value: (totalTime / 3600).toFixed(1),
                  icon: <Activity size={14} />,
                },
                {
                  label: 'PRs',
                  value: String(prs.length),
                  icon: <Trophy size={14} />,
                },
              ].map((s) => (
                <Card key={s.label} className="p-4">
                  <Stat label={s.label} value={s.value} icon={s.icon} />
                </Card>
              ))}
            </div>

            <SectionHeader
              title="Training load"
              subtitle="Last 12 weeks"
              action={
                <div className="flex rounded-full border border-line bg-[var(--surface-2)] p-0.5">
                  {(['volume', 'sets'] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => setMetric(m)}
                      className={`rounded-full px-2.5 py-1 text-[10px] font-black capitalize ${metric === m ? 'bg-[var(--surface-3)] text-[var(--text)]' : 'text-mute'}`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              }
            />
            <Card className="p-4">
              <BarChart
                data={weeks.map((w) => ({
                  label: w.label.split(' ')[0],
                  value:
                    metric === 'volume'
                      ? Math.round(toDisplayWeight(w.value, unit))
                      : w.sets,
                }))}
                height={160}
                format={(v) =>
                  metric === 'volume'
                    ? `${v.toLocaleString()} ${unit}`
                    : `${v} sets`
                }
              />
              <div className="mt-3 flex items-center justify-between text-[10px] font-bold text-mute">
                <span>
                  {metric === 'volume'
                    ? `${volumeLabel(
                        weeks.reduce((n, w) => n + w.value, 0),
                        unit,
                      )} across 12 weeks`
                    : `${weeks.reduce((n, w) => n + w.sets, 0)} working sets across 12 weeks`}
                </span>
                <span className="flex items-center gap-1 text-[var(--good)]">
                  <TrendingUp size={11} />{' '}
                  {weeks[weeks.length - 1]?.value >
                  weeks[weeks.length - 2]?.value
                    ? 'trending up'
                    : 'keep going'}
                </span>
              </div>
            </Card>

            <SectionHeader
              title="Last 30 days"
              subtitle={`Daily volume (${unit})`}
            />
            <Card className="p-4">
              <LineChart
                data={daily.map((d) => ({
                  ...d,
                  value: Math.round(toDisplayWeight(d.value, unit)),
                }))}
                height={150}
                format={(v) => `${Math.round(v).toLocaleString()} ${unit}`}
              />
            </Card>

            <SectionHeader
              title="Recent records"
              action={
                <button
                  onClick={() => setTab('records')}
                  className="text-[11px] font-black text-[var(--accent)]"
                >
                  All records
                </button>
              }
            />
            <Card className="divide-y divide-[var(--line)] overflow-hidden">
              {prs.slice(0, 6).map((p) => (
                <Link
                  key={p.id}
                  to={`/library/${p.id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--surface-2)]"
                >
                  <Trophy size={16} className="text-[var(--warn)]" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-extrabold">{p.name}</p>
                    <p className="text-[10px] font-bold text-mute">
                      {recordValue(p, unit)}
                      {p.kind === 'weight' && p.oneRm > 0
                        ? ` · e1RM ${toDisplayWeight(p.oneRm, unit).toFixed(1)} ${unit}`
                        : ''}
                    </p>
                  </div>
                  <ChevronRight size={14} className="text-mute" />
                </Link>
              ))}
              {!prs.length && (
                <p className="px-4 py-6 text-center text-xs font-semibold text-mute">
                  Log a workout to set your first record.
                </p>
              )}
            </Card>
          </div>

          <div>
            <Card className="p-4">
              <div className="flex items-center gap-4">
                <Ring value={level.progress} size={88} stroke={8}>
                  <div className="text-center">
                    <p className="num text-xl font-black leading-none">
                      {level.level}
                    </p>
                    <p className="text-[8px] font-black uppercase text-mute">
                      level
                    </p>
                  </div>
                </Ring>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-black">Level {level.level}</p>
                  <p className="mt-0.5 text-[11px] font-semibold text-mute">
                    {level.xp.toLocaleString()} XP earned
                  </p>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--surface-3)]">
                    <div
                      className="h-full rounded-full bg-[var(--accent)]"
                      style={{ width: `${level.progress}%` }}
                    />
                  </div>
                  <p className="mt-1 text-[10px] font-bold text-mute">
                    {level.next} XP to next level
                  </p>
                </div>
              </div>
            </Card>

            <SectionHeader
              title="Muscle balance"
              subtitle="Working sets · last 4 weeks"
            />
            <Card className="p-4">
              <BodyMap heat={heat} />
              <div className="mt-4 space-y-2">
                {muscleOrder.length ? (
                  muscleOrder.map(([m, v]) => (
                    <div key={m}>
                      <div className="flex items-center justify-between text-[10px] font-black">
                        <span className="text-dim">{MUSCLE_LABEL[m] ?? m}</span>
                        <span className="text-mute">
                          {Math.round(v * 10) / 10} sets
                        </span>
                      </div>
                      <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-[var(--surface-3)]">
                        <div
                          className="h-full rounded-full bg-[var(--accent)]"
                          style={{ width: `${(v / heatMax) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="py-4 text-center text-xs font-semibold text-mute">
                    No sessions in the last four weeks.
                  </p>
                )}
              </div>
            </Card>

            <SectionHeader
              title="Milestones"
              action={
                <button
                  onClick={() => setTab('awards')}
                  className="text-[11px] font-black text-[var(--accent)]"
                >
                  Awards
                </button>
              }
            />
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-black">
                  {earned} of {awards.length} earned
                </p>
                <Award size={17} className="text-[var(--warn)]" />
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--surface-3)]">
                <div
                  className="h-full rounded-full bg-[var(--warn)]"
                  style={{ width: `${(earned / awards.length) * 100}%` }}
                />
              </div>
              <div className="mt-3 grid grid-cols-4 gap-1.5">
                {awards.slice(0, 8).map((a) => (
                  <div
                    key={a.id}
                    title={`${a.name}: ${a.detail}`}
                    className={`grid aspect-square place-items-center rounded-xl ${a.earned ? 'bg-[var(--warn)]/15 text-[var(--warn)]' : 'bg-[var(--surface-2)] text-[var(--surface-3)]'}`}
                  >
                    <Star size={17} fill={a.earned ? 'currentColor' : 'none'} />
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}

      {tab === 'records' && (
        <div>
          <div className="relative mb-3">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-mute"
            />
            <input
              className="input pl-9"
              placeholder="Search your records…"
              value={recordQuery}
              onChange={(e) => setRecordQuery(e.target.value)}
            />
          </div>
          {filteredPrs.length ? (
            <Card className="divide-y divide-[var(--line)] overflow-hidden">
              {filteredPrs.map((p) => (
                <RecordRow key={p.id} pr={p} unit={unit} />
              ))}
            </Card>
          ) : (
            <EmptyState
              icon={<Trophy size={24} />}
              title={prs.length ? 'No matching records' : 'No records yet'}
              body={
                prs.length
                  ? 'Try a different search.'
                  : 'Every exercise you train gets a best set and estimated 1RM here.'
              }
              action={
                !prs.length ? (
                  <Link to="/train">
                    <Btn variant="primary">Start training</Btn>
                  </Link>
                ) : undefined
              }
            />
          )}
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {[
              {
                label: 'Top e1RM',
                value: prs.some((p) => p.kind === 'weight' && p.oneRm > 0)
                  ? `${toDisplayWeight(Math.max(...prs.filter((p) => p.kind === 'weight').map((p) => p.oneRm)), unit).toFixed(1)} ${unit}`
                  : '—',
                icon: <Trophy size={15} />,
              },
              {
                label: 'Heaviest set',
                value: prs.some((p) => p.kind === 'weight')
                  ? `${toDisplayWeight(Math.max(...prs.filter((p) => p.kind === 'weight').map((p) => p.best)), unit).toFixed(1)} ${unit}`
                  : '—',
                icon: <Dumbbell size={15} />,
              },
              {
                label: 'Exercises tracked',
                value: String(prs.length),
                icon: <Target size={15} />,
              },
            ].map((s) => (
              <Card key={s.label} className="p-4">
                <Stat label={s.label} value={s.value} icon={s.icon} />
              </Card>
            ))}
          </div>
        </div>
      )}

      {tab === 'body' && <BodyTab />}

      {tab === 'awards' && (
        <div>
          <Card className="mb-4 flex items-center gap-4 p-4">
            <Ring value={(earned / awards.length) * 100} size={76} stroke={7}>
              <span className="num text-sm font-black">
                {earned}/{awards.length}
              </span>
            </Ring>
            <div>
              <p className="text-sm font-black">Trophy cabinet</p>
              <p className="mt-0.5 text-xs font-semibold text-mute">
                Earn badges by showing up, lifting heavy, and staying
                consistent.
              </p>
            </div>
          </Card>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {awards.map((a) => (
              <Card
                key={a.id}
                className={`p-4 ${a.earned ? 'border-[var(--warn)]/30' : ''}`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${a.earned ? 'bg-[var(--warn)]/15 text-[var(--warn)]' : 'bg-[var(--surface-2)] text-mute'}`}
                  >
                    {a.earned ? <Medal size={20} /> : <Star size={19} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-black">{a.name}</p>
                    <p className="text-[11px] font-semibold text-mute">
                      {a.detail}
                    </p>
                  </div>
                  {a.earned && (
                    <Check size={16} className="text-[var(--good)]" />
                  )}
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--surface-3)]">
                  <div
                    className={`h-full rounded-full ${a.earned ? 'bg-[var(--warn)]' : 'bg-[var(--accent)]'}`}
                    style={{ width: `${Math.round(a.progress * 100)}%` }}
                  />
                </div>
                <p className="mt-1 text-right text-[9px] font-black text-mute">
                  {Math.round(a.progress * 100)}%
                </p>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function RecordRow({ pr, unit }: { pr: PR; unit: 'kg' | 'lb' }) {
  const isWeight = pr.kind === 'weight';
  return (
    <Link
      to={`/library/${pr.id}`}
      className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--surface-2)]"
    >
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--surface-2)] text-[var(--warn)]">
        <Trophy size={15} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-extrabold">{pr.name}</p>
        <p className="text-[10px] font-bold text-mute">
          {recordValue(pr, unit)}
          {isWeight && pr.oneRm > 0
            ? ` · e1RM ${toDisplayWeight(pr.oneRm, unit).toFixed(1)} ${unit}`
            : ''}
        </p>
      </div>
      <span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[9px] font-black uppercase text-mute">
        {recordLabel(pr.kind)}
      </span>
      <ChevronRight size={14} className="text-mute" />
    </Link>
  );
}

function BodyTab() {
  const data = useStore((s) => s.data);
  const update = useStore((s) => s.update);
  const addBodyweight = useStore((s) => s.addBodyweight);
  const deleteBodyweight = useStore((s) => s.deleteBodyweight);
  const addMeasure = useStore((s) => s.addMeasure);
  const deleteMeasure = useStore((s) => s.deleteMeasure);
  const toast = useToast();
  const unit = data.settings.unit;
  const [weight, setWeight] = useState(
    String(Math.round(toDisplayWeight(data.profile.weightKg, unit) * 10) / 10),
  );
  const [goal, setGoal] = useState(
    data.bodyGoalKg
      ? String(Math.round(toDisplayWeight(data.bodyGoalKg, unit) * 10) / 10)
      : '',
  );
  const [key, setKey] = useState('waist');
  const [value, setValue] = useState('');
  const [day, setDay] = useState(dateKey());

  const weights = data.bodyweights;
  const series = weights.map((b) => ({
    date: b.date,
    value: toDisplayWeight(b.kg, unit),
  }));
  const measureSeries = bodyMeasureSeries(data.measures, key);
  const first = series[0]?.value;
  const latest = series[series.length - 1]?.value;
  const delta = first != null && latest != null ? latest - first : 0;

  const saveWeight = () => {
    const v = Number(weight);
    if (!Number.isFinite(v) || v <= 0) {
      toast.push('Enter a valid weight', 'bad');
      return;
    }
    addBodyweight(fromDisplay(v));
    toast.push('Weight logged', 'good');
  };
  const saveGoal = () => {
    const v = Number(goal);
    if (goal.trim() && (!Number.isFinite(v) || v <= 0)) {
      toast.push('Enter a positive, finite goal or clear the field', 'bad');
      return;
    }
    update((d) => {
      d.bodyGoalKg = v > 0 ? fromDisplay(v) : undefined;
    });
    toast.push(v > 0 ? 'Goal saved' : 'Goal cleared');
  };
  const saveMeasure = () => {
    const v = Number(value);
    if (!Number.isFinite(v) || v <= 0) {
      toast.push('Enter a positive, finite measurement', 'bad');
      return;
    }
    addMeasure(key, v, day);
    setValue('');
    toast.push('Measurement saved', 'good');
  };
  const fromDisplay = (v: number) => (unit === 'lb' ? v * 0.45359237 : v);

  return (
    <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
      <div>
        <SectionHeader
          title="Bodyweight"
          subtitle={
            weights.length
              ? `${weights.length} entries · ${delta >= 0 ? '+' : ''}${delta.toFixed(1)} ${unit} since first`
              : 'Log your first weigh-in'
          }
        />
        <Card className="p-4">
          <div className="flex flex-wrap items-end gap-2">
            <label className="min-w-[120px] flex-1">
              <span className="label mb-1 block">Weight</span>
              <div className="relative">
                <NumericInput
                  className="input pr-10 text-right num"
                  unit={unit}
                  inputMode="decimal"
                  step="0.1"
                  value={weight}
                  onValueChange={setWeight}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-black text-mute">
                  {unit}
                </span>
              </div>
            </label>
            <label className="min-w-[120px] flex-1">
              <span className="label mb-1 block">Goal</span>
              <div className="relative">
                <NumericInput
                  className="input pr-10 text-right num"
                  unit={unit}
                  inputMode="decimal"
                  step="0.1"
                  placeholder="optional"
                  value={goal}
                  onValueChange={setGoal}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-black text-mute">
                  {unit}
                </span>
              </div>
            </label>
            <Btn
              variant="primary"
              onClick={saveWeight}
              icon={<Plus size={15} />}
            >
              Log
            </Btn>
            <Btn variant="soft" onClick={saveGoal}>
              Save goal
            </Btn>
          </div>
          {series.length > 1 && (
            <div className="mt-4">
              <LineChart
                data={series}
                height={170}
                format={(v) => `${v.toFixed(1)} ${unit}`}
              />
            </div>
          )}
          {data.bodyGoalKg != null && latest != null && (
            <div className="mt-3 rounded-xl bg-[var(--surface-2)] px-3 py-2 text-[11px] font-bold text-dim">
              {Math.abs(
                latest - toDisplayWeight(data.bodyGoalKg, unit),
              ).toFixed(1)}{' '}
              {unit} to goal ·{' '}
              {data.bodyGoalKg
                ? `${toDisplayWeight(data.bodyGoalKg, unit).toFixed(1)} ${unit}`
                : ''}
            </div>
          )}
          {weights.length > 0 && (
            <div className="mt-3 max-h-[220px] space-y-1 overflow-y-auto">
              {[...weights]
                .reverse()
                .slice(0, 20)
                .map((b) => (
                  <div
                    key={b.date}
                    className="flex items-center gap-2 rounded-lg bg-[var(--surface-2)] px-2.5 py-1.5"
                  >
                    <Scale size={12} className="text-mute" />
                    <span className="text-[11px] font-bold text-dim">
                      {fmtDate(b.date, {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                    <span className="num ml-auto text-xs font-black">
                      {toDisplayWeight(b.kg, unit).toFixed(1)} {unit}
                    </span>
                    <button
                      onClick={() => deleteBodyweight(b.date)}
                      className="grid h-6 w-6 place-items-center rounded text-mute hover:text-[var(--bad)]"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
            </div>
          )}
        </Card>

        <SectionHeader
          title="Measurements"
          subtitle="Track the tape, not just the scale"
        />
        <Card className="p-4">
          <div className="grid gap-2 sm:grid-cols-[1.2fr_1fr_1fr_auto]">
            <label>
              <span className="label mb-1 block">Site</span>
              <select
                className="input"
                value={key}
                onChange={(e) => setKey(e.target.value)}
              >
                {MEASURE_KEYS.map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="label mb-1 block">Value</span>
              <NumericInput
                className="input num"
                unit="cm"
                inputMode="decimal"
                step="0.1"
                placeholder="cm"
                value={value}
                onValueChange={setValue}
              />
            </label>
            <label>
              <span className="label mb-1 block">Date</span>
              <input
                className="input"
                type="date"
                value={day}
                onChange={(e) => setDay(e.target.value)}
              />
            </label>
            <div className="flex items-end">
              <Btn
                variant="primary"
                onClick={saveMeasure}
                icon={<Plus size={15} />}
              >
                Add
              </Btn>
            </div>
          </div>
          {measureSeries.length > 1 && (
            <div className="mt-3">
              <LineChart
                data={measureSeries}
                height={130}
                format={(v) => `${v.toFixed(1)}`}
              />
            </div>
          )}
          <div className="mt-3 grid grid-cols-2 gap-1.5">
            {MEASURE_KEYS.map((m) => {
              const latestM = latestMeasure(data.measures, m.key);
              const entries = data.measures.filter((x) => x.key === m.key);
              return (
                <div
                  key={m.key}
                  className="rounded-xl bg-[var(--surface-2)] px-2.5 py-2"
                >
                  <p className="text-[9px] font-black uppercase text-mute">
                    {m.label}
                  </p>
                  <p className="num text-sm font-black">
                    {latestM
                      ? `${latestM.value}${m.key === 'bodyfat' ? '%' : ' cm'}`
                      : '—'}
                  </p>
                  {entries.length > 0 && (
                    <button
                      onClick={() => deleteMeasure(latestM!.id)}
                      className="text-[9px] font-bold text-mute hover:text-[var(--bad)]"
                    >
                      remove latest
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <div>
        <SectionHeader title="Body snapshot" />
        <Card className="p-4">
          <BodyMap />
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-[var(--surface-2)] p-2.5">
              <p className="label">Weight</p>
              <p className="num text-lg font-black">
                {toDisplayWeight(data.profile.weightKg, unit).toFixed(1)} {unit}
              </p>
            </div>
            <div className="rounded-xl bg-[var(--surface-2)] p-2.5">
              <p className="label">Height</p>
              <p className="num text-lg font-black">
                {data.profile.heightCm} cm
              </p>
            </div>
            <div className="rounded-xl bg-[var(--surface-2)] p-2.5">
              <p className="label">Entries</p>
              <p className="num text-lg font-black">{data.measures.length}</p>
            </div>
            <div className="rounded-xl bg-[var(--surface-2)] p-2.5">
              <p className="label">Goal</p>
              <p className="num text-lg font-black">
                {data.bodyGoalKg
                  ? `${toDisplayWeight(data.bodyGoalKg, unit).toFixed(1)} ${unit}`
                  : '—'}
              </p>
            </div>
          </div>
        </Card>
        <SectionHeader title="Why measure?" />
        <Card className="p-4 text-xs font-semibold leading-relaxed text-dim">
          <p>
            The scale only tells part of the story. Waist, arm and thigh
            measurements show recomposition even when bodyweight is flat.
          </p>
          <p className="mt-2 text-mute">
            Measure at the same time of day, relaxed, with the tape snug but not
            compressing the skin.
          </p>
        </Card>
      </div>
    </div>
  );
}
