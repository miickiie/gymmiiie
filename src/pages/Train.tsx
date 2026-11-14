import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  Dumbbell,
  Flame,
  HeartPulse,
  Play,
  Plus,
  Sparkles,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import BodyMap from '../components/BodyMap';
import WorkoutDraftReview from '../components/WorkoutDraftReview';
import AiProfileSummary from '../components/AiProfileSummary';
import { AI_WORKOUT_TH } from '../lib/ai-workout';
import { useAiWorkout } from '../lib/useAiWorkout';
import {
  Btn,
  Card,
  CatDock,
  Chip,
  EmptyState,
  PageHeader,
  SectionHeader,
} from '../components/ui';
import { useWorkoutStart } from '../components/WorkoutStart';
import { defaultPicks } from '../lib/exercises';
import { useI18n } from '../lib/i18n';
import { MUSCLE_LABEL, routineForWeek } from '../lib/stats';
import { allExercises, useStore } from '../lib/store';
import type { Exercise } from '../types';

const TH: Record<string, string> = {
  ...AI_WORKOUT_TH,
  'Review your workout': 'ตรวจดูแผนฝึกก่อนเริ่ม',
  'Start your workout': 'เริ่มฝึก',
  'Arrange exercises, check your focus, then begin logging.':
    'จัดลำดับท่า เช็กกล้ามเนื้อเป้าหมาย แล้วเริ่มบันทึก',
  'Follow a routine or build as you go. Muscle suggestions are optional.':
    'ฝึกตามตารางหรือเพิ่มท่าระหว่างฝึกก็ได้ จะใช้คำแนะนำตามกล้ามเนื้อหรือไม่ก็ได้',
  'Freestyle session': 'ฝึกแบบอิสระ',
  '{n} exercises': '{n} ท่า',
  'Use a routine': 'ใช้ตารางฝึก',
  'Your saved plans and ready-made templates':
    'แผนที่บันทึกไว้และเทมเพลตสำเร็จรูป',
  'Empty workout': 'ฝึกแบบไม่มีแผน',
  'Add exercises as you train': 'เพิ่มท่าระหว่างฝึก',
  'Your routines': 'ตารางฝึกของคุณ',
  'Manage routines': 'จัดการตารางฝึก',
  ' · planned today': ' · แผนวันนี้',
  'No routines yet': 'ยังไม่มีตารางฝึก',
  'Choose a template or create a routine to use again.':
    'เลือกเทมเพลตหรือสร้างตารางฝึกเพื่อใช้ซ้ำ',
  'Browse routines': 'ดูตารางฝึก',
  'Suggest by muscle': 'แนะนำตามกล้ามเนื้อ',
  'Optional · choose a focus and review suggested movements':
    'เลือกใช้ได้ · เลือกกล้ามเนื้อเป้าหมายแล้วดูท่าที่แนะนำ',
  'Select muscles on the map. Review every suggestion before starting.':
    'เลือกกล้ามเนื้อบนภาพร่างกาย แล้วตรวจดูท่าที่แนะนำก่อนเริ่ม',
  'Review suggestions': 'ตรวจท่าที่แนะนำ',
  'Warm-up session': 'เซสชันวอร์มอัป',
  'Cardio session': 'เซสชันคาร์ดิโอ',
  'Suggestions are a starting point. Add, replace, remove, or reorder exercises for the workout you want.':
    'คำแนะนำเป็นเพียงจุดเริ่มต้น เพิ่ม เปลี่ยน เอาออก หรือจัดลำดับท่าได้ตามต้องการ',
  'No primary movement for {muscles}. Add an exercise or change the focus.':
    'ยังไม่มีท่าหลักของ {muscles} เพิ่มท่าหรือเปลี่ยนเป้าหมาย',
  'Add exercise': 'เพิ่มท่า',
  'Warm-up / mobility': 'วอร์มอัป / เพิ่มช่วงการเคลื่อนไหว',
  'Move {name} up': 'เลื่อน {name} ขึ้น',
  'Move {name} down': 'เลื่อน {name} ลง',
  Replace: 'เปลี่ยนท่า',
  'Remove {name}': 'เอา {name} ออก',
  'No exercises selected': 'ยังไม่ได้เลือกท่า',
  'Change focus': 'เปลี่ยนเป้าหมาย',
  'Replace exercise': 'เปลี่ยนท่า',
  Cardio: 'คาร์ดิโอ',
  Exercises: 'ท่าออกกำลัง',
  'Resume workout': 'ฝึกต่อ',
  Start: 'เริ่ม',
  'Start workout': 'เริ่มฝึก',
  Train: 'ฝึก',
  'Warm-up': 'วอร์มอัป',
  'Workout in progress': 'กำลังฝึกอยู่',
  'Form guide': 'คำแนะนำการทำท่า',
  'Form guide · {name}': 'คู่มือท่า · {name}',
};

const WARMUP_IDS = [
  'jumping-jack',
  'cat-cow-stretch',
  'leg-swings-stretch',
  'band-pull-apart',
];
const CARDIO_IDS = ['treadmill-incline-walk', 'cycling', 'rowing'];

export default function Train() {
  const { t, tm } = useI18n(TH);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const muscleEntry = searchParams.get('focus') === 'muscles';
  const data = useStore((s) => s.data);
  const accountId = useStore(s => s.account?.id);
  const ai = useAiWorkout();
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const { requestStart, dialogs } = useWorkoutStart();
  const [focusOpen, setFocusOpen] = useState(muscleEntry);
  const [selected, setSelected] = useState<string[]>([]);
  const [reviewing, setReviewing] = useState(false);
  const [picks, setPicks] = useState<Exercise[]>([]);
  useEffect(() => { setReviewing(false); setPicks([]); setReasons({}); }, [accountId]);
  const musclePicker = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (muscleEntry) {
      setFocusOpen(true);
      setReviewing(false);
    }
  }, [muscleEntry]);
  useEffect(() => {
    if (!muscleEntry || !focusOpen || reviewing) return;
    const frame = window.requestAnimationFrame(() => {
      musclePicker.current?.scrollIntoView({ block: 'start', behavior: 'instant' as ScrollBehavior });
      musclePicker.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [muscleEntry, focusOpen, reviewing]);
  const all = useMemo(() => allExercises(), [data.customExercises]);
  useEffect(() => { setPicks(values => values.filter(exercise => !data.archived.includes(exercise.id) && all.some(current => current.id === exercise.id))); }, [all, data.archived]);
  const today = routineForWeek(data);
  const toggle = (id: string) => {
    ai.cancel();
    setSelected((values) =>
      values.includes(id)
        ? values.filter((value) => value !== id)
        : [...values, id],
    );
  };
  const build = async (): Promise<void> => {
    setReasons({});
    setPicks(defaultPicks(all, data.sessions, selected, data.favorites, 8, data.archived));
    setReviewing(true);
    const result = await ai.generate('suggest', selected);
    if (result) {
      setPicks(result.items.flatMap(item => all.filter(exercise => exercise.id === item.exerciseId)));
      setReasons(Object.fromEntries(result.items.map(item => [item.exerciseId, item.reason])));
    }
  };
  const startList = (ids: string[], name?: string) =>
    requestStart(() => useStore.getState().startFromExercises(ids, name));

  return (
    <div className="page-enter">
      <PageHeader
        eyebrow={t('Train')}
        title={reviewing ? t('Review your workout') : t('Start your workout')}
        subtitle={
          reviewing
            ? t('Arrange exercises, check your focus, then begin logging.')
            : t(
                'Follow a routine or build as you go. Muscle suggestions are optional.',
              )
        }
        action={
          <Link to="/library" className="btn btn-soft px-3 py-2 text-xs">
            <BookOpen size={16} />
            {t('Exercises')}
          </Link>
        }
      />
      {data.active && (
        <Card className="mb-4 flex flex-wrap items-center gap-3 border-brand/35 bg-brand/15 p-4">
          <Flame size={20} className="text-brand" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black">{t('Workout in progress')}</p>
            <p className="text-xs font-semibold text-dim">
              {data.active.name || t('Freestyle session')} ·{' '}
              {t('{n} exercises', { n: data.active.exercises.length })}
            </p>
          </div>
          <Btn variant="primary" onClick={() => navigate('/session')}>
            {t('Resume workout')}
          </Btn>
        </Card>
      )}

      {!reviewing ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <Link
              to="/routines"
              aria-label={t('Use a routine')}
              className="card flex items-center gap-4 p-5 transition hover:border-strong"
            >
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand/15 text-brand">
                <CalendarDays size={24} />
              </span>
              <div>
                <h2 className="text-lg font-black">{t('Use a routine')}</h2>
                <p className="text-xs font-semibold text-dim">
                  {t('Your saved plans and ready-made templates')}
                </p>
              </div>
            </Link>
            <button
              type="button"
              aria-label={t('Empty workout')}
              onClick={() =>
                requestStart(() => useStore.getState().startEmpty())
              }
              className="card flex items-center gap-4 p-5 text-left transition hover:border-strong"
            >
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand/15 text-brand">
                <Plus size={24} />
              </span>
              <div>
                <h2 className="text-lg font-black">{t('Empty workout')}</h2>
                <p className="text-xs font-semibold text-dim">
                  {t('Add exercises as you train')}
                </p>
              </div>
            </button>
          </div>
          <section className="mt-5">
            <SectionHeader
              title={t('Your routines')}
              action={
                <Link
                  to="/routines"
                  className="text-xs font-black text-brand"
                >
                  {t('Manage routines')}
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
                          {t('{n} exercises', {
                            n: routine.exerciseIds.length,
                          })}
                          {routine.id === today?.id
                            ? t(' · planned today')
                            : ''}
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
                        {t('Start')}
                      </Btn>
                    </Card>
                  ))}
              </div>
            ) : (
              <EmptyState
                icon={<CalendarDays size={22} />}
                title={t('No routines yet')}
                body={t('Choose a template or create a routine to use again.')}
                action={
                  <Link
                    to="/routines"
                    className="btn btn-soft px-4 py-2 text-sm"
                  >
                    {t('Browse routines')}
                  </Link>
                }
              />
            )}
          </section>
          <section className="mt-5">
            <button
              type="button"
              aria-label={t('Suggest by muscle')}
              aria-expanded={focusOpen}
              aria-controls="muscle-suggestions"
              onClick={() => setFocusOpen((value) => !value)}
              className="card flex w-full items-center gap-3 p-4 text-left"
            >
              <Sparkles size={22} className="text-brand" />
              <div className="flex-1">
                <h2 className="text-base font-black">
                  {t('Suggest by muscle')}
                </h2>
                <p className="text-xs font-semibold text-dim">
                  {t(
                    'Optional · choose a focus and review suggested movements',
                  )}
                </p>
              </div>
              <Plus size={18} className={focusOpen ? 'rotate-45' : ''} />
            </button>
            {focusOpen && (
              <Card className="mt-3 p-4">
                <div
                  id="muscle-suggestions"
                  ref={musclePicker}
                  role="group"
                  aria-label={t('Suggest by muscle')}
                  tabIndex={-1}
                  className="grid scroll-mt-20 gap-4 lg:grid-cols-[1.3fr_1fr]"
                >
                  <BodyMap selected={selected} onToggle={toggle} />
                  <div className="flex flex-col justify-center">
                    <AiProfileSummary />
                    <p className="text-sm font-semibold text-dim">
                      {t(
                        'Select muscles on the map. Review every suggestion before starting.',
                      )}
                    </p>
                    <div className="my-4 flex flex-wrap gap-2">
                      {selected.map((muscle) => (
                        <Chip key={muscle} on onClick={() => toggle(muscle)}>
                          {tm(muscle, MUSCLE_LABEL[muscle] ?? muscle)}{' '}
                          <X size={12} />
                        </Chip>
                      ))}
                    </div>
                    <Btn
                      variant="primary"
                      disabled={!selected.length}
                      onClick={() => { void build(); }}
                    >
                      {t('Review suggestions')}
                    </Btn>
                  </div>
                </div>
              </Card>
            )}
          </section>
          <div className="mt-4 flex flex-wrap gap-2">
            <Btn
              onClick={() => startList(WARMUP_IDS, t('Warm-up'))}
              icon={<Flame size={16} />}
            >
              {t('Warm-up session')}
            </Btn>
            <Btn
              onClick={() => startList(CARDIO_IDS, t('Cardio'))}
              icon={<HeartPulse size={16} />}
            >
              {t('Cardio session')}
            </Btn>
          </div>
        </>
      ) : (
        <>
          {ai.loading ? <Card className="mb-4 space-y-3 p-4"><p role="status">{t('AI is arranging your workout…')}</p><Btn onClick={ai.cancel}>{t('Use basic suggestions')}</Btn></Card> : <>
            {ai.notice && <p role="status" className="mb-3 text-sm text-warn">{t(ai.notice)}</p>}
            <WorkoutDraftReview selectedMuscles={selected} draft={{ mode: 'suggest', items: picks.map(exercise => ({ exerciseId: exercise.id, reason: reasons[exercise.id] ?? '' })) }} onChange={draft => {
              ai.cancel();
              setPicks(draft.items.flatMap(item => all.filter(exercise => exercise.id === item.exerciseId)));
              setReasons(Object.fromEntries(draft.items.map(item => [item.exerciseId, item.reason])));
            }} />
          </>}
          <div className="floating-actions sticky z-10 mt-4 flex items-end gap-1 rounded-2xl bg-canvas">
            <div className="flex min-w-0 flex-1 gap-2 rounded-2xl border border-border bg-elevated/95 p-2 backdrop-blur-md">
            <Btn
              className="min-h-11 min-w-11 shrink-0"
              aria-label={t('Change focus')}
              icon={<ArrowLeft size={16} />}
              onClick={() => { ai.cancel(); setReviewing(false); }}
            >
              <span className="hidden sm:inline">{t('Change focus')}</span>
            </Btn>
            <Btn
              variant="primary"
              className="flex-1"
              disabled={!picks.length || ai.loading}
              onClick={() => startList(picks.map((ex) => ex.id))}
            >
              {t('Start workout')}
            </Btn>
            </div>
            <CatDock />
          </div>
        </>
      )}
      {dialogs}
    </div>
  );
}
