import {
  Archive,
  ArrowLeft,
  BookOpen,
  ChevronRight,
  Dumbbell,
  History,
  NotebookPen,
  Plus,
  Star,
  Trash2,
  TrendingUp,
  Trophy,
  Zap,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ExerciseArt } from '../components/ExerciseArt';
import { ExerciseIcon, MuscleDot } from '../components/ExerciseTile';
import { useWorkoutStart } from '../components/WorkoutStart';
import {
  formatLoggedSet,
  recordLabel,
  recordValue,
} from '../components/recordLabels';
import {
  Btn,
  Card,
  Confirm,
  EmptyState,
  LineChart,
  SectionHeader,
  Sheet,
  useToast,
} from '../components/ui';
import { instructionsOf, stepsFor, tipsFor } from '../lib/art';
import { dateKey, relativeDay } from '../lib/date';
import { modeFor } from '../lib/exercises';
import {
  bestSetFor,
  exerciseHistory,
  MUSCLES,
  oneRmSeries,
  recordFor,
  toDisplayWeight,
} from '../lib/stats';
import { allExercises, useStore } from '../lib/store';

export default function ExerciseDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const data = useStore((s) => s.data);
  const toggleFavorite = useStore((s) => s.toggleFavorite);
  const toggleArchived = useStore((s) => s.toggleArchived);
  const deleteCustomExercise = useStore((s) => s.deleteCustomExercise);
  const saveNote = useStore((s) => s.saveNote);
  const { requestStart, dialogs } = useWorkoutStart();
  const addExerciseToSession = useStore((s) => s.addExerciseToSession);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState('');

  const all = useMemo(() => allExercises(), [data.customExercises]);
  const ex = all.find((e) => e.id === id);

  if (!ex) {
    return (
      <EmptyState
        icon={<BookOpen size={24} />}
        title="Exercise not found"
        body="It may have been deleted or the link is incomplete."
        action={
          <Btn variant="primary" onClick={() => navigate('/library')}>
            Back to library
          </Btn>
        }
      />
    );
  }

  const unit = data.settings.unit;
  const isCustom = data.customExercises.some((e) => e.id === ex.id);
  const isFav = !!data.favorites[ex.id];
  const isArchived = data.archived.includes(ex.id);
  const record = recordFor(data.sessions, ex.id, ex.name);
  const best = bestSetFor(data.sessions, ex.id);
  const history = exerciseHistory(data.sessions, ex.id).slice(0, 8);
  const series = oneRmSeries(data.sessions, ex.id);
  const notes = data.notes.filter((n) => n.exerciseId === ex.id).slice(0, 4);
  const related = all
    .filter(
      (e) =>
        e.id !== ex.id &&
        (e.primary === ex.primary || e.secondary.includes(ex.primary)),
    )
    .slice(0, 5);
  const muscleOptions = MUSCLES.filter(
    (m) => m.id === ex.primary || ex.secondary.includes(m.id),
  );
  const last = history[0];
  const instr = instructionsOf(ex.id);
  const steps = stepsFor(ex);
  const tips = tipsFor(ex);

  const start = () => {
    const state = useStore.getState();
    if (
      state.isCommitting ||
      state.persistenceStatus === 'error' ||
      state.persistenceStatus === 'conflict'
    ) {
      toast.push(
        'Resolve the storage issue before changing this workout',
        'bad',
      );
      return;
    }
    if (data.active) {
      if (data.active.pausedAt) {
        toast.push('Resume the workout before adding an exercise', 'bad');
        navigate('/session');
        return;
      }
      const alreadyAdded = data.active.exercises.some(
        (entry) => entry.id === ex.id,
      );
      addExerciseToSession(ex.id);
      toast.push(
        alreadyAdded
          ? `${ex.name} is already in this workout`
          : `${ex.name} added to current workout`,
      );
      navigate('/session');
      return;
    }
    requestStart(() => useStore.getState().startFromExercises([ex.id]));
  };

  const addNote = () => {
    if (!note.trim()) return;
    saveNote({
      exerciseId: ex.id,
      date: dateKey(),
      kind: 'note',
      text: note.trim(),
    });
    setNote('');
    setNoteOpen(false);
    toast.push('Note saved', 'good');
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
        <p className="label">Exercise</p>
        <div className="ml-auto flex gap-1">
          <button
            onClick={() => toggleFavorite(ex.id)}
            className={`grid h-9 w-9 place-items-center rounded-full ${isFav ? 'bg-[var(--warn)]/10 text-[var(--warn)]' : 'bg-[var(--surface-2)] text-mute'}`}
            title="Favourite"
          >
            <Star size={17} fill={isFav ? 'currentColor' : 'none'} />
          </button>
          <button
            onClick={() => {
              toggleArchived(ex.id);
              toast.push(isArchived ? 'Unarchived' : 'Archived');
            }}
            className={`grid h-9 w-9 place-items-center rounded-full ${isArchived ? 'bg-[var(--accent-soft)] text-[var(--accent)]' : 'bg-[var(--surface-2)] text-mute'}`}
            title="Archive"
          >
            <Archive size={16} />
          </button>
          {isCustom && (
            <button
              onClick={() => setConfirmDelete(true)}
              className="grid h-9 w-9 place-items-center rounded-full bg-[var(--surface-2)] text-mute hover:text-[var(--bad)]"
              title="Delete"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>

      <Card className="relative overflow-hidden p-5">
        <div className="pointer-events-none absolute -right-8 -top-12 h-40 w-40 rounded-full bg-[var(--accent)] opacity-[0.08] blur-2xl" />
        <ExerciseArt
          slug={ex.art}
          height={230}
          radius={18}
          fallback={<ExerciseIcon ex={ex} size={72} />}
        />
        <div className="mt-4 flex flex-wrap items-start gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-black leading-tight tracking-tight">
                {ex.name}
              </h1>
              {isCustom && (
                <span className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[10px] font-black text-[var(--accent)]">
                  custom
                </span>
              )}
              {isFav && (
                <Star
                  size={15}
                  className="text-[var(--warn)]"
                  fill="currentColor"
                />
              )}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              {muscleOptions.map((m) => (
                <span
                  key={m.id}
                  className="flex items-center gap-1 rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[10px] font-black text-dim"
                >
                  <MuscleDot id={m.id} size={5} /> {m.label}
                  {m.id === ex.primary ? ' · primary' : ''}
                </span>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-black uppercase tracking-wide text-mute">
              <span className="rounded-full border border-line px-2 py-0.5">
                {ex.equipment}
              </span>
              <span className="rounded-full border border-line px-2 py-0.5">
                {ex.difficulty}
              </span>
              {modeFor(ex) && (
                <span className="rounded-full border border-line px-2 py-0.5 text-[var(--accent)]">
                  {modeFor(ex)}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Btn
            variant="primary"
            onClick={start}
            icon={data.active ? <Plus size={16} /> : <Zap size={16} />}
          >
            {data.active ? 'Add to workout' : 'Start with this'}
          </Btn>
          <Btn
            variant="soft"
            onClick={() => setNoteOpen(true)}
            icon={<NotebookPen size={15} />}
          >
            Add note
          </Btn>
          {last && (
            <Btn
              variant="ghost"
              onClick={() => navigate(`/history/${last.session.id}`)}
              icon={<History size={15} />}
            >
              Last session
            </Btn>
          )}
        </div>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        <div>
          <SectionHeader
            title="How to perform it"
            subtitle={
              steps.length
                ? `${steps.length} steps · ${isCustom ? 'Your instructions' : 'Form guide'}`
                : 'Guide unavailable'
            }
          />
          {steps.length ? (
            <Card className="p-4">
              <ol className="space-y-3">
                {steps.map((s, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--accent-soft)] text-[11px] font-black text-[var(--accent)]">
                      {i + 1}
                    </span>
                    <p className="text-sm font-semibold leading-relaxed text-dim">
                      {s}
                    </p>
                  </li>
                ))}
              </ol>
              {tips.length > 0 && (
                <div className="mt-4 rounded-2xl bg-[var(--surface-2)] p-3">
                  <p className="text-[10px] font-black uppercase tracking-wider text-mute">
                    Tips
                  </p>
                  <ul className="mt-1.5 space-y-1.5">
                    {tips.map((t, i) => (
                      <li
                        key={i}
                        className="flex gap-2 text-xs font-semibold leading-relaxed text-dim"
                      >
                        <span className="text-[var(--accent)]">•</span> {t}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="mt-3 text-[10px] font-bold text-mute">
                {isCustom ? 'Your exercise instructions' : 'Form guide'}
                {instr?.url && (
                  <>
                    {' '}
                    ·{' '}
                    <a
                      href={instr.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[var(--accent)] underline"
                    >
                      Reference
                    </a>
                  </>
                )}
              </p>
            </Card>
          ) : (
            <EmptyState
              icon={<BookOpen size={22} />}
              title="No form notes yet"
              body="Form guidance is not available for this movement."
            />
          )}

          <SectionHeader
            title="Your history"
            subtitle={
              history.length
                ? `${history.length} recent sessions`
                : 'Nothing logged yet'
            }
            action={
              last ? (
                <Link
                  to={`/history/${last.session.id}`}
                  className="text-[11px] font-black text-[var(--accent)]"
                >
                  Open session
                </Link>
              ) : undefined
            }
          />
          {history.length ? (
            <Card className="divide-y divide-[var(--line)] overflow-hidden">
              {history.map((h) => {
                const sets = h.ex.sets.filter((s) => s.kind !== 'warmup');
                return (
                  <Link
                    key={h.session.id}
                    to={`/history/${h.session.id}`}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--surface-2)]"
                  >
                    <div className="w-12 shrink-0 text-center">
                      <p className="text-[9px] font-black uppercase text-mute">
                        {new Date(h.date).toLocaleDateString(undefined, {
                          month: 'short',
                        })}
                      </p>
                      <p className="num text-lg font-black leading-none">
                        {new Date(h.date).getDate()}
                      </p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-extrabold">
                        {sets.length} working sets
                        {sets.some((s) => s.kind !== 'normal')
                          ? ' · intensity techniques'
                          : ''}
                      </p>
                      <p className="truncate text-[11px] font-bold text-mute">
                        {sets
                          .slice(0, 4)
                          .map((set) => formatLoggedSet(set, h.ex, unit))
                          .join(' · ')}
                      </p>
                    </div>

                    <ChevronRight size={15} className="text-mute" />
                  </Link>
                );
              })}
            </Card>
          ) : (
            <EmptyState
              icon={<Dumbbell size={22} />}
              title="No history yet"
              body="Log this exercise in a workout to start tracking e1RM and PRs."
              action={
                <Btn variant="primary" size="sm" onClick={start}>
                  Train it now
                </Btn>
              }
            />
          )}

          {notes.length > 0 && (
            <>
              <SectionHeader
                title="Exercise notes"
                action={
                  <Link
                    to="/notes"
                    className="text-[11px] font-black text-[var(--accent)]"
                  >
                    Journal
                  </Link>
                }
              />
              <Card className="divide-y divide-[var(--line)] overflow-hidden">
                {notes.map((n) => (
                  <div key={n.id} className="px-4 py-3">
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase text-mute">
                      <NotebookPen size={11} /> {relativeDay(n.date)} · {n.kind}
                    </div>
                    <p className="mt-1 text-sm font-semibold text-dim">
                      {n.text}
                    </p>
                  </div>
                ))}
              </Card>
            </>
          )}
        </div>

        <div>
          <Card className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="label">Personal record</p>
                <p className="num mt-1 text-3xl font-black text-accent">
                  {record ? recordValue(record, unit) : '—'}
                </p>
              </div>
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--warn)]/10 text-[var(--warn)]">
                <Trophy size={20} />
              </div>
            </div>
            {record && (
              <p className="mt-2 text-xs font-bold text-mute">
                {recordLabel(record.kind)}
                {record.kind === 'weight' && record.oneRm > 0
                  ? ` · e1RM ${toDisplayWeight(record.oneRm, unit).toFixed(1)} ${unit}`
                  : ''}
              </p>
            )}
            {best && record?.kind === 'weight' ? (
              <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-bold text-mute">
                <span className="rounded-full bg-[var(--surface-2)] px-2 py-1">
                  Best set {toDisplayWeight(best.set.weight, unit).toFixed(1)}{' '}
                  {unit} × {best.set.reps}
                </span>
                <span className="rounded-full bg-[var(--surface-2)] px-2 py-1">
                  {relativeDay(dateKey(best.date))}
                </span>
                {best.set.rpe != null && (
                  <span className="rounded-full bg-[var(--surface-2)] px-2 py-1">
                    RPE {best.set.rpe}
                  </span>
                )}
              </div>
            ) : !record ? (
              <p className="mt-3 text-xs font-semibold text-mute">
                No records yet. Log a working set to start tracking.
              </p>
            ) : null}
          </Card>

          {record?.kind === 'weight' &&
            record.oneRm > 0 &&
            series.length > 1 && (
              <Card className="mt-3 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-black">Estimated 1RM</p>
                  <span className="flex items-center gap-1 text-[10px] font-black text-[var(--good)]">
                    <TrendingUp size={12} /> {series.length} points
                  </span>
                </div>
                <LineChart
                  data={series}
                  height={140}
                  format={(v) =>
                    `${toDisplayWeight(v, unit).toFixed(1)} ${unit}`
                  }
                />
              </Card>
            )}

          <SectionHeader title="Muscles" />
          <Card className="p-4">
            <div className="space-y-2">
              {muscleOptions.map((m) => (
                <div key={m.id} className="flex items-center gap-2">
                  <MuscleDot id={m.id} size={8} />
                  <span className="flex-1 text-xs font-extrabold">
                    {m.label}
                  </span>
                  <span className="text-[10px] font-black uppercase text-mute">
                    {m.id === ex.primary ? 'primary' : 'secondary'}
                  </span>
                </div>
              ))}
            </div>
          </Card>

          {related.length > 0 && (
            <>
              <SectionHeader title="Similar movements" />
              <Card className="divide-y divide-[var(--line)] overflow-hidden">
                {related.map((r) => (
                  <Link
                    key={r.id}
                    to={`/library/${r.id}`}
                    className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-[var(--surface-2)]"
                  >
                    <ExerciseIcon ex={r} size={32} />
                    <span className="min-w-0 flex-1 truncate text-xs font-extrabold">
                      {r.name}
                    </span>
                    <ChevronRight size={14} className="text-mute" />
                  </Link>
                ))}
              </Card>
            </>
          )}
        </div>
      </div>

      <Sheet
        open={noteOpen}
        onClose={() => setNoteOpen(false)}
        title={`Note on ${ex.name}`}
        footer={
          <div className="flex gap-2">
            <Btn className="flex-1" onClick={() => setNoteOpen(false)}>
              Cancel
            </Btn>
            <Btn
              className="flex-1"
              variant="primary"
              onClick={addNote}
              icon={<Plus size={15} />}
            >
              Save note
            </Btn>
          </div>
        }
      >
        <textarea
          autoFocus
          className="input min-h-[120px]"
          placeholder="Cues that worked, pain to watch, setup notes…"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <p className="mt-2 text-[11px] font-semibold text-mute">
          Attached to {ex.name} and visible in your journal.
        </p>
      </Sheet>

      {dialogs}
      <Confirm
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => {
          deleteCustomExercise(ex.id);
          toast.push('Exercise deleted');
          navigate('/library');
        }}
        title="Delete custom exercise?"
        body="It will be removed from your library and any routines using it. Logged history stays intact."
        confirmLabel="Delete exercise"
      />

      {ex.aliases.length > 0 && (
        <p className="mt-6 text-center text-[10px] font-bold text-mute">
          Also known as {ex.aliases.join(', ')}
        </p>
      )}
    </div>
  );
}
