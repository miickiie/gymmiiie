import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import {
  AlarmClock, ArrowDown, ArrowLeft, ArrowUp, BookOpen, Check, ChevronRight, Dumbbell, Flame, Link2,
  Minus, MoreHorizontal, Pause, Pencil, Play, Plus, RotateCcw, SkipForward, Timer, Trash2, X, Zap,
} from 'lucide-react';
import type { SessionSet } from '../types';
import { useStore } from '../lib/store';
import {
  activeElapsed, activeSetsDone, activeVolume, fromDisplayWeight, lastSetsFor, oneRm, recordFor,
  setKindLabel, toDisplayWeight, volumeLabel, weightStep, MUSCLE_LABEL,
} from '../lib/stats';
import { modeOf, EXERCISES } from '../lib/exercises';
import { dateKey, fmtClock, fmtDuration } from '../lib/date';
import { beep, unlockAudio, vibrate } from '../lib/audio';
import {
  Btn, Card, Confirm, EmptyState, Sheet, useToast,
} from '../components/ui';
import ExercisePicker from '../components/ExercisePicker';
import { ExerciseIcon, MuscleDot } from '../components/ExerciseTile';
import { ArtThumb, ExerciseArt } from '../components/ExerciseArt';
import { instructionsOf, stepsFor, tipsFor } from '../lib/art';

const KINDS = ['normal', 'warmup', 'drop', 'failure', 'restPause', 'cluster'] as const;
const KIND_SHORT: Record<string, string> = { normal: 'W', warmup: 'Wu', drop: 'D', failure: 'F', restPause: 'RP', cluster: 'Cl' };

function restSeconds(active: ReturnType<typeof useStore.getState>['data']['active'], now: number) {
  if (!active) return 0;
  if (active.restFrozen != null) return Math.max(0, Math.ceil(active.restFrozen));
  if (active.restEndsAt) return Math.max(0, Math.ceil((active.restEndsAt - now) / 1000));
  return 0;
}

export default function Session() {
  const navigate = useNavigate();
  const toast = useToast();
  const data = useStore((s) => s.data);
  const updateSet = useStore((s) => s.updateSet);
  const toggleSet = useStore((s) => s.toggleSet);
  const addSet = useStore((s) => s.addSet);
  const removeSet = useStore((s) => s.removeSet);
  const addExerciseToSession = useStore((s) => s.addExerciseToSession);
  const removeSessionExercise = useStore((s) => s.removeSessionExercise);
  const replaceSessionExercise = useStore((s) => s.replaceSessionExercise);
  const setCurrentExercise = useStore((s) => s.setCurrentExercise);
  const toggleSessionLink = useStore((s) => s.toggleSessionLink);
  const moveSessionExercise = useStore((s) => s.moveSessionExercise);
  const setSessionName = useStore((s) => s.setSessionName);
  const toggleSessionPause = useStore((s) => s.toggleSessionPause);
  const startRest = useStore((s) => s.startRest);
  const skipRest = useStore((s) => s.skipRest);
  const nudgeRest = useStore((s) => s.nudgeRest);
  const finishSession = useStore((s) => s.finishSession);
  const discardSession = useStore((s) => s.discardSession);

  const active = data.active;
  const [now, setNow] = useState(Date.now());
  const [picker, setPicker] = useState(false);
  const [swapUid, setSwapUid] = useState<string | null>(null);
  const [finishOpen, setFinishOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [nameOpen, setNameOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [removeUid, setRemoveUid] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [howToOpen, setHowToOpen] = useState(false);
  const prevRest = useRef<number | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const restLeft = restSeconds(active, now);
  useEffect(() => {
    if (prevRest.current != null && prevRest.current > 0 && restLeft <= 0) {
      if (data.settings.sound) beep(3);
      if (data.settings.vibrate) vibrate([120, 60, 120]);
    }
    prevRest.current = restLeft;
  }, [restLeft, data.settings.sound, data.settings.vibrate]);

  if (!active) {
    return (
      <div className="page-enter">
        <EmptyState
          icon={<Dumbbell size={26} />}
          title="No workout in progress"
          body="Choose a focus, follow a routine, or start an empty session."
          action={<div className="flex gap-2"><Btn variant="primary" onClick={() => navigate('/train')}>Train</Btn><Btn onClick={() => navigate('/')}>Today</Btn></div>}
        />
      </div>
    );
  }

  const current = active.exercises[active.currentIndex];
  const unit = data.settings.unit;
  const step = weightStep(unit);
  const elapsed = activeElapsed(active);
  const doneSets = activeSetsDone(active);
  const totalSets = active.exercises.reduce((n, e) => n + e.sets.length, 0);
  const volume = activeVolume(active);
  const paused = !!active.pausedAt;
  const restTotal = active.restTotal ?? data.settings.restSec;
  const restPct = restTotal > 0 ? Math.max(0, Math.min(100, (restLeft / restTotal) * 100)) : 0;
  const lastSets = current ? lastSetsFor(data.sessions, current.id) : [];
  const record = current ? recordFor(data.sessions, current.id, current.name) : null;
  const allDone = active.exercises.length > 0 && active.exercises.every((e) => e.sets.length > 0 && e.sets.every((s) => s.done));

  const doFinish = () => {
    finishSession();
    const id = useStore.getState().lastFinishedId;
    setFinishOpen(false);
    if (id) {
      toast.push('Workout saved', 'good');
      navigate(`/history/${id}`);
    } else {
      toast.push('No completed sets — session discarded', 'bad');
      navigate('/train');
    }
  };

  const doDiscard = () => {
    discardSession();
    setDiscardOpen(false);
    setMenuOpen(false);
    toast.push('Workout discarded');
    navigate('/');
  };

  const completeSet = (uid: string, index: number) => {
    const becomingDone = toggleSet(uid, index);
    if (data.settings.sound || data.settings.vibrate) {
      void unlockAudio();
      if (data.settings.sound) beep(1, 620, 0.07);
      if (data.settings.vibrate) vibrate(40);
    }
    if (becomingDone && data.settings.autoAdvance) {
      const updated = useStore.getState().data.active;
      const ex = updated?.exercises.find((e) => e.uid === uid);
      if (ex && ex.sets.length > 0 && ex.sets.every((s) => s.done)) {
        const idx = updated!.exercises.findIndex((e) => e.uid === uid);
        if (idx >= 0 && idx < updated!.exercises.length - 1) setCurrentExercise(idx + 1);
      }
    }
  };

  const cycleKind = (set: SessionSet, uid: string, index: number) => {
    const next = KINDS[(KINDS.indexOf(set.kind) + 1) % KINDS.length];
    updateSet(uid, index, { kind: next });
  };

  const openName = () => {
    setNameDraft(active.name ?? '');
    setNameOpen(true);
  };

  return (
    <div className="page-enter">
      {/* session header */}
      <div className="mb-3 flex items-center gap-2">
        <button onClick={() => navigate('/')} className="grid h-9 w-9 place-items-center rounded-full bg-[var(--surface-2)] text-dim"><ArrowLeft size={18} /></button>
        <div className="min-w-0 flex-1">
          <button onClick={openName} className="flex items-center gap-1.5 text-left">
            <span className="truncate text-base font-black">{active.name || 'Freestyle session'}</span>
            <Pencil size={12} className="shrink-0 text-mute" />
          </button>
          <p className="text-[11px] font-bold text-mute">{fmtDuration(elapsed)} elapsed · {doneSets}/{totalSets} sets · {volumeLabel(volume, unit)} volume</p>
        </div>
        <button onClick={toggleSessionPause} className={clsx('grid h-9 w-9 place-items-center rounded-full', paused ? 'bg-[var(--accent)] text-[#1a0d07]' : 'bg-[var(--surface-2)] text-dim')}>
          {paused ? <Play size={16} /> : <Pause size={16} />}
        </button>
        <button onClick={() => setMenuOpen(true)} className="grid h-9 w-9 place-items-center rounded-full bg-[var(--surface-2)] text-dim"><MoreHorizontal size={18} /></button>
      </div>

      {paused && (
        <div className="mb-3 flex items-center gap-2 rounded-2xl border border-[var(--warn)]/30 bg-[var(--warn)]/10 px-4 py-2.5 text-xs font-black text-[var(--warn)]">
          <Pause size={14} /> Workout paused · timer frozen
        </div>
      )}

      {/* rest timer */}
      {restLeft > 0 && !paused && (
        <div className="mb-3 overflow-hidden rounded-2xl border border-[var(--accent-line)] bg-[var(--accent-soft)]">
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="relative grid h-11 w-11 place-items-center rounded-full bg-[var(--surface)]">
              <span className="num text-sm font-black text-[var(--accent)]">{restLeft}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-black text-[var(--accent)]">Resting · {Math.ceil(restLeft / 60)} min</p>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--surface-3)]">
                <div className="h-full rounded-full bg-[var(--accent)] transition-all duration-500" style={{ width: `${restPct}%` }} />
              </div>
            </div>
            <button onClick={() => nudgeRest(-15)} className="grid h-8 w-8 place-items-center rounded-full bg-[var(--surface)] text-mute"><Minus size={14} /></button>
            <button onClick={() => nudgeRest(15)} className="grid h-8 w-8 place-items-center rounded-full bg-[var(--surface)] text-mute"><Plus size={14} /></button>
            <Btn variant="primary" size="sm" onClick={skipRest} icon={<SkipForward size={14} />}>Skip</Btn>
          </div>
        </div>
      )}

      {/* exercise tabs */}
      <div className="scroll-x mb-3 pb-1">
        {active.exercises.map((e, i) => {
          const done = e.sets.length > 0 && e.sets.every((s) => s.done);
          return (
            <button
              key={e.uid}
              onClick={() => setCurrentExercise(i)}
              className={clsx(
                'flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-xs font-extrabold transition',
                i === active.currentIndex ? 'border-[var(--accent-line)] bg-[var(--accent-soft)] text-[var(--accent)]' : done ? 'border-transparent bg-[var(--good-soft)] text-[var(--good)]' : 'border-line bg-[var(--surface)] text-dim',
              )}
            >
              {done ? <Check size={12} strokeWidth={3} /> : <span className="grid h-4 w-4 place-items-center rounded-full bg-[var(--surface-3)] text-[9px]">{i + 1}</span>}
              <span className="max-w-[130px] truncate">{e.name}</span>
              {e.linkedNext && <Link2 size={11} />}
            </button>
          );
        })}
        <button onClick={() => setPicker(true)} className="flex shrink-0 items-center gap-1 rounded-full border border-dashed border-line px-3 py-2 text-xs font-extrabold text-mute"><Plus size={13} /> Add</button>
      </div>

      {allDone && (
        <div className="mb-3 flex items-center gap-3 rounded-2xl border border-[var(--good)]/30 bg-[var(--good-soft)] px-4 py-3">
          <Zap size={18} className="text-[var(--good)]" />
          <p className="flex-1 text-xs font-black text-[var(--good)]">Every exercise has completed sets. Nice work.</p>
          <Btn variant="primary" size="sm" onClick={() => setFinishOpen(true)}>Finish</Btn>
        </div>
      )}

      {current ? (
        <Card className="overflow-hidden">
          <div className="flex items-start gap-3 border-b border-line p-4">
            <ArtThumb slug={allExercisesForCurrent(current).art} size={46} fallback={<ExerciseIcon ex={allExercisesForCurrent(current)} size={46} />} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <h2 className="truncate text-base font-black">{current.name}</h2>
                {current.swappedFrom && <span className="rounded-full bg-[var(--surface-2)] px-1.5 py-0.5 text-[9px] font-black text-mute">swapped</span>}
              </div>
              <p className="mt-0.5 flex items-center gap-1.5 text-[11px] font-bold text-mute">
                <MuscleDot id={current.primary} /> {MUSCLE_LABEL[current.primary] ?? current.primary}
                {modeOf(current.id) && <span className="rounded-full bg-[var(--surface-2)] px-1.5 py-0.5 text-[9px] font-black uppercase">{modeOf(current.id)}</span>}
              </p>
              {record && (
                <p className="mt-0.5 text-[10px] font-bold text-[var(--warn)]">Best e1RM {toDisplayWeight(record.oneRm, unit).toFixed(1)} {unit}</p>
              )}
            </div>
            <div className="flex gap-1">
              <button onClick={() => setHowToOpen(true)} className="grid h-8 w-8 place-items-center rounded-full text-mute hover:bg-[var(--surface-2)] hover:text-[var(--accent)]" title="Form guide"><BookOpen size={15} /></button>
              <button onClick={() => setSwapUid(current.uid)} className="grid h-8 w-8 place-items-center rounded-full text-mute hover:bg-[var(--surface-2)]" title="Swap exercise"><RotateCcw size={15} /></button>
              <button onClick={() => setRemoveUid(current.uid)} className="grid h-8 w-8 place-items-center rounded-full text-mute hover:bg-[var(--surface-2)] hover:text-[var(--bad)]" title="Remove exercise"><Trash2 size={15} /></button>
            </div>
          </div>

          {lastSets.length > 0 && (
            <div className="border-b border-line bg-[var(--surface-2)]/50 px-4 py-2">
              <p className="text-[10px] font-black uppercase tracking-wider text-mute">Last time</p>
              <p className="mt-0.5 truncate text-[11px] font-bold text-dim">
                {lastSets.slice(0, 5).map((s) => modeOf(current.id) === 'cardio' ? `${s.km ?? 0} km · ${fmtDuration(s.sec ?? 0)}` : modeOf(current.id) === 'time' ? `${s.sec ?? 0}s` : `${toDisplayWeight(s.weight, unit).toFixed(1)} × ${s.reps}`).join(' · ')}
              </p>
            </div>
          )}

          <div className="p-3 sm:p-4">
            <div className="mb-1.5 grid grid-cols-[34px_1fr_1fr_44px] items-center gap-2 px-1 text-[9px] font-black uppercase tracking-wider text-mute sm:grid-cols-[34px_1fr_1fr_1fr_44px]">
              <span>Set</span>
              {modeOf(current.id) === 'cardio' ? <><span>Distance</span><span>Time</span></> : modeOf(current.id) === 'time' ? <><span>Seconds</span><span>Weight</span></> : <><span>{unit}</span><span>Reps</span></>}
              {data.settings.effort !== 'off' ? <span className="hidden sm:block">{data.settings.effort.toUpperCase()}</span> : <span className="hidden sm:block">Note</span>}
              <span />
            </div>

            <div className="space-y-1.5">
              {current.sets.map((set, i) => (
                <div key={i} className={clsx('grid grid-cols-[34px_1fr_1fr_44px] items-center gap-2 rounded-xl px-1 py-1 sm:grid-cols-[34px_1fr_1fr_1fr_44px]', set.done && 'bg-[var(--good-soft)]/40')}>
                  <button
                    onClick={() => cycleKind(set, current.uid, i)}
                    className={clsx(
                      'grid h-7 w-7 place-items-center rounded-lg text-[9px] font-black uppercase',
                      set.kind === 'normal' ? 'bg-[var(--surface-2)] text-mute' :
                      set.kind === 'warmup' ? 'bg-[var(--surface-3)] text-dim' :
                      set.kind === 'failure' ? 'bg-[var(--bad-soft)] text-[var(--bad)]' :
                      'bg-[var(--warn)]/15 text-[var(--warn)]',
                    )}
                    title="Change set type"
                  >{KIND_SHORT[set.kind]}</button>

                  {modeOf(current.id) === 'cardio' ? (
                    <>
                      <SetInput value={set.km ?? 0} onChange={(v) => updateSet(current.uid, i, { km: v })} step={0.1} suffix="km" />
                      <SetInput value={set.sec ?? 0} onChange={(v) => updateSet(current.uid, i, { sec: Math.round(v) })} step={30} suffix="s" />
                    </>
                  ) : modeOf(current.id) === 'time' ? (
                    <>
                      <SetInput value={set.sec ?? 0} onChange={(v) => updateSet(current.uid, i, { sec: Math.round(v) })} step={5} suffix="s" />
                      <SetInput value={set.weight > 0 ? toDisplayWeight(set.weight, unit) : 0} onChange={(v) => updateSet(current.uid, i, { weight: fromDisplayWeight(v, unit) })} step={step} suffix={unit} />
                    </>
                  ) : (
                    <>
                      <SetInput value={toDisplayWeight(set.weight, unit)} onChange={(v) => updateSet(current.uid, i, { weight: fromDisplayWeight(v, unit) })} step={step} suffix={unit} />
                      <SetInput value={set.reps} onChange={(v) => updateSet(current.uid, i, { reps: Math.round(v) })} step={1} suffix="reps" />
                    </>
                  )}

                  <div className="hidden sm:block">
                    {data.settings.effort !== 'off' ? (
                      <select
                        className="input !py-1.5 !text-xs"
                        value={set.rpe ?? ''}
                        onChange={(e) => updateSet(current.uid, i, { rpe: e.target.value ? Number(e.target.value) : undefined })}
                      >
                        <option value="">—</option>
                        {[6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10].map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                    ) : (
                      <input
                        className="input !py-1.5 !text-xs"
                        placeholder="note"
                        value={set.note ?? ''}
                        onChange={(e) => updateSet(current.uid, i, { note: e.target.value })}
                      />
                    )}
                  </div>

                  <button
                    onClick={() => completeSet(current.uid, i)}
                    className={clsx('grid h-9 w-9 place-items-center justify-self-end rounded-xl transition', set.done ? 'bg-[var(--good)] text-black' : 'border border-strong bg-[var(--surface-2)] text-mute hover:border-[var(--accent-line)] hover:text-[var(--accent)]')}
                    aria-label={set.done ? 'Mark set incomplete' : 'Complete set'}
                  >
                    <Check size={17} strokeWidth={3} />
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <Btn size="sm" onClick={() => addSet(current.uid)} icon={<Plus size={14} />}>Add set</Btn>
              {current.sets.length > 1 && <Btn size="sm" variant="ghost" onClick={() => removeSet(current.uid, current.sets.length - 1)} icon={<Minus size={14} />}>Remove last</Btn>}
              <Btn size="sm" variant="ghost" onClick={() => toggleSessionLink(current.uid)} icon={<Link2 size={14} />}>{current.linkedNext ? 'Unlink superset' : 'Superset next'}</Btn>
            </div>

            {paused ? (
              <p className="mt-3 text-center text-[11px] font-bold text-[var(--warn)]">Resume to continue logging.</p>
            ) : restLeft <= 0 ? (
              <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-line bg-[var(--surface-2)] px-3 py-2">
                <span className="flex items-center gap-1 text-[11px] font-black text-mute"><Timer size={13} /> Rest</span>
                {[60, 90, 120].map((s) => <button key={s} onClick={() => { void unlockAudio(); startRest(s); }} className="rounded-full bg-[var(--surface)] px-2.5 py-1 text-[10px] font-black text-dim hover:text-[var(--accent)]">{s}s</button>)}
                <button onClick={() => startRest(data.settings.restSec)} className="ml-auto text-[10px] font-black text-[var(--accent)]">Custom {data.settings.restSec}s</button>
              </div>
            ) : null}
          </div>
        </Card>
      ) : (
        <EmptyState icon={<Dumbbell size={24} />} title="No exercises left" body="Add a movement to keep training." action={<Btn variant="primary" onClick={() => setPicker(true)}>Add exercise</Btn>} />
      )}

      {current && current.primary && (() => {
        const prior = lastSetsFor(data.sessions, current.id);
        const h = prior[0];
        if (!h || !h.weight) return null;
        return (
          <p className="mt-3 text-center text-[10px] font-bold text-mute">
            Suggested from last time: {toDisplayWeight(h.weight, unit).toFixed(1)} {unit} × {h.reps} · e1RM {toDisplayWeight(oneRm(h.weight, h.reps, h.rpe), unit).toFixed(1)} {unit}
          </p>
        );
      })()}

      {/* bottom action bar */}
      <div className="sticky bottom-20 z-10 mt-4 flex gap-2 rounded-2xl border border-line bg-[var(--bg)]/90 p-2 backdrop-blur lg:bottom-4">
        <Btn className="flex-1" onClick={() => setMenuOpen(true)} icon={<MoreHorizontal size={16} />}>Session</Btn>
        <Btn variant="primary" className="flex-1" onClick={() => setFinishOpen(true)} icon={<Check size={16} />}>Finish workout</Btn>
      </div>

      {/* add exercise */}
      <ExercisePicker
        open={picker}
        onClose={() => setPicker(false)}
        onPick={(ex) => { addExerciseToSession(ex.id); toast.push(`${ex.name} added`); }}
        exclude={active.exercises.map((e) => e.id)}
      />

      {/* swap exercise */}
      <ExercisePicker
        open={!!swapUid}
        onClose={() => setSwapUid(null)}
        title="Swap exercise"
        exclude={active.exercises.filter((e) => e.uid !== swapUid).map((e) => e.id)}
        onPick={(ex) => { if (swapUid) { replaceSessionExercise(swapUid, ex.id); toast.push(`Swapped to ${ex.name}`); } setSwapUid(null); }}
      />

      {/* form guide */}
      {current && (() => {
        const curEx = allExercisesForCurrent(current);
        const instr = instructionsOf(current.id);
        const steps = stepsFor(curEx);
        const tips = tipsFor(curEx);
        return (
          <Sheet open={howToOpen} onClose={() => setHowToOpen(false)} title={`Form guide · ${current.name}`} >
            <ExerciseArt slug={curEx.art} height={230} radius={18} fallback={<ExerciseIcon ex={curEx} size={64} />} />
            <div className="mt-3 space-y-2.5">
              {steps.map((s, i) => (
                <div key={i} className="flex gap-2.5">
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[var(--accent-soft)] text-[10px] font-black text-[var(--accent)]">{i + 1}</span>
                  <p className="text-xs font-semibold leading-relaxed text-dim">{s}</p>
                </div>
              ))}
              {!steps.length && <p className="text-xs font-semibold text-mute">No steps recorded for this exercise.</p>}
            </div>
            {tips.length > 0 && (
              <div className="mt-3 rounded-2xl bg-[var(--surface-2)] p-3">
                <p className="text-[10px] font-black uppercase tracking-wider text-mute">Tips</p>
                <ul className="mt-1.5 space-y-1">
                  {tips.map((t, i) => <li key={i} className="flex gap-2 text-xs font-semibold text-dim"><span className="text-[var(--accent)]">•</span> {t}</li>)}
                </ul>
              </div>
            )}
            <p className="mt-3 text-[10px] font-bold text-mute">
              {instr?.source === 'everkinetic' ? 'Artwork & instructions from Everkinetic / Workout Guide (CC BY-SA 4.0)' : 'Artwork under CC BY-SA 4.0'}
            </p>
          </Sheet>
        );
      })()}

      {/* finish */}
      <Sheet
        open={finishOpen}
        onClose={() => setFinishOpen(false)}
        title="Finish workout?"
        footer={<div className="flex gap-2"><Btn className="flex-1" onClick={() => setFinishOpen(false)}>Keep going</Btn><Btn className="flex-1" variant="primary" onClick={doFinish} icon={<Check size={16} />}>Save workout</Btn></div>}
      >
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Duration', value: fmtClock(elapsed) },
            { label: 'Working sets', value: String(doneSets) },
            { label: 'Volume', value: volumeLabel(volume, unit) },
            { label: 'Exercises', value: String(active.exercises.filter((e) => e.sets.some((s) => s.done)).length) },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl bg-[var(--surface-2)] p-3">
              <p className="label">{s.label}</p>
              <p className="num mt-1 text-lg font-black">{s.value}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs font-semibold text-dim">Only completed sets are saved. Unchecked sets and empty exercises are dropped.</p>
        {doneSets === 0 && <p className="mt-2 rounded-xl bg-[var(--bad-soft)] px-3 py-2 text-[11px] font-bold text-[var(--bad)]">You haven’t completed any sets yet. Finishing now simply discards the session.</p>}
      </Sheet>

      {/* discard */}
      <Confirm
        open={discardOpen}
        onClose={() => setDiscardOpen(false)}
        onConfirm={doDiscard}
        title="Discard workout?"
        body="This session will not be saved. Completed sets will be lost."
        confirmLabel="Discard"
      />

      {/* remove exercise */}
      <Confirm
        open={!!removeUid}
        onClose={() => setRemoveUid(null)}
        onConfirm={() => { if (removeUid) { removeSessionExercise(removeUid); toast.push('Exercise removed'); } setRemoveUid(null); }}
        title="Remove exercise?"
        body="Any sets logged for this exercise will be dropped when you remove it."
        confirmLabel="Remove"
      />

      {/* rename */}
      <Sheet
        open={nameOpen}
        onClose={() => setNameOpen(false)}
        title="Workout name"
        footer={<Btn variant="primary" className="w-full" onClick={() => { setSessionName(nameDraft.trim()); setNameOpen(false); }}>Save name</Btn>}
      >
        <input autoFocus className="input" placeholder="e.g. Push day, Legs, Morning session" value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} />
        <p className="mt-2 text-[11px] font-semibold text-mute">Names show up in history and progress charts.</p>
      </Sheet>

      {/* menu */}
      <Sheet open={menuOpen} onClose={() => setMenuOpen(false)} title="Session options">
        <div className="space-y-2">
          <button onClick={openName} className="flex w-full items-center gap-3 rounded-2xl border border-line bg-[var(--surface-2)] p-3 text-left text-sm font-extrabold"><Pencil size={17} className="text-mute" /> Rename workout</button>
          <button onClick={() => { setMenuOpen(false); setPicker(true); }} className="flex w-full items-center gap-3 rounded-2xl border border-line bg-[var(--surface-2)] p-3 text-left text-sm font-extrabold"><Plus size={17} className="text-mute" /> Add exercise</button>
          <button onClick={() => { setMenuOpen(false); toggleSessionPause(); }} className="flex w-full items-center gap-3 rounded-2xl border border-line bg-[var(--surface-2)] p-3 text-left text-sm font-extrabold">
            {paused ? <Play size={17} className="text-mute" /> : <Pause size={17} className="text-mute" />} {paused ? 'Resume timer' : 'Pause workout'}
          </button>
          <button onClick={() => { setMenuOpen(false); startRest(data.settings.restSec); }} className="flex w-full items-center gap-3 rounded-2xl border border-line bg-[var(--surface-2)] p-3 text-left text-sm font-extrabold"><AlarmClock size={17} className="text-mute" /> Start {data.settings.restSec}s rest</button>
          <button onClick={() => { setMenuOpen(false); setDiscardOpen(true); }} className="flex w-full items-center gap-3 rounded-2xl border border-[var(--bad)]/30 bg-[var(--bad-soft)] p-3 text-left text-sm font-extrabold text-[var(--bad)]"><Trash2 size={17} /> Discard workout</button>
        </div>

        <div className="mt-5">
          <p className="label mb-2">Order · {active.exercises.length} exercises</p>
          <div className="space-y-1">
            {active.exercises.map((e, i) => (
              <div key={e.uid} className="flex items-center gap-2 rounded-xl border border-line bg-[var(--surface-2)] px-2 py-1.5">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-[var(--surface-3)] text-[10px] font-black text-mute">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate text-xs font-extrabold">{e.name}</span>
                <button disabled={i === 0} onClick={() => moveSessionExercise(i, i - 1)} className="grid h-7 w-7 place-items-center rounded-lg text-mute disabled:opacity-30"><ArrowUp size={14} /></button>
                <button disabled={i === active.exercises.length - 1} onClick={() => moveSessionExercise(i, i + 1)} className="grid h-7 w-7 place-items-center rounded-lg text-mute disabled:opacity-30"><ArrowDown size={14} /></button>
              </div>
            ))}
          </div>
        </div>
        <p className="mt-4 text-center text-[10px] font-bold text-mute">Settings → rest timer controls automatic countdowns and sound.</p>
      </Sheet>

      <div className="mt-4 flex items-center justify-center gap-2 text-[10px] font-bold text-mute">
        <Flame size={11} /> {data.settings.autoRest ? 'Auto rest on' : 'Auto rest off'} · {data.settings.effort === 'off' ? 'RPE hidden' : `${data.settings.effort.toUpperCase()} enabled`} · {data.settings.autoAdvance ? 'Auto advance' : 'Manual advance'}
      </div>
    </div>
  );
}

function SetInput({ value, onChange, step, suffix }: { value: number; onChange: (v: number) => void; step: number; suffix: string }) {
  const [text, setText] = useState<string | null>(null);
  const display = text ?? String(Math.round(value * 10) / 10);
  return (
    <div className="relative">
      <input
        type="number"
        inputMode="decimal"
        className="input !py-2 !pr-8 !text-right !text-sm font-black"
        value={display}
        step={step}
        onFocus={(e) => e.target.select()}
        onChange={(e) => { setText(e.target.value); onChange(e.target.value === '' ? 0 : Number(e.target.value)); }}
        onBlur={() => setText(null)}
      />
      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-black uppercase text-mute">{suffix}</span>
    </div>
  );
}

function allExercisesForCurrent(e: { id: string; name: string; primary: string }) {
  // Prefer catalog data so animation + steps can fall out of the real entry.
  const cat = EXERCISES.find((c) => c.id === e.id);
  if (cat) return cat;
  return {
    id: e.id, name: e.name, primary: e.primary, secondary: [], equipment: '', difficulty: '', art: '', steps: [], mode: '', aliases: [], kind: '',
  };
}
