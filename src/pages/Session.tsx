import clsx from 'clsx';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  BookOpen,
  Check,
  Dumbbell,
  Minus,
  MoreHorizontal,
  Pause,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  SkipForward,
  Timer,
  Trash2,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArtThumb, ExerciseArt } from '../components/ExerciseArt';
import ExercisePicker from '../components/ExercisePicker';
import { ExerciseIcon } from '../components/ExerciseTile';
import { recordLabel, recordValue } from '../components/recordLabels';
import {
  Btn,
  Card,
  Confirm,
  EmptyState,
  Field,
  Sheet,
  useToast,
} from '../components/ui';
import { instructionsOf, stepsFor, tipsFor } from '../lib/art';
import { beep, unlockAudio, vibrate } from '../lib/audio';
import { fmtClock, fmtDuration } from '../lib/date';
import { isCompletableSet, loadKindFor, modeFor } from '../lib/exercises';
import {
  activeElapsed,
  activeVolume,
  fromDisplayWeight,
  lastSetsFor,
  MUSCLE_LABEL,
  recordFor,
  setKindLabel,
  toDisplayWeight,
  volumeLabel,
  weightStep,
} from '../lib/stats';
import { allExercises, useStore } from '../lib/store';
import type { LoggedSet, SessionExercise, SessionSet } from '../types';

const KINDS = [
  'normal',
  'warmup',
  'drop',
  'failure',
  'restPause',
  'cluster',
] as const;
const KIND_SHORT: Record<string, string> = {
  normal: 'W',
  warmup: 'Wu',
  drop: 'D',
  failure: 'F',
  restPause: 'RP',
  cluster: 'Cl',
};

export default function Session() {
  const navigate = useNavigate();
  const toast = useToast();
  const data = useStore((s) => s.data);
  const status = useStore((s) => s.persistenceStatus);
  const isCommitting = useStore((s) => s.isCommitting);
  const actions = useStore.getState();
  const active = data.active;
  const [now, setNow] = useState(Date.now());
  const [picker, setPicker] = useState(false);
  const [swapUid, setSwapUid] = useState<string | null>(null);
  const [finishOpen, setFinishOpen] = useState(false);
  const [finishError, setFinishError] = useState('');
  const [finishing, setFinishing] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [nameOpen, setNameOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [removeUid, setRemoveUid] = useState<string | null>(null);
  const [howToOpen, setHowToOpen] = useState(false);
  const [detail, setDetail] = useState<{ uid: string; index: number } | null>(
    null,
  );
  const previousRest = useRef(0);
  useEffect(() => {
    if (!active) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [active?.id]);
  const restLeft =
    active?.restFrozen != null
      ? Math.max(0, Math.ceil(active.restFrozen))
      : active?.restEndsAt
        ? Math.max(0, Math.ceil((active.restEndsAt - now) / 1000))
        : 0;
  useEffect(() => {
    if (
      previousRest.current > 0 &&
      restLeft === 0 &&
      active?.restEndsAt &&
      now >= active.restEndsAt
    ) {
      if (data.settings.sound) beep(3);
      if (data.settings.vibrate) vibrate([120, 60, 120]);
      toast.push('Rest time is up. Start your next set when you’re ready.');
    }
    previousRest.current = restLeft;
  }, [
    restLeft,
    active?.restEndsAt,
    now,
    data.settings.sound,
    data.settings.vibrate,
    toast.push,
  ]);

  const current = active?.exercises[active.currentIndex];
  const catalog = useMemo(
    () =>
      current ? allExercises().find((ex) => ex.id === current.id) : undefined,
    [current?.id, data.customExercises],
  );
  const previousSets = useMemo(
    () => (current ? lastSetsFor(data.sessions, current.id) : []),
    [data.sessions, current?.id],
  );
  const record = useMemo(
    () => (current ? recordFor(data.sessions, current.id, current.name) : null),
    [data.sessions, current?.id, current?.name],
  );
  const doneSets = useMemo(
    () =>
      active?.exercises.reduce(
        (count, ex) => count + ex.sets.filter((set) => set.done).length,
        0,
      ) ?? 0,
    [active?.exercises],
  );
  const volume = useMemo(() => activeVolume(active), [active?.exercises]);

  if (!active)
    return (
      <EmptyState
        icon={<Dumbbell size={26} />}
        title="No workout in progress"
        body="Follow a routine or start an empty workout."
        action={
          <Btn variant="primary" onClick={() => navigate('/train')}>
            Start workout
          </Btn>
        }
      />
    );
  const unit = data.settings.unit;
  const paused = !!active.pausedAt;
  const readOnly = isCommitting || status === 'error' || status === 'conflict';
  const blocked = paused || readOnly;
  const mode = current ? modeFor(current) : '';
  const load = current ? loadKindFor(current) : undefined;
  const elapsed = activeElapsed(active);
  const totalSets = active.exercises.reduce(
    (count, ex) => count + ex.sets.length,
    0,
  );
  const guide = catalog ? instructionsOf(catalog.id) : undefined;
  const detailExercise = active.exercises.find((ex) => ex.uid === detail?.uid);
  const detailSet = detail ? detailExercise?.sets[detail.index] : undefined;
  const allDone =
    active.exercises.length > 0 &&
    active.exercises.every(
      (ex) => ex.sets.length > 0 && ex.sets.every((set) => set.done),
    );
  const openName = () => {
    setNameDraft(active.name ?? '');
    setNameOpen(true);
  };
  const complete = (uid: string, index: number) => {
    if (blocked) return;
    const exercise = active.exercises.find((entry) => entry.uid === uid);
    const set = exercise?.sets[index];
    if (
      exercise &&
      set &&
      !set.done &&
      !isCompletableSet(modeFor(exercise), set)
    ) {
      const tracking = modeFor(exercise);
      toast.push(
        tracking === 'time'
          ? 'Enter a duration before completing this set'
          : tracking === 'cardio'
            ? 'Enter a duration or distance before completing this set'
            : 'Enter repetitions before completing this set',
        'bad',
      );
      return;
    }
    const done = actions.toggleSet(uid, index);
    if (data.settings.sound || data.settings.vibrate) {
      void unlockAudio();
      if (data.settings.sound) beep(1, 620, 0.07);
      if (data.settings.vibrate) vibrate(40);
    }
    if (done && data.settings.autoAdvance) {
      const updated = useStore.getState().data.active;
      const position =
        updated?.exercises.findIndex((ex) => ex.uid === uid) ?? -1;
      const ex = updated?.exercises[position];
      if (
        ex?.sets.every((set) => set.done) &&
        position < updated!.exercises.length - 1
      )
        actions.setCurrentExercise(position + 1);
    }
  };
  const finish = async () => {
    if (finishing || readOnly) return;
    setFinishing(true);
    setFinishError('');
    try {
      const result = await actions.finishSession();
      if (result.status === 'error') {
        setFinishError(result.message);
        return;
      }
      setFinishOpen(false);
      if (result.status === 'saved') {
    toast.push('Workout saved', 'good');
        navigate(`/history/${result.id}`);
      } else {
        toast.push('No completed sets — session discarded');
        navigate('/train');
      }
    } catch (error) {
      setFinishError(
        error instanceof Error
          ? error.message
          : 'Could not save this workout. The session is kept.',
      );
    } finally {
      setFinishing(false);
    }
  };
  const setDetails = (patch: Partial<SessionSet>) => {
    if (detail && !blocked) actions.updateSet(detail.uid, detail.index, patch);
  };

  return (
    <div className="session-page">
      <div className="mb-3 flex items-center gap-2">
        <Btn
          size="icon"
          aria-label="Back to Today"
          onClick={() => navigate('/')}
        >
          <ArrowLeft size={18} />
        </Btn>
        <div className="min-w-0 flex-1">
          <button
            type="button"
            disabled={readOnly}
            onClick={openName}
            className="flex items-center gap-1.5 text-left"
          >
            <span className="truncate text-base font-black">
              {active.name || 'Freestyle session'}
            </span>
            <Pencil size={12} />
          </button>
          <p className="text-[11px] font-bold text-mute">
            {fmtDuration(elapsed)} · {doneSets}/{totalSets} sets ·{' '}
            {volumeLabel(volume, unit)}
          </p>
        </div>
        <Btn
          size="icon"
          disabled={readOnly}
          aria-label={paused ? 'Resume workout' : 'Pause workout'}
          onClick={actions.toggleSessionPause}
        >
          {paused ? <Play size={16} /> : <Pause size={16} />}
        </Btn>
        <Btn
          size="icon"
          aria-label="Session options"
          onClick={() => setMenuOpen(true)}
        >
          <MoreHorizontal size={18} />
        </Btn>
      </div>
      {paused && (
        <div
          role="status"
          className="mb-3 flex items-center gap-2 rounded-2xl bg-[var(--warn)]/10 px-4 py-3 text-xs font-black text-[var(--warn)]"
        >
          <Pause size={15} />
          Workout paused · resume to continue logging
        </div>
      )}
      {restLeft > 0 && !paused && (
        <Card className="mb-3 flex items-center gap-2 border-[var(--accent-line)] bg-[var(--accent-soft)] p-3">
          <Timer size={20} className="text-[var(--accent)]" />
          <div className="flex-1">
            <p className="text-xs font-black">Rest timer</p>
            <p
              role="timer"
              aria-live="off"
              className="num text-xl font-black text-[var(--accent)]"
            >
              {fmtClock(restLeft)}
            </p>
          </div>
          <Btn
            size="icon"
            disabled={readOnly}
            aria-label="Subtract 15 seconds rest"
            onClick={() => actions.nudgeRest(-15)}
          >
            <Minus size={15} />
          </Btn>
          <Btn
            size="icon"
            disabled={readOnly}
            aria-label="Add 15 seconds rest"
            onClick={() => actions.nudgeRest(15)}
          >
            <Plus size={15} />
          </Btn>
          <Btn
            size="sm"
            disabled={readOnly}
            onClick={actions.skipRest}
            icon={<SkipForward size={14} />}
          >
            Skip
          </Btn>
        </Card>
      )}
      <fieldset disabled={blocked} className="mb-3 min-w-0">
        <legend className="sr-only">Workout exercises</legend>
        <div className="scroll-x pb-1">
          {active.exercises.map((ex, index) => (
            <button
              key={ex.uid}
              type="button"
              aria-pressed={index === active.currentIndex}
              onClick={() => actions.setCurrentExercise(index)}
              className={clsx(
                'shrink-0 rounded-full border px-3 py-2 text-xs font-black disabled:opacity-60',
                index === active.currentIndex
                  ? 'border-[var(--accent-line)] bg-[var(--accent-soft)] text-[var(--accent)]'
                  : 'border-line bg-[var(--surface)] text-dim',
              )}
            >
              {ex.sets.every((set) => set.done) && ex.sets.length > 0
                ? '✓ '
                : `${index + 1}. `}
              {ex.name}
            </button>
          ))}
          <Btn
            size="sm"
            onClick={() => setPicker(true)}
            icon={<Plus size={14} />}
          >
            Add
          </Btn>
        </div>
      </fieldset>
      {allDone && (
        <p
          role="status"
          className="mb-3 rounded-xl bg-[var(--good-soft)] p-3 text-sm font-bold text-[var(--good)]"
        >
          All sets completed. Finish when the workout is ready to save.
        </p>
      )}
      {current ? (
        <Card className="overflow-hidden">
          <div className="flex items-start gap-3 border-b border-line p-4">
            {catalog && (
              <ArtThumb
                slug={catalog.art}
                size={44}
                fallback={<ExerciseIcon ex={catalog} size={44} />}
              />
            )}
            <div className="min-w-0 flex-1">
              <h1 className="text-base font-black">{current.name}</h1>
              <p className="mt-1 text-xs font-semibold text-mute">
                {MUSCLE_LABEL[current.primary] ?? current.primary}
                {load === 'assistance'
                  ? ' · assistance load'
                  : load === 'added'
                    ? ' · added load'
                    : ''}
              </p>
              {record && (
                <p className="mt-1 text-[10px] font-bold text-[var(--warn)]">
                  {recordLabel(record.kind)} {recordValue(record, unit)}
                  {record.kind === 'weight' && record.oneRm > 0
                    ? ` · e1RM ${toDisplayWeight(record.oneRm, unit).toFixed(1)} ${unit}`
                    : ''}
                </p>
              )}
            </div>
            <Btn
              size="icon"
              aria-label="Form guide"
              onClick={() => setHowToOpen(true)}
            >
              <BookOpen size={16} />
            </Btn>
          </div>
          {previousSets.length > 0 && (
            <div className="border-b border-line bg-[var(--surface-2)] px-4 py-2">
              <p className="label">Last time</p>
              <p className="mt-1 text-xs font-semibold text-dim">
                {previousSets
                  .slice(0, 5)
                  .map((set) => formatSet(set, current, unit))
                  .join(' · ')}
              </p>
            </div>
          )}
          <fieldset disabled={blocked} className="min-w-0 p-3 sm:p-4">
            <legend className="sr-only">Log sets for {current.name}</legend>
            <div className="mb-2 grid grid-cols-[40px_1fr_1fr_44px] items-center gap-2 text-[10px] font-black uppercase text-mute">
              <span>Set</span>
              <span>
                {mode === 'cardio'
                  ? 'Distance'
                  : mode === 'time'
                    ? 'Seconds'
                    : load === 'assistance'
                      ? 'Assistance'
                      : load === 'none'
                        ? 'Load'
                        : unit}
              </span>
              <span>
                {mode === 'cardio'
                  ? 'Seconds'
                  : mode === 'time'
                    ? 'Load'
                    : 'Reps'}
              </span>
              <span className="sr-only">Complete</span>
            </div>
            <div className="space-y-2">
              {current.sets.map((set, index) => (
                <div
                  key={index}
                  className={clsx(
                    'rounded-xl p-1',
                    set.done && 'bg-[var(--good-soft)]/50',
                  )}
                >
                  <div className="grid grid-cols-[40px_1fr_1fr_44px] items-center gap-2">
                    <button
                      type="button"
                      aria-label={`Set ${index + 1} details`}
                      onClick={() => setDetail({ uid: current.uid, index })}
                      className="grid min-h-11 place-items-center rounded-lg bg-[var(--surface-2)] text-[10px] font-black"
                    >
                      {index + 1}
                      <span>{KIND_SHORT[set.kind]}</span>
                    </button>
                    {mode === 'cardio' ? (
                      <>
                        <SetInput
                          label={`Set ${index + 1} distance`}
                          value={set.km ?? 0}
                          onChange={(km) =>
                            actions.updateSet(current.uid, index, { km })
                          }
                          step={0.1}
                          suffix="km"
                        />
                        <SetInput
                          label={`Set ${index + 1} seconds`}
                          value={set.sec ?? 0}
                          onChange={(sec) =>
                            actions.updateSet(current.uid, index, {
                              sec: Math.round(sec),
                            })
                          }
                          step={30}
                          suffix="s"
                        />
                      </>
                    ) : mode === 'time' ? (
                      <>
                        <SetInput
                          label={`Set ${index + 1} seconds`}
                          value={set.sec ?? 0}
                          onChange={(sec) =>
                            actions.updateSet(current.uid, index, {
                              sec: Math.round(sec),
                            })
                          }
                          step={5}
                          suffix="s"
                        />
                        {load === 'none' ? (
                          <span className="text-center text-xs font-bold text-mute">
                            No load
                          </span>
                        ) : (
                          <SetInput
                            label={`Set ${index + 1} weight`}
                            value={toDisplayWeight(set.weight, unit)}
                            onChange={(weight) =>
                              actions.updateSet(current.uid, index, {
                                weight: fromDisplayWeight(weight, unit),
                              })
                            }
                            step={weightStep(unit)}
                            suffix={unit}
                          />
                        )}
                      </>
                    ) : (
                      <>
                        {load === 'none' ? (
                          <span className="text-center text-xs font-bold text-mute">
                            No load
                          </span>
                        ) : (
                          <SetInput
                            label={`Set ${index + 1} weight`}
                            value={toDisplayWeight(set.weight, unit)}
                            onChange={(weight) =>
                              actions.updateSet(current.uid, index, {
                                weight: fromDisplayWeight(weight, unit),
                              })
                            }
                            step={weightStep(unit)}
                            suffix={unit}
                          />
                        )}
                        <SetInput
                          label={`Set ${index + 1} repetitions`}
                          value={set.reps}
                          onChange={(reps) =>
                            actions.updateSet(current.uid, index, {
                              reps: Math.round(reps),
                            })
                          }
                          step={1}
                          suffix="reps"
                        />
                      </>
                    )}
                    <button
                      type="button"
                      aria-label={
                        set.done
                          ? `Mark set ${index + 1} incomplete`
                          : `Complete set ${index + 1}`
                      }
                      aria-pressed={set.done}
                      onClick={() => complete(current.uid, index)}
                      className={clsx(
                        'grid h-11 w-11 place-items-center rounded-xl',
                        set.done
                          ? 'bg-[var(--good)] text-black'
                          : 'border border-strong bg-[var(--surface-2)] text-mute',
                      )}
                    >
                      <Check size={18} />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDetail({ uid: current.uid, index })}
                    className="ml-12 mt-1 min-h-8 text-left text-[11px] font-bold text-dim"
                  >
                    Set details
                    {set.rpe != null
                      ? ` · ${data.settings.effort === 'rir' ? `RIR ${10 - set.rpe}` : `RPE ${set.rpe}`}`
                      : ''}
                    {set.note ? ' · note' : ''}
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Btn
                size="sm"
                onClick={() => actions.addSet(current.uid)}
                icon={<Plus size={14} />}
              >
                Add set
              </Btn>
              {current.sets.length > 1 && (
                <Btn
                  size="sm"
                  onClick={() =>
                    actions.removeSet(current.uid, current.sets.length - 1)
                  }
                  icon={<Minus size={14} />}
                >
                  Remove last set
                </Btn>
              )}
              <Btn
                size="sm"
                onClick={() => setSwapUid(current.uid)}
                icon={<RotateCcw size={14} />}
              >
                Swap exercise
              </Btn>
              <Btn
                size="sm"
                variant="ghost"
                onClick={() => setRemoveUid(current.uid)}
                icon={<Trash2 size={14} />}
              >
                Remove exercise
              </Btn>
            </div>
            {restLeft <= 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
                <span className="label">Rest</span>
                {[60, 90, 120].map((seconds) => (
                  <Btn
                    key={seconds}
                    size="sm"
                    onClick={() => {
                      void unlockAudio();
                      actions.startRest(seconds);
                    }}
                  >
                    {seconds}s
                  </Btn>
                ))}
                <Btn
                  size="sm"
                  onClick={() => {
                    void unlockAudio();
                    actions.startRest(data.settings.restSec);
                  }}
                >
                  Default {data.settings.restSec}s
                </Btn>
              </div>
            )}
          </fieldset>
        </Card>
      ) : (
        <EmptyState
          icon={<Dumbbell size={24} />}
          title="No exercises yet"
          body="Add a movement to begin logging."
          action={
            <Btn disabled={blocked} onClick={() => setPicker(true)}>
              Add exercise
            </Btn>
          }
        />
      )}
      <div className="session-actions z-40 flex gap-2 rounded-2xl border border-line bg-[var(--bg)]/95 p-2 backdrop-blur">
        <Btn
          size="sm"
          className="min-h-11 flex-1 sm:text-sm"
          onClick={() => setMenuOpen(true)}
        >
          Session options
        </Btn>
        <Btn
          variant="primary"
          size="sm"
          className="min-h-11 flex-1 sm:text-sm"
          disabled={readOnly || finishing}
          onClick={() => {
            setFinishError('');
            setFinishOpen(true);
          }}
        >
          Finish workout
        </Btn>
      </div>
      <ExercisePicker
        open={picker && !blocked}
        onClose={() => setPicker(false)}
        exclude={active.exercises.map((ex) => ex.id)}
        onPick={(ex) => actions.addExerciseToSession(ex.id)}
      />
      <ExercisePicker
        open={!!swapUid && !blocked}
        onClose={() => setSwapUid(null)}
        title="Swap exercise"
        exclude={active.exercises.map((ex) => ex.id)}
        onPick={(ex) => {
          if (swapUid) actions.replaceSessionExercise(swapUid, ex.id);
          setSwapUid(null);
        }}
      />
      <Sheet
        open={howToOpen}
        onClose={() => setHowToOpen(false)}
        title={`Form guide · ${current?.name ?? 'Exercise'}`}
      >
        {catalog ? (
          <>
            <ExerciseArt
              slug={catalog.art}
              height={220}
              fallback={<ExerciseIcon ex={catalog} size={64} />}
            />
            {stepsFor(catalog).length ? (
              <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm font-semibold text-dim">
                {stepsFor(catalog).map((step, index) => (
                  <li key={index}>{step}</li>
                ))}
              </ol>
            ) : (
              <p className="mt-3 text-sm font-semibold text-mute">
                Verified form guidance is not available for this movement.
              </p>
            )}
            {tipsFor(catalog).length > 0 && (
              <ul className="mt-4 list-disc space-y-2 pl-5 text-xs text-dim">
                {tipsFor(catalog).map((tip, index) => (
                  <li key={index}>{tip}</li>
                ))}
              </ul>
            )}
            {catalog.kind === 'custom' && (
              <p className="mt-3 text-xs text-mute">
                Your exercise instructions
              </p>
            )}
            {guide && (
              <p className="mt-3 text-xs text-mute">
                Reviewed form guide
                {guide.url && (
                  <>
                    {' '}
                    ·{' '}
                    <a
                      href={guide.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[var(--accent)] underline"
                    >
                      Reference
                    </a>
                  </>
                )}
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-mute">
            No form guide is available for this saved exercise.
          </p>
        )}
      </Sheet>
      <Sheet
        open={!!detail && !!detailSet}
        onClose={() => setDetail(null)}
        title={`Set ${(detail?.index ?? 0) + 1} details`}
        footer={
          <Btn className="w-full" onClick={() => setDetail(null)}>
            Done
          </Btn>
        }
      >
        {detailSet && (
          <fieldset disabled={blocked} className="min-w-0 space-y-4">
            <Field label="Set type">
              <select
                className="input"
                value={detailSet.kind}
                onChange={(event) =>
                  setDetails({ kind: event.target.value as SessionSet['kind'] })
                }
              >
                {KINDS.map((kind) => (
                  <option key={kind} value={kind}>
                    {setKindLabel(kind)}
                  </option>
                ))}
              </select>
            </Field>
            {data.settings.effort !== 'off' ? (
              <Field
                label={
                  data.settings.effort === 'rir'
                    ? 'Reps in reserve (RIR)'
                    : 'Rate of perceived exertion (RPE)'
                }
              >
                <select
                  className="input"
                  value={
                    detailSet.rpe == null
                      ? ''
                      : data.settings.effort === 'rir'
                        ? 10 - detailSet.rpe
                        : detailSet.rpe
                  }
                  onChange={(event) =>
                    setDetails({
                      rpe:
                        event.target.value === ''
                          ? undefined
                          : data.settings.effort === 'rir'
                            ? 10 - Number(event.target.value)
                            : Number(event.target.value),
                    })
                  }
                >
                  <option value="">Not recorded</option>
                  {Array.from({ length: 9 }, (_, index) =>
                    data.settings.effort === 'rir' ? index / 2 : 6 + index / 2,
                  ).map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </Field>
            ) : (
              <p className="text-xs text-mute">
                Effort tracking is off. Enable RPE or RIR in Settings.
              </p>
            )}
            <Field label="Set note">
              <textarea
                className="input min-h-[100px]"
                value={detailSet.note ?? ''}
                onChange={(event) => setDetails({ note: event.target.value })}
                placeholder="Setup, cues, or how the set felt"
              />
            </Field>
          </fieldset>
        )}
      </Sheet>
      <Sheet
        open={finishOpen}
        onClose={() => setFinishOpen(false)}
        dismissible={!finishing}
        title="Finish workout?"
        footer={
          <div className="flex gap-2">
            <Btn
              disabled={finishing}
              className="flex-1"
              onClick={() => setFinishOpen(false)}
            >
              Keep going
            </Btn>
            <Btn
              disabled={finishing || readOnly}
              className="flex-1"
              variant="primary"
              onClick={() => void finish()}
            >
              {finishing
                ? 'Saving…'
                : doneSets
                  ? 'Save workout'
                  : 'Discard empty workout'}
            </Btn>
          </div>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Duration', value: fmtClock(elapsed) },
            { label: 'Completed sets', value: String(doneSets) },
            { label: 'Volume', value: volumeLabel(volume, unit) },
            {
              label: 'Exercises',
              value: String(
                active.exercises.filter((ex) => ex.sets.some((set) => set.done))
                  .length,
              ),
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl bg-[var(--surface-2)] p-3"
            >
              <p className="label">{stat.label}</p>
              <p className="mt-1 font-black">{stat.value}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-sm font-semibold text-dim">
          Only completed sets are saved. Unchecked sets and empty exercises are
          dropped.
        </p>
        {doneSets === 0 && (
          <p className="mt-3 text-sm font-bold text-[var(--warn)]">
            No sets have been completed. This empty workout will be discarded.
          </p>
        )}
        {finishError && (
          <p role="alert" className="mt-3 text-sm font-bold text-[var(--bad)]">
            {finishError}
          </p>
        )}
      </Sheet>
      <Confirm
        open={discardOpen}
        onClose={() => setDiscardOpen(false)}
        title="Discard workout?"
        body="Completed and unfinished sets in this workout will be lost."
        confirmLabel="Discard workout"
        onConfirm={() => {
          actions.discardSession();
          if (useStore.getState().data.active)
            throw new Error(
              'Resolve the storage issue before discarding this workout.',
            );
          setMenuOpen(false);
          navigate('/');
        }}
      />
      <Confirm
        open={!!removeUid}
        onClose={() => setRemoveUid(null)}
        title="Remove exercise?"
        body="All sets recorded for this exercise will be removed from this workout."
        confirmLabel="Remove exercise"
        onConfirm={() => {
          if (removeUid && !blocked) actions.removeSessionExercise(removeUid);
        }}
      />
      <Sheet
        open={nameOpen}
        onClose={() => setNameOpen(false)}
        title="Workout name"
        footer={
          <Btn
            disabled={readOnly}
            className="w-full"
            onClick={() => {
              actions.setSessionName(nameDraft.trim());
              setNameOpen(false);
            }}
          >
            Save name
          </Btn>
        }
      >
        <Field label="Workout name">
          <input
            autoFocus
            className="input"
            value={nameDraft}
            onChange={(event) => setNameDraft(event.target.value)}
          />
        </Field>
      </Sheet>
      <Sheet
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        title="Session options"
      >
        <div className="flex flex-wrap gap-2">
          <Btn disabled={readOnly} onClick={openName}>
            Rename workout
          </Btn>
          <Btn
            disabled={blocked}
            onClick={() => {
              setMenuOpen(false);
              setPicker(true);
            }}
          >
            Add exercise
          </Btn>
          <Btn
            disabled={readOnly}
            onClick={() => {
              actions.toggleSessionPause();
              setMenuOpen(false);
            }}
          >
            {paused ? 'Resume workout' : 'Pause workout'}
          </Btn>
          <Btn
            disabled={readOnly}
            variant="danger"
            onClick={() => setDiscardOpen(true)}
          >
            Discard workout…
          </Btn>
        </div>
        <h2 className="label mb-3 mt-5">Exercise order</h2>
        <div className="space-y-2">
          {active.exercises.map((ex, index) => (
            <div
              key={ex.uid}
              className="flex items-center gap-2 rounded-xl bg-[var(--surface-2)] p-2"
            >
              <span className="min-w-0 flex-1 text-xs font-black">
                {index + 1}. {ex.name}
              </span>
              <Btn
                size="icon"
                disabled={blocked || index === 0}
                aria-label={`Move ${ex.name} up`}
                onClick={() => actions.moveSessionExercise(index, index - 1)}
              >
                <ArrowUp size={15} />
              </Btn>
              <Btn
                size="icon"
                disabled={blocked || index === active.exercises.length - 1}
                aria-label={`Move ${ex.name} down`}
                onClick={() => actions.moveSessionExercise(index, index + 1)}
              >
                <ArrowDown size={15} />
              </Btn>
            </div>
          ))}
        </div>
      </Sheet>
    </div>
  );
}

function SetInput({
  label,
  value,
  onChange,
  step,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  step: number;
  suffix: string;
}) {
  const [text, setText] = useState<string | null>(null);
  return (
    <div className="relative">
      <input
        aria-label={label}
        type="number"
        inputMode="decimal"
        min={0}
        step={step}
        className="input min-h-11 !py-2 !pr-9 !text-right !text-sm font-black"
        value={text ?? String(Math.round(value * 10) / 10)}
        onFocus={(event) => event.target.select()}
        onChange={(event) => {
          const input = event.target.value;
          setText(input);
          const number = input === '' ? 0 : Number(input);
          if (Number.isFinite(number) && number >= 0) onChange(number);
        }}
        onBlur={() => setText(null)}
      />
      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-black uppercase text-mute">
        {suffix}
      </span>
    </div>
  );
}
function formatSet(
  set: Pick<LoggedSet, 'weight' | 'reps' | 'sec' | 'km'>,
  exercise: SessionExercise,
  unit: 'kg' | 'lb',
) {
  const mode = modeFor(exercise);
  if (mode === 'cardio') return `${set.km ?? 0} km · ${set.sec ?? 0}s`;
  if (mode === 'time')
    return `${set.sec ?? 0}s${set.weight > 0 ? ` · ${toDisplayWeight(set.weight, unit).toFixed(1)} ${unit}` : ''}`;
  return `${toDisplayWeight(set.weight, unit).toFixed(1)} ${unit} × ${set.reps}`;
}
