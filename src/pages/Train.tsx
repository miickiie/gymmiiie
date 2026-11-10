import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  CalendarDays,
  Dumbbell,
  Flame,
  HeartPulse,
  Play,
  Plus,
  RotateCcw,
  Sparkles,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import BodyMap from '../components/BodyMap';
import { ArtThumb } from '../components/ExerciseArt';
import ExercisePicker from '../components/ExercisePicker';
import { ExerciseIcon } from '../components/ExerciseTile';
import {
  Btn,
  Card,
  Chip,
  EmptyState,
  PageHeader,
  SectionHeader,
} from '../components/ui';
import { useWorkoutStart } from '../components/WorkoutStart';
import { defaultPicks } from '../lib/exercises';
import { MUSCLE_LABEL, routineForWeek } from '../lib/stats';
import { allExercises, useStore } from '../lib/store';
import type { Exercise } from '../types';

const WARMUP_IDS = [
  'jumping-jack',
  'cat-cow-stretch',
  'leg-swings-stretch',
  'band-pull-apart',
];
const CARDIO_IDS = ['treadmill-incline-walk', 'cycling', 'rowing'];
const isWarmup = (ex: Exercise) =>
  ex.kind === 'warmup' || WARMUP_IDS.includes(ex.id);

export default function Train() {
  const navigate = useNavigate();
  const data = useStore((s) => s.data);
  const { requestStart, dialogs } = useWorkoutStart();
  const [focusOpen, setFocusOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [reviewing, setReviewing] = useState(false);
  const [picks, setPicks] = useState<Exercise[]>([]);
  const [picker, setPicker] = useState(false);
  const [replaceId, setReplaceId] = useState<string | null>(null);
  const all = useMemo(() => allExercises(), [data.customExercises]);
  const today = routineForWeek(data);
  const uncovered = selected.filter(
    (muscle) => !picks.some((ex) => !isWarmup(ex) && ex.primary === muscle),
  );
  const toggle = (id: string) =>
    setSelected((values) =>
      values.includes(id)
        ? values.filter((value) => value !== id)
        : [...values, id],
    );
  const build = () => {
    setPicks(
      defaultPicks(
        all,
        data.sessions,
        selected,
        data.favorites,
        8,
        data.archived,
      ),
    );
    setReviewing(true);
  };
  const startList = (ids: string[], name?: string) =>
    requestStart(() => useStore.getState().startFromExercises(ids, name));
  const move = (from: number, to: number) =>
    setPicks((values) => {
      if (to < 0 || to >= values.length) return values;
      const next = [...values];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });

  return (
    <div className="page-enter">
      <PageHeader
        eyebrow="Train"
        title={reviewing ? 'Review your workout' : 'Start your workout'}
        subtitle={
          reviewing
            ? 'Arrange exercises, check your focus, then begin logging.'
            : 'Follow a routine or build as you go. Muscle suggestions are optional.'
        }
        action={
          <Link to="/library" className="btn btn-soft px-3 py-2 text-xs">
            <BookOpen size={16} />
            Exercises
          </Link>
        }
      />
      {data.active && (
        <Card className="mb-4 flex flex-wrap items-center gap-3 border-[var(--accent-line)] bg-[var(--accent-soft)] p-4">
          <Flame size={20} className="text-[var(--accent)]" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black">Workout in progress</p>
            <p className="text-xs font-semibold text-dim">
              {data.active.name || 'Freestyle session'} ·{' '}
              {data.active.exercises.length} exercises
            </p>
          </div>
          <Btn variant="primary" onClick={() => navigate('/session')}>
            Resume workout
          </Btn>
        </Card>
      )}

      {!reviewing ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <Link
              to="/routines"
              aria-label="Use a routine"
              className="card flex items-center gap-4 p-5 transition hover:border-strong"
            >
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
                <CalendarDays size={24} />
              </span>
              <div>
                <h2 className="text-lg font-black">Use a routine</h2>
                <p className="text-xs font-semibold text-dim">
                  Your saved plans and ready-made templates
                </p>
              </div>
            </Link>
            <button
              type="button"
              aria-label="Empty workout"
              onClick={() =>
                requestStart(() => useStore.getState().startEmpty())
              }
              className="card flex items-center gap-4 p-5 text-left transition hover:border-strong"
            >
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
                <Plus size={24} />
              </span>
              <div>
                <h2 className="text-lg font-black">Empty workout</h2>
                <p className="text-xs font-semibold text-dim">
                  Add exercises as you train
                </p>
              </div>
            </button>
          </div>
          <section className="mt-5">
            <SectionHeader
              title="Your routines"
              action={
                <Link
                  to="/routines"
                  className="text-xs font-black text-[var(--accent)]"
                >
                  Manage routines
                </Link>
              }
            />
            {data.routines.length ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {[
                  ...(today ? [today] : []),
                  ...data.routines.filter(
                    (routine) => routine.id !== today?.id,
                  ),
                ]
                  .slice(0, 6)
                  .map((routine) => (
                    <Card
                      key={routine.id}
                      className="flex items-center gap-3 p-4"
                    >
                      <div className="min-w-0 flex-1">
                        <Link
                          to={`/routines/${routine.id}`}
                          className="block truncate text-sm font-black"
                        >
                          {routine.name}
                        </Link>
                        <p className="text-xs font-semibold text-mute">
                          {routine.exerciseIds.length} exercises
                          {routine.id === today?.id ? ' · planned today' : ''}
                        </p>
                      </div>
                      <Btn
                        size="sm"
                        disabled={!routine.exerciseIds.length}
                        onClick={() =>
                          requestStart(() =>
                            useStore.getState().startFromRoutine(routine.id),
                          )
                        }
                        icon={<Play size={14} />}
                      >
                        Start
                      </Btn>
                    </Card>
                  ))}
              </div>
            ) : (
              <EmptyState
                icon={<CalendarDays size={22} />}
                title="No routines yet"
                body="Choose a template or create a routine to use again."
                action={
                  <Link
                    to="/routines"
                    className="btn btn-soft px-4 py-2 text-sm"
                  >
                    Browse routines
                  </Link>
                }
              />
            )}
          </section>
          <section className="mt-5">
            <button
              type="button"
              aria-label="Suggest by muscle"
              aria-expanded={focusOpen}
              aria-controls="muscle-suggestions"
              onClick={() => setFocusOpen((value) => !value)}
              className="card flex w-full items-center gap-3 p-4 text-left"
            >
              <Sparkles size={22} className="text-[var(--accent)]" />
              <div className="flex-1">
                <h2 className="text-base font-black">Suggest by muscle</h2>
                <p className="text-xs font-semibold text-dim">
                  Optional · choose a focus and review suggested movements
                </p>
              </div>
              <Plus size={18} className={focusOpen ? 'rotate-45' : ''} />
            </button>
            {focusOpen && (
              <Card className="mt-3 p-4">
                <div
                  id="muscle-suggestions"
                  className="grid gap-4 lg:grid-cols-[1.3fr_1fr]"
                >
                  <BodyMap selected={selected} onToggle={toggle} />
                  <div className="flex flex-col justify-center">
                    <p className="text-sm font-semibold text-dim">
                      Select muscles on the map. Review every suggestion before
                      starting.
                    </p>
                    <div className="my-4 flex flex-wrap gap-2">
                      {selected.map((muscle) => (
                        <Chip key={muscle} on onClick={() => toggle(muscle)}>
                          {MUSCLE_LABEL[muscle]} <X size={12} />
                        </Chip>
                      ))}
                    </div>
                    <Btn
                      variant="primary"
                      disabled={!selected.length}
                      onClick={build}
                    >
                      Review suggestions
                    </Btn>
                  </div>
                </div>
              </Card>
            )}
          </section>
          <div className="mt-4 flex flex-wrap gap-2">
            <Btn
              onClick={() => startList(WARMUP_IDS, 'Warm-up')}
              icon={<Flame size={16} />}
            >
              Warm-up session
            </Btn>
            <Btn
              onClick={() => startList(CARDIO_IDS, 'Cardio')}
              icon={<HeartPulse size={16} />}
            >
              Cardio session
            </Btn>
          </div>
        </>
      ) : (
        <>
          <Card className="mb-4 p-4">
            <div className="flex flex-wrap gap-2">
              {selected.map((muscle) => (
                <Chip key={muscle} on>
                  {MUSCLE_LABEL[muscle]}
                </Chip>
              ))}
            </div>
            <p className="mt-3 text-xs font-semibold text-dim">
              Suggestions are a starting point. Add, replace, remove, or reorder
              exercises for the workout you want.
            </p>
            {uncovered.length > 0 && (
              <p
                role="status"
                className="mt-3 text-sm font-bold text-[var(--warn)]"
              >
                No primary movement for{' '}
                {uncovered.map((muscle) => MUSCLE_LABEL[muscle]).join(', ')}.
                Add an exercise or change the focus.
              </p>
            )}
          </Card>
          <SectionHeader
            title={`${picks.length} exercises`}
            action={
              <Btn
                size="sm"
                onClick={() => setPicker(true)}
                icon={<Plus size={15} />}
              >
                Add exercise
              </Btn>
            }
          />
          {picks.length ? (
            <div className="space-y-2">
              {picks.map((ex, index) => (
                <Card key={ex.id} className="p-3">
                  <div className="flex items-center gap-3">
                    <span className="w-4 shrink-0 text-xs font-black text-mute">
                      {index + 1}
                    </span>
                    <ArtThumb
                      slug={ex.art}
                      size={40}
                      fallback={<ExerciseIcon ex={ex} size={40} />}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-black">{ex.name}</p>
                      <p className="text-xs font-semibold text-mute">
                        {MUSCLE_LABEL[ex.primary]} · {ex.equipment}
                      </p>
                      {isWarmup(ex) && (
                        <span className="mt-1 inline-block rounded-full bg-[var(--warn)]/15 px-2 py-0.5 text-[10px] font-black text-[var(--warn)]">
                          Warm-up / mobility
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap justify-end gap-1">
                    <Btn
                      size="icon"
                      disabled={index === 0}
                      aria-label={`Move ${ex.name} up`}
                      onClick={() => move(index, index - 1)}
                    >
                      <ArrowUp size={16} />
                    </Btn>
                    <Btn
                      size="icon"
                      disabled={index === picks.length - 1}
                      aria-label={`Move ${ex.name} down`}
                      onClick={() => move(index, index + 1)}
                    >
                      <ArrowDown size={16} />
                    </Btn>
                    <Btn
                      size="sm"
                      onClick={() => setReplaceId(ex.id)}
                      icon={<RotateCcw size={14} />}
                    >
                      Replace
                    </Btn>
                    <Btn
                      size="icon"
                      aria-label={`Remove ${ex.name}`}
                      onClick={() =>
                        setPicks((values) =>
                          values.filter((value) => value.id !== ex.id),
                        )
                      }
                    >
                      <X size={16} />
                    </Btn>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<Dumbbell size={22} />}
              title="No exercises selected"
              action={<Btn onClick={() => setPicker(true)}>Add exercise</Btn>}
            />
          )}
          <div className="sticky bottom-20 z-10 mt-4 flex gap-2 rounded-2xl border border-line bg-[var(--bg)]/95 p-2 backdrop-blur lg:bottom-4">
            <Btn onClick={() => setReviewing(false)}>Change focus</Btn>
            <Btn
              variant="primary"
              className="flex-1"
              disabled={!picks.length}
              onClick={() => startList(picks.map((ex) => ex.id))}
            >
              Start workout
            </Btn>
          </div>
        </>
      )}
      <ExercisePicker
        open={picker}
        onClose={() => setPicker(false)}
        exclude={picks.map((ex) => ex.id)}
        onPick={(ex) => setPicks((values) => [...values, ex])}
      />
      <ExercisePicker
        open={!!replaceId}
        onClose={() => setReplaceId(null)}
        title="Replace exercise"
        exclude={picks.map((ex) => ex.id)}
        onPick={(ex) => {
          setPicks((values) =>
            values.map((value) => (value.id === replaceId ? ex : value)),
          );
          setReplaceId(null);
        }}
      />
      {dialogs}
    </div>
  );
}
