import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, Check, Dumbbell, Flame, HeartPulse, Moon, Play, Plus, Search,
  Sparkles, Timer, UserRound, X, Zap,
} from 'lucide-react';
import type { Exercise } from '../types';
import { allExercises, useStore } from '../lib/store';
import { defaultPicks, modeOf, searchExercises } from '../lib/exercises';
import { MUSCLE_LABEL, routineForWeek } from '../lib/stats';
import { dateKey } from '../lib/date';
import { Btn, Card, Chip, Confirm, EmptyState, PageHeader, SectionHeader, useToast } from '../components/ui';
import BodyMap from '../components/BodyMap';
import ExercisePicker from '../components/ExercisePicker';
import { ExerciseIcon } from '../components/ExerciseTile';
import { ArtThumb } from '../components/ExerciseArt';

const WARMUP_IDS = ['jumping-jack', 'cat-cow-stretch', 'leg-swings-stretch', 'band-pull-apart'];
const CARDIO_IDS = ['treadmill-incline-walk', 'cycling', 'rowing'];

export default function Train() {
  const navigate = useNavigate();
  const toast = useToast();
  const data = useStore((s) => s.data);
  const startEmpty = useStore((s) => s.startEmpty);
  const addExerciseToSession = useStore((s) => s.addExerciseToSession);
  const startFromRoutine = useStore((s) => s.startFromRoutine);
  const cancelSession = useStore((s) => s.cancelSession);
  const [selected, setSelected] = useState<string[]>([]);
  const [phase, setPhase] = useState<'select' | 'review'>('select');
  const [picks, setPicks] = useState<Exercise[]>([]);
  const [q, setQ] = useState('');
  const [picker, setPicker] = useState(false);
  const [pending, setPending] = useState<{ run: () => void } | null>(null);

  const all = useMemo(() => allExercises(), [data.customExercises]);
  const today = routineForWeek(data, new Date().getDay());
  const active = data.active;

  const guarded = (run: () => void) => {
    if (data.active) setPending({ run });
    else run();
  };

  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const review = () => {
    if (!selected.length) { toast.push('Tap at least one muscle first', 'bad'); return; }
    setPicks(defaultPicks(all, data.sessions, selected, data.favorites, 8));
    setPhase('review');
  };

  const start = (list: Exercise[]) => {
    if (!list.length) { toast.push('Add at least one exercise', 'bad'); return; }
    guarded(() => {
      startEmpty();
      for (const p of list) addExerciseToSession(p.id);
      navigate('/session');
    });
  };

  const quick = (ids: string[], title: string) => {
    const list = ids.map((id) => all.find((e) => e.id === id)).filter((e): e is Exercise => !!e);
    guarded(() => {
      startEmpty();
      for (const p of list) addExerciseToSession(p.id);
      toast.push(`${title} ready`);
      navigate('/session');
    });
  };

  const startRoutine = (id: string) => guarded(() => { startFromRoutine(id); navigate('/session'); });

  const pool = useMemo(() => {
    const base = selected.length ? all.filter((e) => selected.includes(e.primary) || e.secondary.some((m) => selected.includes(m))) : all;
    return searchExercises(base.filter((e) => !picks.some((p) => p.id === e.id)), q).slice(0, 16);
  }, [all, selected, picks, q]);

  return (
    <div className="page-enter">
      <PageHeader
        eyebrow="Train"
        title={phase === 'select' ? 'Choose your focus' : 'Review your session'}
        subtitle={phase === 'select' ? 'Tap the muscles you want to hit. We’ll suggest movements and warm-ups.' : `${selected.length} muscle groups · ${picks.length} exercises picked`}
        action={phase === 'review' ? <Btn variant="ghost" size="sm" onClick={() => setPhase('select')} icon={<ArrowLeft size={15} />}>Focus</Btn> : undefined}
      />

      {active && (
        <Card className="mb-4 flex flex-wrap items-center gap-3 border-[var(--accent-line)] bg-[var(--accent-soft)] p-4">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--accent)] text-[#1a0d07]"><Flame size={18} /></div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black">A workout is already running</p>
            <p className="text-xs font-semibold text-dim">Resume it, or discard it before starting something new.</p>
          </div>
          <Btn variant="primary" size="sm" onClick={() => navigate('/session')}>Resume</Btn>
          <Btn variant="danger" size="sm" onClick={() => { cancelSession(); toast.push('Workout discarded'); }}>Discard</Btn>
        </Card>
      )}

      {phase === 'select' ? (
        <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
          <Card className="p-4 sm:p-5">
            <div className="rounded-2xl bg-[var(--surface-2)] p-3">
              <BodyMap selected={selected} onToggle={toggle} />
            </div>
            <p className="mt-3 text-center text-xs font-semibold text-mute">Tap front or back muscles to build your focus.</p>
            <div className="mt-3 flex min-h-[34px] flex-wrap gap-2">
              {selected.length ? selected.map((m) => (
                <Chip key={m} on onClick={() => toggle(m)}>{MUSCLE_LABEL[m] ?? m} <X size={11} /></Chip>
              )) : <span className="text-xs font-bold text-mute">No muscles selected yet.</span>}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Btn variant="primary" size="lg" className="flex-1" onClick={review} disabled={!selected.length} trailing={<ArrowRight size={17} />}>
                Review {selected.length ? `${selected.length} muscle${selected.length > 1 ? 's' : ''}` : 'session'}
              </Btn>
              <Btn size="lg" variant="soft" onClick={() => guarded(() => { startEmpty(); navigate('/session'); })} icon={<Plus size={16} />}>Empty</Btn>
            </div>
          </Card>

          <div>
            <SectionHeader title="Or start with" subtitle="Quick targeted sessions" />
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => quick(WARMUP_IDS, 'Warm-up')} className="card p-4 text-left transition hover:border-strong">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]"><Flame size={19} /></span>
                <p className="mt-3 text-sm font-black">Warm-up</p>
                <p className="text-[11px] font-bold text-mute">4 mobility & activation drills</p>
              </button>
              <button onClick={() => quick(CARDIO_IDS, 'Cardio')} className="card p-4 text-left transition hover:border-strong">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]"><HeartPulse size={19} /></span>
                <p className="mt-3 text-sm font-black">Cardio</p>
                <p className="text-[11px] font-bold text-mute">Treadmill, bike, rower</p>
              </button>
            </div>

            {today && (
              <>
                <SectionHeader title="Today’s plan" action={<Link to="/routines" className="text-[11px] font-black text-[var(--accent)]">Edit</Link>} />
                <Card className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--surface-2)] text-[var(--accent)]"><Moon size={18} /></div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-black">{today.name}</p>
                      <p className="text-[11px] font-bold text-mute">{today.exerciseIds.length} exercises · {Object.values(today.sets).reduce((a, b) => a + b, 0)} sets</p>
                    </div>
                    <Btn variant="primary" size="sm" onClick={() => startRoutine(today.id)}>Start</Btn>
                  </div>
                </Card>
              </>
            )}

            <SectionHeader title="Your routines" action={<Link to="/routines" className="text-[11px] font-black text-[var(--accent)]">All</Link>} />
            {data.routines.length ? (
              <Card className="divide-y divide-[var(--line)] overflow-hidden">
                {data.routines.slice(0, 4).map((r) => (
                  <button key={r.id} onClick={() => startRoutine(r.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-[var(--surface-2)]">
                    <div className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--surface-2)] text-[var(--accent)]"><Dumbbell size={16} /></div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-extrabold">{r.name}</p>
                      <p className="text-[11px] font-bold text-mute">{r.exerciseIds.length} exercises</p>
                    </div>
                    <Play size={14} className="text-mute" />
                  </button>
                ))}
              </Card>
            ) : (
              <EmptyState icon={<Sparkles size={22} />} title="No routines yet" body="Add a proven split in one tap from the routines page." action={<Link to="/routines"><Btn size="sm">Browse templates</Btn></Link>} />
            )}

            <div className="mt-4 rounded-2xl border border-line bg-[var(--surface)] p-4">
              <div className="flex items-center gap-2 text-[11px] font-black text-mute"><Timer size={13} /> REST TIMER SET TO {data.settings.restSec}s</div>
              <p className="mt-1 text-xs font-semibold text-dim">Completing a set starts the rest countdown automatically. Change it in settings.</p>
            </div>
          </div>
        </div>
      ) : (
        <div>
          <Card className="mb-4 p-4">
            <div className="flex flex-wrap items-center gap-2">
              {selected.map((m) => <Chip key={m} on onClick={() => toggle(m)}>{MUSCLE_LABEL[m] ?? m} <X size={11} /></Chip>)}
              <Chip onClick={() => setPicker(true)}><Plus size={12} /> Add exercise</Chip>
            </div>
          </Card>

          <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
            <div>
              <SectionHeader title={`${picks.length} exercises`} subtitle="Tap a row to remove · reorder happens during the workout" />
              {picks.length ? (
                <Card className="divide-y divide-[var(--line)] overflow-hidden">
                  {picks.map((ex, i) => (
                    <div key={ex.id} className="flex items-center gap-3 px-3 py-2.5">
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--surface-2)] text-[11px] font-black text-mute">{i + 1}</span>
                      <ArtThumb slug={ex.art} size={40} fallback={<ExerciseIcon ex={ex} size={40} />} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-extrabold">{ex.name}</p>
                        <p className="text-[11px] font-bold text-mute">{MUSCLE_LABEL[ex.primary] ?? ex.primary} · {ex.equipment}{modeOf(ex.id) ? ` · ${modeOf(ex.id)}` : ''}</p>
                      </div>
                      <button onClick={() => setPicks((p) => p.filter((x) => x.id !== ex.id))} className="grid h-8 w-8 place-items-center rounded-full text-mute hover:bg-[var(--surface-3)] hover:text-[var(--bad)]"><X size={16} /></button>
                    </div>
                  ))}
                </Card>
              ) : (
                <EmptyState icon={<Dumbbell size={22} />} title="No exercises selected" body="Add a movement from the library to begin." action={<Btn variant="primary" size="sm" onClick={() => setPicker(true)}>Add exercise</Btn>} />
              )}
            </div>

            <div>
              <SectionHeader title="Add more" subtitle="Matched to your focus" />
              <div className="relative mb-2">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-mute" />
                <input className="input pl-9" placeholder="Search exercises…" value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
              <Card className="max-h-[420px] divide-y divide-[var(--line)] overflow-y-auto">
                {pool.map((ex) => (
                  <button key={ex.id} onClick={() => setPicks((p) => [...p, ex])} className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-[var(--surface-2)]">
                    <ExerciseIcon ex={ex} size={32} />
                    <span className="min-w-0 flex-1 truncate text-xs font-extrabold">{ex.name}</span>
                    <Plus size={14} className="text-[var(--accent)]" />
                  </button>
                ))}
                {!pool.length && <p className="px-3 py-6 text-center text-xs font-semibold text-mute">No more matches. Try the full library.</p>}
              </Card>
              <Btn className="mt-2 w-full" onClick={() => setPicker(true)} icon={<Search size={15} />}>Browse all 466</Btn>
            </div>
          </div>

          <div className="sticky bottom-20 z-10 mt-4 flex gap-2 rounded-2xl border border-line bg-[var(--bg)]/90 p-2 backdrop-blur lg:bottom-4">
            <Btn className="flex-1" onClick={() => setPhase('select')} icon={<ArrowLeft size={16} />}>Back</Btn>
            <Btn variant="primary" className="flex-[2]" onClick={() => start(picks)} disabled={!picks.length} icon={<Zap size={17} />}>
              Start {picks.length} exercise{picks.length === 1 ? '' : 's'}
            </Btn>
          </div>
        </div>
      )}

      <ExercisePicker open={picker} onClose={() => setPicker(false)} onPick={(ex) => setPicks((p) => [...p, ex])} exclude={picks.map((p) => p.id)} />

      <Confirm
        open={!!pending}
        onClose={() => setPending(null)}
        onConfirm={() => { const p = pending; setPending(null); if (p) { cancelSession(); p.run(); } }}
        title="Replace active workout?"
        body="Starting a new session will discard the workout currently in progress."
        confirmLabel="Discard & start"
      />

      <p className="mt-6 flex items-center justify-center gap-2 text-[11px] font-bold text-mute">
        <UserRound size={12} /> {selected.length ? `Focus: ${selected.map((m) => MUSCLE_LABEL[m]).join(', ')}` : 'No focus selected'} · {dateKey()}
      </p>
    </div>
  );
}
