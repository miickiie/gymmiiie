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
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArtThumb } from '../components/ExerciseArt';
import { ExerciseGuide } from '../components/ExerciseGuide';
import ExercisePicker from '../components/ExercisePicker';
import { ExerciseIcon } from '../components/ExerciseTile';
import { recordLabel, recordValue } from '../components/recordLabels';
import {
  Btn,
  Card,
  CatDock,
  Confirm,
  EmptyState,
  Field,
  NumericInput,
  Segmented,
  Sheet,
  useNow,
  useToast,
} from '../components/ui';
import { beep, unlockAudio, vibrate } from '../lib/audio';
import { fmtClock, fmtDuration } from '../lib/date';
import { isCompletableSet, loadKindFor, modeFor } from '../lib/exercises';
import { useI18n } from '../lib/i18n';
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
import type {
  ActiveSession,
  LoggedSet,
  SessionExercise,
  SessionSet,
  Unit,
} from '../types';

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

const TH: Record<string, string> = {
  'Weight unit': 'หน่วยน้ำหนัก',
  'Rest time is up. Start your next set when you’re ready.':
    'หมดเวลาพักแล้ว เริ่มเซ็ตต่อไปเมื่อพร้อม',
  'No workout in progress': 'ไม่มีการฝึกที่กำลังทำอยู่',
  'Follow a routine or start an empty workout.':
    'ฝึกตามตาราง หรือเริ่มโดยยังไม่เลือกท่า',
  'Start workout': 'เริ่มฝึก',
  'Freestyle session': 'ฝึกอิสระ',
  '{done}/{total} sets': '{done}/{total} เซ็ต',
  'Resume workout': 'ฝึกต่อ',
  'Pause workout': 'พักการฝึก',
  'Session options': 'ตัวเลือกการฝึก',
  'Workout paused · resume to continue logging':
    'หยุดการฝึกชั่วคราว · ทำต่อเพื่อบันทึกต่อ',
  'Rest timer': 'จับเวลาพัก',
  'Subtract 15 seconds rest': 'ลดเวลาพัก 15 วินาที',
  'Add 15 seconds rest': 'เพิ่มเวลาพัก 15 วินาที',
  Skip: 'ข้าม',
  'Workout exercises': 'ท่าออกกำลังในการฝึก',
  Add: 'เพิ่ม',
  'All sets completed. Finish when the workout is ready to save.':
    'ทำครบทุกเซ็ตแล้ว กดจบเมื่อพร้อมบันทึก',
  ' · assistance load': ' · แรงช่วย',
  ' · added load': ' · น้ำหนักที่เพิ่ม',
  'Top weight': 'น้ำหนักสูงสุด',
  'Longest time': 'นานที่สุด',
  'Farthest distance': 'ไกลที่สุด',
  'Most repetitions': 'จำนวน reps สูงสุด',
  ' · e1RM {n} {unit}': ' · e1RM {n} {unit}',
  'Form guide': 'คำแนะนำการทำท่า',
  'Last time': 'ครั้งก่อน',
  'Log sets for {name}': 'บันทึกเซ็ตสำหรับ {name}',
  Set: 'Set',
  Distance: 'ระยะทาง',
  Seconds: 'Seconds',
  Assistance: 'แรงช่วย',
  Load: 'น้ำหนักที่ใช้',
  Reps: 'Reps',
  Complete: 'เสร็จ',
  'Set {n} details': 'รายละเอียดเซ็ต {n}',
  'Set {n} distance': 'ระยะทางเซ็ต {n}',
  'Set {n} seconds': 'เวลาเซ็ต {n} (s)',
  'Set {n} weight': 'น้ำหนักเซ็ต {n}',
  'Set {n} repetitions': 'จำนวน reps ในเซ็ต {n}',
  'No load': 'ไม่ใช้น้ำหนัก',
  'Mark set {n} incomplete': 'ทำเครื่องหมายเซ็ต {n} ว่ายังไม่เสร็จ',
  'Complete set {n}': 'บันทึกว่าเซ็ต {n} เสร็จแล้ว',
  'Set details': 'รายละเอียดเซ็ต',
  ' · note': ' · โน้ต',
  'Add set': 'เพิ่มเซ็ต',
  'Remove last set': 'ลบเซ็ตสุดท้าย',
  'Swap exercise': 'เปลี่ยนท่า',
  'Remove exercise': 'ลบท่า',
  Rest: 'พัก',
  'Default {n}s': 'ค่าเริ่มต้น {n} s',
  'No exercises yet': 'ยังไม่มีท่า',
  'Add a movement to begin logging.': 'เพิ่มท่าก่อนเริ่มบันทึก',
  'Add exercise': 'เพิ่มท่า',
  'Finish workout': 'จบการฝึก',
  'Form guide · {name}': 'คู่มือท่า · {name}',
  Exercise: 'ท่าออกกำลัง',
  'Verified form guidance is not available for this movement.':
    'ยังไม่มีคำแนะนำท่าที่ตรวจสอบแล้วสำหรับท่านี้',
  'Your exercise instructions': 'คำแนะนำท่าของคุณ',
  'Reviewed form guide': 'คู่มือท่าที่ตรวจแล้ว',
  Reference: 'อ้างอิง',
  'No form guide is available for this saved exercise.':
    'ไม่มีคู่มือท่าสำหรับท่าที่บันทึกไว้นี้',
  Done: 'เสร็จ',
  'Set type': 'ประเภทเซ็ต',
  'Reps in reserve (RIR)': 'จำนวน reps ที่ยังทำต่อได้ (RIR)',
  'Rate of perceived exertion (RPE)': 'ระดับความเหนื่อยที่รับรู้ (RPE)',
  'Not recorded': 'ยังไม่บันทึก',
  'Effort tracking is off. Enable RPE or RIR in Settings.':
    'ยังไม่ได้เปิดบันทึกระดับความหนัก เปิด RPE หรือ RIR ได้ในหน้าตั้งค่า',
  'Set note': 'โน้ตเซ็ต',
  'Setup, cues, or how the set felt':
    'การจัดท่า จุดที่ต้องใส่ใจ หรือความรู้สึกระหว่างทำเซ็ต',
  'Finish workout?': 'จบการฝึก?',
  'Keep going': 'ฝึกต่อ',
  'Saving…': 'กำลังบันทึก…',
  'Save workout': 'บันทึกการฝึก',
  'Discard empty workout': 'ยกเลิกโดยไม่บันทึก',
  Duration: 'ระยะเวลา',
  'Completed sets': 'เซ็ตที่ทำแล้ว',
  Volume: 'ปริมาณการฝึก',
  Exercises: 'ท่าออกกำลัง',
  'Only completed sets are saved. Unchecked sets and empty exercises are dropped.':
    'บันทึกเฉพาะเซ็ตที่ทำเสร็จ เซ็ตที่ยังไม่ติ๊กและท่าว่างจะถูกตัดออก',
  'No sets have been completed. This empty workout will be discarded.':
    'ยังไม่มีเซ็ตที่ทำเสร็จ การฝึกครั้งนี้จะถูกยกเลิก',
  'Discard workout?': 'ทิ้งการฝึก?',
  'Completed and unfinished sets in this workout will be lost.':
    'เซ็ตที่ทำแล้วและยังไม่เสร็จในการฝึกนี้จะหายไป',
  'Discard workout': 'ทิ้งการฝึก',
  'Resolve the storage issue before discarding this workout.':
    'แก้ปัญหาที่เก็บข้อมูลก่อนทิ้งการฝึกนี้',
  'Remove exercise?': 'ลบท่า?',
  'All sets recorded for this exercise will be removed from this workout.':
    'ทุกเซ็ตของท่านี้จะถูกลบออกจากการฝึกนี้',
  'Workout name': 'ชื่อการฝึก',
  'Save name': 'บันทึกชื่อ',
  'Rename workout': 'เปลี่ยนชื่อการฝึก',
  'Discard workout…': 'ทิ้งการฝึก…',
  'Exercise order': 'ลำดับท่า',
  'Move {name} up': 'เลื่อน {name} ขึ้น',
  'Move {name} down': 'เลื่อน {name} ลง',
  'Workout saved': 'บันทึกการฝึกแล้ว',
  'No completed sets — session discarded': 'ไม่มีเซ็ตที่ทำเสร็จ — ทิ้งการฝึกแล้ว',
  'Could not save this workout. The session is kept.':
    'บันทึกการฝึกไม่สำเร็จ ข้อมูลการฝึกครั้งนี้ยังอยู่',
  'Enter a duration before completing this set':
    'ใส่ระยะเวลาก่อนทำเซ็ตนี้ให้เสร็จ',
  'Enter a duration or distance before completing this set':
    'ใส่ระยะเวลาหรือระยะทางก่อนทำเซ็ตนี้ให้เสร็จ',
  'Enter repetitions before completing this set':
    'ใส่จำนวนเรปก่อนทำเซ็ตนี้ให้เสร็จ',
  'Back to Today': 'กลับไปหน้าวันนี้',
};

export default function Session() {
  const navigate = useNavigate();
  const toast = useToast();
  const { t, tm } = useI18n(TH);
  const data = useStore((s) => s.data);
  const status = useStore((s) => s.persistenceStatus);
  const isCommitting = useStore((s) => s.isCommitting);
  const actions = useStore.getState();
  const active = data.active;
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
  const exerciseStripRef = useRef<HTMLDivElement>(null);
  const selectedExerciseRef = useRef<HTMLButtonElement>(null);

  const current = active?.exercises[active.currentIndex];
  useLayoutEffect(() => {
    const strip = exerciseStripRef.current;
    const selected = selectedExerciseRef.current;
    if (!strip || !selected) return;

    const centerSelected = () => {
      const stripBounds = strip.getBoundingClientRect();
      const selectedBounds = selected.getBoundingClientRect();
      strip.scrollTo({
        left:
          strip.scrollLeft +
          selectedBounds.left -
          stripBounds.left -
          (strip.clientWidth - selectedBounds.width) / 2,
        behavior: 'auto',
      });
    };
    centerSelected();
    const observer = new ResizeObserver(centerSelected);
    observer.observe(strip);
    observer.observe(selected);
    return () => observer.disconnect();
  }, [current?.uid, active?.exercises]);
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
        title={t('No workout in progress')}
        body={t('Follow a routine or start an empty workout.')}
        action={
          <Btn variant="primary" onClick={() => navigate('/train')}>
            {t('Start workout')}
          </Btn>
        }
      />
    );
  const unit = data.settings.unit;
  const weightUnit = current?.weightUnit ?? unit;
  const paused = !!active.pausedAt;
  const readOnly = isCommitting || status === 'error' || status === 'conflict';
  const blocked = paused || readOnly;
  const mode = current ? modeFor(current) : '';
  const load = current ? loadKindFor(current) : undefined;
  const hasRest = active.restEndsAt != null || (active.restFrozen ?? 0) > 0;
  const totalSets = active.exercises.reduce(
    (count, ex) => count + ex.sets.length,
    0,
  );
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
          ? t('Enter a duration before completing this set')
          : tracking === 'cardio'
            ? t('Enter a duration or distance before completing this set')
            : t('Enter repetitions before completing this set'),
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
        toast.push(t('Workout saved'), 'good');
        navigate(`/history/${result.id}`);
      } else {
        toast.push(t('No completed sets — session discarded'));
        navigate('/train');
      }
    } catch (error) {
      setFinishError(
        error instanceof Error
          ? error.message
          : t('Could not save this workout. The session is kept.'),
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
          aria-label={t('Back to Today')}
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
              {active.name || t('Freestyle session')}
            </span>
            <Pencil size={12} />
          </button>
          <p className="text-[11px] font-bold text-mute">
            <ElapsedClock active={active} /> ·{' '}
            {t('{done}/{total} sets', { done: doneSets, total: totalSets })} ·{' '}
            {volumeLabel(volume, unit)}
          </p>
        </div>
        <Btn
          size="icon"
          disabled={readOnly}
          aria-label={paused ? t('Resume workout') : t('Pause workout')}
          onClick={actions.toggleSessionPause}
        >
          {paused ? <Play size={16} /> : <Pause size={16} />}
        </Btn>
        <Btn
          size="icon"
          aria-label={t('Session options')}
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
          {t('Workout paused · resume to continue logging')}
        </div>
      )}
      {hasRest && (
        <RestTimer active={active} paused={paused} readOnly={readOnly} t={t} />
      )}
      <fieldset disabled={blocked} className="mb-3 min-w-0">
        <legend className="sr-only">{t('Workout exercises')}</legend>
        <div ref={exerciseStripRef} className="scroll-x pb-1">
          <span aria-hidden="true" className="w-1/2 shrink-0" />
          {active.exercises.map((ex, index) => (
            <button
              key={ex.uid}
              ref={
                index === active.currentIndex ? selectedExerciseRef : undefined
              }
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
            {t('Add')}
          </Btn>
          <span aria-hidden="true" className="w-1/2 shrink-0" />
        </div>
      </fieldset>
      {allDone && (
        <p
          role="status"
          className="mb-3 rounded-xl bg-[var(--good-soft)] p-3 text-sm font-bold text-[var(--good)]"
        >
          {t('All sets completed. Finish when the workout is ready to save.')}
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
                {tm(
                  current.primary,
                  MUSCLE_LABEL[current.primary] ?? current.primary,
                )}
                {load === 'assistance'
                  ? t(' · assistance load')
                  : load === 'added'
                    ? t(' · added load')
                    : ''}
              </p>
              {record && (
                <p className="mt-1 text-[10px] font-bold text-[var(--warn)]">
                  {t(recordLabel(record.kind))} {recordValue(record, weightUnit)}
                  {record.kind === 'weight' && record.oneRm > 0
                    ? t(' · e1RM {n} {unit}', {
                        n: toDisplayWeight(record.oneRm, weightUnit).toFixed(1),
                        unit: weightUnit,
                      })
                    : ''}
                </p>
              )}
            </div>
            <Btn
              size="icon"
              aria-label={t('Form guide')}
              onClick={() => setHowToOpen(true)}
            >
              <BookOpen size={16} />
            </Btn>
          </div>
          {previousSets.length > 0 && (
            <div className="border-b border-line bg-[var(--surface-2)] px-4 py-2">
              <p className="label">{t('Last time')}</p>
              <p className="mt-1 text-xs font-semibold text-dim">
                {previousSets
                  .slice(0, 5)
                  .map((set) => formatSet(set, current, weightUnit))
                  .join(' · ')}
              </p>
            </div>
          )}
          <fieldset disabled={blocked} className="min-w-0 p-3 sm:p-4">
            <legend className="sr-only">
              {t('Log sets for {name}', { name: current.name })}
            </legend>
            {mode !== 'cardio' && load !== 'none' && (
              <div
                role="group"
                aria-label={t('Weight unit')}
                className="mb-2 flex justify-end"
              >
                <Segmented<Unit>
                  value={weightUnit}
                  options={[
                    { value: 'kg', label: 'kg' },
                    { value: 'lb', label: 'lb' },
                  ]}
                  className="w-24 !p-0.5"
                  onChange={(nextUnit) => {
                    actions.update((draft) => {
                      const exercise = draft.active?.exercises.find(
                        (item) => item.uid === current.uid,
                      );
                      if (exercise) exercise.weightUnit = nextUnit;
                    });
                  }}
                />
              </div>
            )}
            <div className="mb-2 grid grid-cols-[40px_1fr_1fr_44px] items-center gap-2 text-[10px] font-black uppercase text-mute">
              <span>{t('Set')}</span>
              <span>
                {mode === 'cardio'
                  ? `${t('Distance')} (km)`
                  : mode === 'time'
                    ? t('Seconds')
                    : load === 'assistance'
                      ? `${t('Assistance')} (${weightUnit})`
                      : load === 'none'
                        ? t('Load')
                        : weightUnit}
              </span>
              <span>
                {mode === 'cardio'
                  ? t('Seconds')
                  : mode === 'time'
                    ? `${t('Load')} (${weightUnit})`
                    : t('Reps')}
              </span>
              <span className="sr-only">{t('Complete')}</span>
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
                      aria-label={t('Set {n} details', { n: index + 1 })}
                      onClick={() => setDetail({ uid: current.uid, index })}
                      className="grid min-h-11 place-items-center rounded-lg bg-[var(--surface-2)] text-[10px] font-black"
                    >
                      {index + 1}
                      <span>{KIND_SHORT[set.kind]}</span>
                    </button>
                    {mode === 'cardio' ? (
                      <>
                        <SetInput
                          label={t('Set {n} distance', { n: index + 1 })}
                          value={set.km ?? 0}
                          onChange={(km) =>
                            actions.updateSet(current.uid, index, { km })
                          }
                          step={0.1}
                          suffix="km"
                        />
                        <SetInput
                          label={t('Set {n} seconds', { n: index + 1 })}
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
                          label={t('Set {n} seconds', { n: index + 1 })}
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
                            {t('No load')}
                          </span>
                        ) : (
                          <SetInput
                            label={t('Set {n} weight', { n: index + 1 })}
                            key={`${current.uid}-${weightUnit}`}
                            value={toDisplayWeight(set.weight, weightUnit)}
                            onChange={(weight) =>
                              actions.updateSet(current.uid, index, {
                                weight: fromDisplayWeight(weight, weightUnit),
                              })
                            }
                            step={weightStep(weightUnit)}
                            suffix={weightUnit}
                          />
                        )}
                      </>
                    ) : (
                      <>
                        {load === 'none' ? (
                          <span className="text-center text-xs font-bold text-mute">
                            {t('No load')}
                          </span>
                        ) : (
                          <SetInput
                            label={t('Set {n} weight', { n: index + 1 })}
                            key={`${current.uid}-${weightUnit}`}
                            value={toDisplayWeight(set.weight, weightUnit)}
                            onChange={(weight) =>
                              actions.updateSet(current.uid, index, {
                                weight: fromDisplayWeight(weight, weightUnit),
                              })
                            }
                            step={weightStep(weightUnit)}
                            suffix={weightUnit}
                          />
                        )}
                        <SetInput
                          label={t('Set {n} repetitions', { n: index + 1 })}
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
                          ? t('Mark set {n} incomplete', { n: index + 1 })
                          : t('Complete set {n}', { n: index + 1 })
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
                    {t('Set details')}
                    {set.rpe != null
                      ? ` · ${data.settings.effort === 'rir' ? `RIR ${10 - set.rpe}` : `RPE ${set.rpe}`}`
                      : ''}
                    {set.note ? t(' · note') : ''}
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
                {t('Add set')}
              </Btn>
              {current.sets.length > 1 && (
                <Btn
                  size="sm"
                  onClick={() =>
                    actions.removeSet(current.uid, current.sets.length - 1)
                  }
                  icon={<Minus size={14} />}
                >
                  {t('Remove last set')}
                </Btn>
              )}
              <Btn
                size="sm"
                onClick={() => setSwapUid(current.uid)}
                icon={<RotateCcw size={14} />}
              >
                {t('Swap exercise')}
              </Btn>
              <Btn
                size="sm"
                variant="ghost"
                onClick={() => setRemoveUid(current.uid)}
                icon={<Trash2 size={14} />}
              >
                {t('Remove exercise')}
              </Btn>
            </div>
            {!hasRest && (
              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
                <span className="label">{t('Rest')}</span>
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
                  {t('Default {n}s', { n: data.settings.restSec })}
                </Btn>
              </div>
            )}
          </fieldset>
        </Card>
      ) : (
        <EmptyState
          icon={<Dumbbell size={24} />}
          title={t('No exercises yet')}
          body={t('Add a movement to begin logging.')}
          action={
            <Btn disabled={blocked} onClick={() => setPicker(true)}>
              {t('Add exercise')}
            </Btn>
          }
        />
      )}
      <div className="session-actions z-40 flex items-end gap-1 rounded-2xl bg-[var(--bg)]">
        <div className="flex min-w-0 flex-1 gap-2 rounded-2xl border border-line bg-[var(--bg)]/95 p-2 backdrop-blur">
        <Btn
          size="sm"
          className="min-h-11 min-w-11 shrink-0 sm:flex-1 sm:text-sm"
          aria-label={t('Session options')}
          icon={<MoreHorizontal size={18} />}
          onClick={() => setMenuOpen(true)}
        >
          <span className="hidden sm:inline">{t('Session options')}</span>
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
          {t('Finish workout')}
        </Btn>
        </div>
        <CatDock />
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
        title={t('Swap exercise')}
        exclude={active.exercises.map((ex) => ex.id)}
        onPick={(ex) => {
          if (swapUid) actions.replaceSessionExercise(swapUid, ex.id);
          setSwapUid(null);
        }}
      />
      <ExerciseGuide
        exercise={catalog}
        name={current?.name}
        open={howToOpen}
        onClose={() => setHowToOpen(false)}
      />
      <Sheet
        open={!!detail && !!detailSet}
        onClose={() => setDetail(null)}
        title={t('Set {n} details', { n: (detail?.index ?? 0) + 1 })}
        footer={
          <Btn className="w-full" onClick={() => setDetail(null)}>
            {t('Done')}
          </Btn>
        }
      >
        {detailSet && (
          <fieldset disabled={blocked} className="min-w-0 space-y-4">
            <Field label={t('Set type')}>
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
                    ? t('Reps in reserve (RIR)')
                    : t('Rate of perceived exertion (RPE)')
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
                  <option value="">{t('Not recorded')}</option>
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
                {t('Effort tracking is off. Enable RPE or RIR in Settings.')}
              </p>
            )}
            <Field label={t('Set note')}>
              <textarea
                className="input min-h-[100px]"
                value={detailSet.note ?? ''}
                onChange={(event) => setDetails({ note: event.target.value })}
                placeholder={t('Setup, cues, or how the set felt')}
              />
            </Field>
          </fieldset>
        )}
      </Sheet>
      <Sheet
        open={finishOpen}
        onClose={() => setFinishOpen(false)}
        dismissible={!finishing}
        title={t('Finish workout?')}
        footer={
          <div className="flex gap-2">
            <Btn
              disabled={finishing}
              className="flex-1"
              onClick={() => setFinishOpen(false)}
            >
              {t('Keep going')}
            </Btn>
            <Btn
              disabled={finishing || readOnly}
              className="flex-1"
              variant="primary"
              onClick={() => void finish()}
            >
              {finishing
                ? t('Saving…')
                : doneSets
                  ? t('Save workout')
                  : t('Discard empty workout')}
            </Btn>
          </div>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Duration', value: fmtClock(activeElapsed(active)) },
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
              <p className="label">{t(stat.label)}</p>
              <p className="mt-1 font-black">{stat.value}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-sm font-semibold text-dim">
          {t(
            'Only completed sets are saved. Unchecked sets and empty exercises are dropped.',
          )}
        </p>
        {doneSets === 0 && (
          <p className="mt-3 text-sm font-bold text-[var(--warn)]">
            {t('No sets have been completed. This empty workout will be discarded.')}
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
        title={t('Discard workout?')}
        body={t(
          'Completed and unfinished sets in this workout will be lost.',
        )}
        confirmLabel={t('Discard workout')}
        onConfirm={() => {
          actions.discardSession();
          if (useStore.getState().data.active)
            throw new Error(
              t('Resolve the storage issue before discarding this workout.'),
            );
          setMenuOpen(false);
          navigate('/');
        }}
      />
      <Confirm
        open={!!removeUid}
        onClose={() => setRemoveUid(null)}
        title={t('Remove exercise?')}
        body={t(
          'All sets recorded for this exercise will be removed from this workout.',
        )}
        confirmLabel={t('Remove exercise')}
        onConfirm={() => {
          if (removeUid && !blocked) actions.removeSessionExercise(removeUid);
        }}
      />
      <Sheet
        open={nameOpen}
        onClose={() => setNameOpen(false)}
        title={t('Workout name')}
        footer={
          <Btn
            disabled={readOnly}
            className="w-full"
            onClick={() => {
              actions.setSessionName(nameDraft.trim());
              setNameOpen(false);
            }}
          >
            {t('Save name')}
          </Btn>
        }
      >
        <Field label={t('Workout name')}>
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
        title={t('Session options')}
      >
        <div className="flex flex-wrap gap-2">
          <Btn disabled={readOnly} onClick={openName}>
            {t('Rename workout')}
          </Btn>
          <Btn
            disabled={blocked}
            onClick={() => {
              setMenuOpen(false);
              setPicker(true);
            }}
          >
            {t('Add exercise')}
          </Btn>
          <Btn
            disabled={readOnly}
            onClick={() => {
              actions.toggleSessionPause();
              setMenuOpen(false);
            }}
          >
            {paused ? t('Resume workout') : t('Pause workout')}
          </Btn>
          <Btn
            disabled={readOnly}
            variant="danger"
            onClick={() => setDiscardOpen(true)}
          >
            {t('Discard workout…')}
          </Btn>
        </div>
        <h2 className="label mb-3 mt-5">{t('Exercise order')}</h2>
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
                aria-label={t('Move {name} up', { name: ex.name })}
                onClick={() => actions.moveSessionExercise(index, index - 1)}
              >
                <ArrowUp size={15} />
              </Btn>
              <Btn
                size="icon"
                disabled={blocked || index === active.exercises.length - 1}
                aria-label={t('Move {name} down', { name: ex.name })}
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

/** Keeps the elapsed clock live without re-rendering the whole workout page. */
function ElapsedClock({ active }: { active: ActiveSession }) {
  useNow(!active.pausedAt, 1000);
  return <>{fmtDuration(activeElapsed(active))}</>;
}

/**
 * Owns the per-second rest countdown so only this card re-renders. It stays
 * mounted until the rest is cleared, which lets it fire the completion cue
 * after the visible countdown reaches zero.
 */
function RestTimer({
  active,
  paused,
  readOnly,
  t,
}: {
  active: ActiveSession;
  paused: boolean;
  readOnly: boolean;
  t: (text: string) => string;
}) {
  const actions = useStore.getState();
  const toast = useToast();
  const sound = useStore((s) => s.data.settings.sound);
  const vibration = useStore((s) => s.data.settings.vibrate);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);
  const restLeft =
    active.restFrozen != null
      ? Math.max(0, Math.ceil(active.restFrozen))
      : active.restEndsAt
        ? Math.max(0, Math.ceil((active.restEndsAt - now) / 1000))
        : 0;
  const previousRest = useRef(restLeft);
  useEffect(() => {
    if (
      previousRest.current > 0 &&
      restLeft === 0 &&
      active.restEndsAt &&
      now >= active.restEndsAt
    ) {
      if (sound) beep(3);
      if (vibration) vibrate([120, 60, 120]);
      toast.push(t('Rest time is up. Start your next set when you’re ready.'));
    }
    previousRest.current = restLeft;
  }, [restLeft, active.restEndsAt, now, sound, vibration, toast.push, t]);
  if (restLeft <= 0 || paused) return null;
  return (
    <Card className="mb-3 flex items-center gap-2 border-[var(--accent-line)] bg-[var(--accent-soft)] p-3">
      <Timer size={20} className="text-[var(--accent)]" />
      <div className="flex-1">
        <p className="text-xs font-black">{t('Rest timer')}</p>
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
        aria-label={t('Subtract 15 seconds rest')}
        onClick={() => actions.nudgeRest(-15)}
      >
        <Minus size={15} />
      </Btn>
      <Btn
        size="icon"
        disabled={readOnly}
        aria-label={t('Add 15 seconds rest')}
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
        {t('Skip')}
      </Btn>
    </Card>
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
    <div className="relative min-w-0">
      <NumericInput
        aria-label={label}
        unit={suffix}
        inputMode="decimal"
        min={0}
        step={step}
        className="input session-set-input min-h-11 !px-2 !py-2 !text-center !text-sm font-black"
        value={text ?? String(Math.round(value * 10) / 10)}
        onFocus={(event) => event.target.select()}
        onValueChange={(raw) => {
          setText(raw);
          const number = raw === '' ? 0 : Number(raw);
          if (Number.isFinite(number) && number >= 0) onChange(number);
        }}
        onValueCommit={() => setText(null)}
      />
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
