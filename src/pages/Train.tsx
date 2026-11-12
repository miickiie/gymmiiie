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
import { useI18n } from '../lib/i18n';
import { MUSCLE_LABEL, routineForWeek } from '../lib/stats';
import { allExercises, useStore } from '../lib/store';
import type { Exercise } from '../types';

const TH: Record<string, string> = {
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
};

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
  const { t, tm } = useI18n(TH);
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
        <Card className="mb-4 flex flex-wrap items-center gap-3 border-[var(--accent-line)] bg-[var(--accent-soft)] p-4">
          <Flame size={20} className="text-[var(--accent)]" />
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
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
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
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
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
                  className="text-xs font-black text-[var(--accent)]"
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
              <Sparkles size={22} className="text-[var(--accent)]" />
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
                  className="grid gap-4 lg:grid-cols-[1.3fr_1fr]"
                >
                  <BodyMap selected={selected} onToggle={toggle} />
                  <div className="flex flex-col justify-center">
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
                      onClick={build}
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
          <Card className="mb-4 p-4">
            <div className="flex flex-wrap gap-2">
              {selected.map((muscle) => (
                <Chip key={muscle} on>
                  {tm(muscle, MUSCLE_LABEL[muscle] ?? muscle)}
                </Chip>
              ))}
            </div>
            <p className="mt-3 text-xs font-semibold text-dim">
              {t(
                'Suggestions are a starting point. Add, replace, remove, or reorder exercises for the workout you want.',
              )}
            </p>
            {uncovered.length > 0 && (
              <p
                role="status"
                className="mt-3 text-sm font-bold text-[var(--warn)]"
              >
                {t(
                  'No primary movement for {muscles}. Add an exercise or change the focus.',
                  {
                    muscles: uncovered
                      .map((muscle) =>
                        tm(muscle, MUSCLE_LABEL[muscle] ?? muscle),
                      )
                      .join(', '),
                  },
                )}
              </p>
            )}
          </Card>
          <SectionHeader
            title={t('{n} exercises', { n: picks.length })}
            action={
              <Btn
                size="sm"
                onClick={() => setPicker(true)}
                icon={<Plus size={15} />}
              >
                {t('Add exercise')}
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
                        {tm(ex.primary, MUSCLE_LABEL[ex.primary] ?? ex.primary)}{' '}
                        · {t(ex.equipment)}
                      </p>
                      {isWarmup(ex) && (
                        <span className="mt-1 inline-block rounded-full bg-[var(--warn)]/15 px-2 py-0.5 text-[10px] font-black text-[var(--warn)]">
                          {t('Warm-up / mobility')}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap justify-end gap-1">
                    <Btn
                      size="icon"
                      disabled={index === 0}
                      aria-label={t('Move {name} up', { name: ex.name })}
                      onClick={() => move(index, index - 1)}
                    >
                      <ArrowUp size={16} />
                    </Btn>
                    <Btn
                      size="icon"
                      disabled={index === picks.length - 1}
                      aria-label={t('Move {name} down', { name: ex.name })}
                      onClick={() => move(index, index + 1)}
                    >
                      <ArrowDown size={16} />
                    </Btn>
                    <Btn
                      size="sm"
                      onClick={() => setReplaceId(ex.id)}
                      icon={<RotateCcw size={14} />}
                    >
                      {t('Replace')}
                    </Btn>
                    <Btn
                      size="icon"
                      aria-label={t('Remove {name}', { name: ex.name })}
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
              title={t('No exercises selected')}
              action={
                <Btn onClick={() => setPicker(true)}>{t('Add exercise')}</Btn>
              }
            />
          )}
          <div className="sticky bottom-20 z-10 mt-4 flex gap-2 rounded-2xl border border-line bg-[var(--bg)]/95 p-2 backdrop-blur lg:bottom-4">
            <Btn onClick={() => setReviewing(false)}>{t('Change focus')}</Btn>
            <Btn
              variant="primary"
              className="flex-1"
              disabled={!picks.length}
              onClick={() => startList(picks.map((ex) => ex.id))}
            >
              {t('Start workout')}
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
        title={t('Replace exercise')}
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
