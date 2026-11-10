import {
  ArrowLeft,
  CalendarDays,
  Clock,
  Copy,
  Dumbbell,
  Flame,
  RotateCcw,
  Share2,
  Timer,
  Trash2,
  TrendingUp,
  Trophy,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArtThumb } from '../components/ExerciseArt';
import { ExerciseIcon, MuscleDot } from '../components/ExerciseTile';
import { formatLoggedSet } from '../components/recordLabels';
import { Btn, Card, Confirm, EmptyState, useToast } from '../components/ui';
import { useWorkoutStart } from '../components/WorkoutStart';
import { fmtDate, fmtDuration, fmtTime } from '../lib/date';
import { EXERCISES } from '../lib/exercises';
import {
  exerciseVolume,
  MUSCLE_LABEL,
  sessionPRCount,
  sessionSets,
  sessionVolume,
  setKindLabel,
  toDisplayWeight,
  volumeLabel,
} from '../lib/stats';
import { useStore } from '../lib/store';
import type { Exercise, LoggedExercise } from '../types';

export default function SessionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { requestStart, dialogs } = useWorkoutStart();
  const data = useStore((s) => s.data);
  const startFromSession = useStore((s) => s.startFromSession);
  const deleteSession = useStore((s) => s.deleteSession);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const session = data.sessions.find((s) => s.id === id);
  const unit = data.settings.unit;
  const prior = useMemo(
    () =>
      session
        ? data.sessions.filter((s) => new Date(s.date) < new Date(session.date))
        : [],
    [data.sessions, session],
  );

  if (!session) {
    return (
      <EmptyState
        icon={<CalendarDays size={24} />}
        title="Workout not found"
        body="It may have been deleted, or the link is incomplete."
        action={
          <Btn variant="primary" onClick={() => navigate('/history')}>
            Back to history
          </Btn>
        }
      />
    );
  }

  const d = new Date(session.date);
  const routine = data.routines.find((r) => r.id === session.routineId);
  const prs = sessionPRCount(session, prior);
  const volume = sessionVolume(session);
  const sets = sessionSets(session);

  const shareText = [
    `Gymmiie · ${session.name || routine?.name || 'Workout'}`,
    `${fmtDate(d, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · ${fmtDuration(session.durationSec)}`,
    `${session.exercises.length} exercises · ${sets} working sets · ${volumeLabel(volume, unit)} volume`,
    '',
    ...session.exercises.map(
      (e) =>
        `${e.name}\n${e.sets.map((s) => (s.kind === 'warmup' ? `  warm-up: ${formatLoggedSet(s, e, unit)}` : `  ${formatLoggedSet(s, e, unit)}`)).join('\n')}`,
    ),
  ].join('\n');

  const share = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: session.name || 'Gymmiie workout',
          text: shareText,
        });
      } else {
        await navigator.clipboard.writeText(shareText);
        toast.push('Workout copied to clipboard', 'good');
      }
    } catch {
      toast.push('Could not share', 'bad');
    }
  };

  const repeat = () => {
    requestStart(() => startFromSession(session.id));
  };

  const remove = () => {
    deleteSession(session.id);
    toast.push('Workout deleted');
    navigate('/history');
  };

  return (
    <div className="page-enter">
      <div className="mb-3 flex items-center gap-2">
        <button
          onClick={() => navigate(-1)}
          className="grid h-9 w-9 place-items-center rounded-full bg-[var(--surface-2)] text-dim"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="label">
            {fmtDate(d, {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </p>
          <h1 className="truncate text-xl font-black">
            {session.name ||
              routine?.name ||
              session.exercises[0]?.name ||
              'Workout'}
          </h1>
        </div>
        <button
          onClick={share}
          className="grid h-9 w-9 place-items-center rounded-full bg-[var(--surface-2)] text-dim"
          title="Share workout"
        >
          <Share2 size={17} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          {
            label: 'Duration',
            value: fmtDuration(session.durationSec),
            icon: <Clock size={14} />,
            sub: `started ${fmtTime(d)}`,
          },
          {
            label: 'Exercises',
            value: String(session.exercises.length),
            icon: <Dumbbell size={14} />,
            sub: `${session.exercises.reduce((n, e) => n + e.sets.length, 0)} total sets`,
          },
          {
            label: 'Working sets',
            value: String(sets),
            icon: <TrendingUp size={14} />,
            sub: 'excluding warm-ups',
          },
          {
            label: 'Volume',
            value: volumeLabel(volume, unit),
            icon: <Flame size={14} />,
            sub: prs ? `${prs} new PR${prs === 1 ? '' : 's'}` : 'no new PRs',
          },
        ].map((x) => (
          <Card key={x.label} className="p-4">
            <div className="flex items-center gap-1.5 text-mute">
              {x.icon}
              <span className="label">{x.label}</span>
            </div>
            <p className="num mt-1 text-xl font-black">{x.value}</p>
            <p className="mt-1 text-[10px] font-bold text-mute">{x.sub}</p>
          </Card>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Btn variant="primary" onClick={repeat} icon={<RotateCcw size={16} />}>
          Repeat workout
        </Btn>
        <Btn onClick={share} icon={<Copy size={15} />}>
          Copy / share
        </Btn>
        <Btn
          variant="ghost"
          onClick={() => setConfirmDelete(true)}
          icon={<Trash2 size={15} />}
        >
          Delete
        </Btn>
        {prs > 0 && (
          <span className="ml-auto flex items-center gap-1 rounded-full bg-[var(--warn)]/15 px-3 py-1.5 text-xs font-black text-[var(--warn)]">
            <Trophy size={14} /> {prs} PR{prs === 1 ? '' : 's'}
          </span>
        )}
      </div>

      {session.note && (
        <Card className="mt-4 p-4">
          <p className="label mb-1">Session note</p>
          <p className="text-sm font-semibold text-dim">{session.note}</p>
        </Card>
      )}

      <div className="mt-5 space-y-3">
        {session.exercises.map((ex) => (
          <Card key={ex.id} className="overflow-hidden">
            <div className="flex items-center gap-3 border-b border-line p-3.5">
              <ArtThumb
                slug={exerciseStub(ex).art}
                size={42}
                fallback={<ExerciseIcon ex={exerciseStub(ex)} size={42} />}
              />
              <div className="min-w-0 flex-1">
                <Link
                  to={`/library/${ex.id}`}
                  className="truncate text-sm font-black hover:text-[var(--accent)]"
                >
                  {ex.name}
                </Link>
                <p className="mt-0.5 flex items-center gap-1.5 text-[11px] font-bold text-mute">
                  <MuscleDot id={ex.primary} />{' '}
                  {MUSCLE_LABEL[ex.primary] ?? ex.primary} · {ex.sets.length}{' '}
                  sets
                </p>
              </div>
              <div className="text-right">
                <p className="num text-sm font-black">
                  {Math.round(
                    toDisplayWeight(exerciseVolume(ex), unit),
                  ).toLocaleString()}
                </p>
                <p className="text-[9px] font-black uppercase text-mute">
                  {unit} vol
                </p>
              </div>
            </div>
            <div className="divide-y divide-[var(--line)]">
              {ex.sets.map((s, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-2">
                  <span
                    className={`grid h-6 w-6 shrink-0 place-items-center rounded-lg text-[9px] font-black ${s.kind === 'warmup' ? 'bg-[var(--surface-3)] text-mute' : 'bg-[var(--surface-2)] text-dim'}`}
                  >
                    {i + 1}
                  </span>
                  <span
                    className={`w-14 shrink-0 text-[10px] font-black uppercase ${s.kind === 'warmup' ? 'text-mute' : 'text-dim'}`}
                  >
                    {setKindLabel(s.kind)}
                  </span>
                  <span className="num flex-1 text-sm font-extrabold">
                    {formatLoggedSet(s, ex, unit)}
                  </span>
                  {s.rpe != null && (
                    <span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[10px] font-black text-mute">
                      RPE {s.rpe}
                    </span>
                  )}
                  {s.note && (
                    <span className="max-w-[100px] truncate text-[10px] font-bold text-mute">
                      {s.note}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>

      <div className="mt-5 rounded-2xl border border-line bg-[var(--surface)] p-4">
        <div className="flex items-center gap-2 text-[11px] font-black text-mute">
          <Timer size={13} /> SESSION RECAP
        </div>
        <p className="mt-1 text-sm font-semibold text-dim">
          {session.exercises.length
            ? `You trained ${[...new Set(session.exercises.map((e) => MUSCLE_LABEL[e.primary] ?? e.primary))].join(', ')} for ${fmtDuration(session.durationSec)} and moved ${volumeLabel(volume, unit)}.`
            : 'No sets were recorded in this session.'}
        </p>
        {routine && (
          <Link
            to={`/routines/${routine.id}`}
            className="mt-2 inline-flex items-center gap-1 text-[11px] font-black text-[var(--accent)]"
          >
            <CalendarDays size={12} /> {routine.name} routine
          </Link>
        )}
      </div>

      {dialogs}
      <Confirm
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={remove}
        title="Delete workout?"
        body="This permanently removes the session from history and all progress calculations."
        confirmLabel="Delete workout"
      />
    </div>
  );
}

function exerciseStub(ex: LoggedExercise): Exercise {
  // Prefer the catalog entry so the art thumbnail can render.
  const cat = EXERCISES.find((c) => c.id === ex.id);
  if (cat) return cat;
  return {
    id: ex.id,
    name: ex.name,
    primary: ex.primary,
    secondary: [],
    equipment: '',
    difficulty: '',
    art: '',
    steps: [],
    mode: ex.mode ?? '',
    loadKind: ex.loadKind,
    aliases: [],
    kind: '',
  };
}
