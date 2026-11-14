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
import { useGuideLanguage } from '../lib/guide';
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
import { useI18n } from '../lib/i18n';

const TH: Record<string, string> = {
  'Exercise not found': 'ไม่พบท่านี้',
  'It may have been deleted or the link is incomplete.':
    'อาจถูกลบไปแล้วหรือลิงก์ไม่ครบ',
  'Back to library': 'กลับไปคลังท่า',
  'Resolve the storage issue before changing this workout':
    'แก้ปัญหาที่เก็บข้อมูลก่อนแก้ไขการฝึกนี้',
  'Resume the workout before adding an exercise': 'ฝึกต่อก่อนเพิ่มท่า',
  '{name} is already in this workout': 'มี {name} ในการฝึกครั้งนี้แล้ว',
  '{name} added to current workout': 'เพิ่ม {name} ในการฝึกนี้แล้ว',
  'Note saved': 'บันทึกโน้ตแล้ว',
  Back: 'ย้อนกลับ',
  Exercise: 'ท่าออกกำลัง',
  Favourite: 'รายการโปรด',
  Unarchived: 'ยกเลิกการเก็บถาวรแล้ว',
  Archived: 'เก็บถาวร',
  Archive: 'เก็บถาวร',
  Delete: 'ลบ',
  custom: 'กำหนดเอง',
  ' · primary': ' · หลัก',
  'Add to workout': 'เพิ่มในการฝึก',
  'Start with this': 'เริ่มด้วยท่านี้',
  'Add note': 'เพิ่มโน้ต',
  'Last session': 'ครั้งล่าสุด',
  'How to perform it': 'วิธีทำ',
  '{n} steps · {source}': '{n} ขั้นตอน · {source}',
  'Your instructions': 'คำแนะนำของคุณ',
  'Form guide': 'คำแนะนำการทำท่า',
  'Guide unavailable': 'ยังไม่มีคู่มือ',
  Tips: 'เคล็ดลับ',
  'Your exercise instructions': 'คำแนะนำท่านี้ของคุณ',
  Reference: 'อ้างอิง',
  'No form notes yet': 'ยังไม่มีโน้ตท่าทาง',
  'Form guidance is not available for this movement.':
    'ยังไม่มีคำแนะนำท่าทางสำหรับท่านี้',
  'Your history': 'ประวัติของคุณ',
  '{n} recent sessions': '{n} ครั้งล่าสุด',
  'Nothing logged yet': 'ยังไม่มีการบันทึก',
  'Open session': 'เปิดการฝึก',
  '{n} working sets': '{n} เซ็ตทำงาน',
  ' · intensity techniques': ' · เทคนิคเพิ่มความหนัก',
  'No history yet': 'ยังไม่มีประวัติ',
  'Log this exercise in a workout to start tracking e1RM and PRs.':
    'บันทึกท่านี้ในการฝึกเพื่อเริ่มติดตาม e1RM และ PR',
  'Train it now': 'ฝึกเลย',
  'Exercise notes': 'โน้ตของท่า',
  Journal: 'บันทึก',
  note: 'โน้ต',
  plan: 'แผน',
  done: 'เสร็จ',
  pain: 'เจ็บ',
  'Personal record': 'สถิติส่วนตัว',
  'Top weight': 'น้ำหนักสูงสุด',
  'Longest time': 'เวลานานสุด',
  'Farthest distance': 'ระยะไกลสุด',
  'Most repetitions': 'จำนวน reps สูงสุด',
  'Best set {load}': 'เซ็ตดีที่สุด {load}',
  'No records yet. Log a working set to start tracking.':
    'ยังไม่มีสถิติ บันทึกเซ็ตทำงานเพื่อเริ่มติดตาม',
  'Estimated 1RM': '1RM โดยประมาณ',
  '{n} points': '{n} จุด',
  Muscles: 'กล้ามเนื้อ',
  primary: 'หลัก',
  secondary: 'รอง',
  'Similar movements': 'ท่าที่คล้ายกัน',
  'Note on {name}': 'โน้ตของ {name}',
  Cancel: 'ยกเลิก',
  'Save note': 'บันทึกโน้ต',
  'Cues that worked, pain to watch, setup notes…':
    'เทคนิคที่ได้ผล อาการเจ็บที่ต้องระวัง การจัดท่า…',
  'Attached to {name} and visible in your journal.':
    'แนบกับ {name} และแสดงในบันทึกของคุณ',
  'Exercise deleted': 'ลบท่าแล้ว',
  'Delete custom exercise?': 'ลบท่าที่สร้างเอง?',
  'It will be removed from your library and any routines using it. Logged history stays intact.':
    'ท่าจะถูกนำออกจากคลังและตารางฝึกที่ใช้ท่านี้ ประวัติที่บันทึกไว้ยังอยู่',
  'Delete exercise': 'ลบท่า',
  'Also known as {names}': 'หรือเรียกอีกชื่อว่า {names}',
  time: 'เวลา',
  cardio: 'คาร์ดิโอ',
  'One side at a time': 'ทีละข้าง',
  strength: 'ความแข็งแรง',
  mobility: 'การเคลื่อนไหว',
  sport: 'กีฬา',
  'Smith Machine': 'สมิธแมชชีน',
  'Trap Bar': 'ทราปบาร์',
  'EZ-Bar': 'อีซีบาร์',
  Beginner: 'เริ่มต้น',
  Intermediate: 'ปานกลาง',
  Advanced: 'ขั้นสูง',
  Barbell: 'บาร์เบล',
  Dumbbell: 'ดัมเบล',
  Cable: 'เคเบิล',
  Machine: 'เครื่อง',
  Bodyweight: 'น้ำหนักตัว',
  Weighted: 'เพิ่มน้ำหนัก',
  Band: 'ยางยืด',
  Kettlebell: 'เคตเทิลเบล',
  Rings: 'ห่วง',
  Other: 'อื่น ๆ',
};

export default function ExerciseDetail() {
  const { t, tm } = useI18n(TH);
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const data = useStore((s) => s.data);
  // Loads the Thai form-guide copy on demand and re-renders when it arrives.
  useGuideLanguage();
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
        title={t('Exercise not found')}
        body={t('It may have been deleted or the link is incomplete.')}
        action={
          <Btn variant="primary" onClick={() => navigate('/library')}>
            {t('Back to library')}
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
  const similar = (ex.similar_ids ?? [])
    .flatMap((id) => {
      const match = all.find((candidate) => candidate.id === id);
      return match ? [match] : [];
    })
    .slice(0, 5);
  const related = similar.length
    ? similar
    : all
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
        t('Resolve the storage issue before changing this workout'),
        'bad',
      );
      return;
    }
    if (data.active) {
      if (data.active.pausedAt) {
        toast.push(t('Resume the workout before adding an exercise'), 'bad');
        navigate('/session');
        return;
      }
      const alreadyAdded = data.active.exercises.some(
        (entry) => entry.id === ex.id,
      );
      addExerciseToSession(ex.id);
      toast.push(
        alreadyAdded
          ? t('{name} is already in this workout', { name: ex.name })
          : t('{name} added to current workout', { name: ex.name }),
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
    toast.push(t('Note saved'), 'good');
  };

  return (
    <div className="page-enter">
      <div className="mb-3 flex items-center gap-2">
        <button
          onClick={() => navigate(-1)}
          aria-label={t('Back')}
          className="grid h-9 w-9 place-items-center rounded-full bg-elevated text-dim"
        >
          <ArrowLeft size={18} />
        </button>
        <p className="label">{t('Exercise')}</p>
        <div className="ml-auto flex gap-1">
          <button
            onClick={() => toggleFavorite(ex.id)}
            className={`grid h-9 w-9 place-items-center rounded-full ${isFav ? 'bg-warn/10 text-warn' : 'bg-elevated text-mute'}`}
            title={t('Favourite')}
          >
            <Star size={17} fill={isFav ? 'currentColor' : 'none'} />
          </button>
          <button
            onClick={() => {
              toggleArchived(ex.id);
              toast.push(isArchived ? t('Unarchived') : t('Archived'));
            }}
            className={`grid h-9 w-9 place-items-center rounded-full ${isArchived ? 'bg-brand/15 text-brand' : 'bg-elevated text-mute'}`}
            title={t('Archive')}
          >
            <Archive size={16} />
          </button>
          {isCustom && (
            <button
              onClick={() => setConfirmDelete(true)}
              className="grid h-9 w-9 place-items-center rounded-full bg-elevated text-mute hover:text-danger"
              title={t('Delete')}
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>

      <Card className="relative overflow-hidden p-5">
        <div className="pointer-events-none absolute -right-8 -top-12 h-40 w-40 rounded-full bg-brand opacity-[0.08] blur-2xl" />
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
                <span className="rounded-full bg-brand/15 px-2 py-0.5 text-[10px] font-black text-brand">
                  {t('custom')}
                </span>
              )}
              {isFav && (
                <Star
                  size={15}
                  className="text-warn"
                  fill="currentColor"
                />
              )}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              {muscleOptions.map((m) => (
                <span
                  key={m.id}
                  className="flex items-center gap-1 rounded-full bg-elevated px-2 py-0.5 text-[10px] font-black text-dim"
                >
                  <MuscleDot id={m.id} size={5} /> {tm(m.id, m.label)}
                  {m.id === ex.primary ? t(' · primary') : ''}
                </span>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-black uppercase tracking-wide text-mute">
              <span className="rounded-full border border-line px-2 py-0.5">
                {t(ex.equipment)}
              </span>
              {ex.sub_equipment && (
                <span className="rounded-full border border-line px-2 py-0.5">
                  {t(ex.sub_equipment)}
                </span>
              )}
              <span className="rounded-full border border-line px-2 py-0.5">
                {t(ex.difficulty)}
              </span>
              {ex.unilateral && (
                <span className="rounded-full border border-line px-2 py-0.5 text-brand">
                  {t('One side at a time')}
                </span>
              )}
              {modeFor(ex) && (
                <span className="rounded-full border border-line px-2 py-0.5 text-brand">
                  {t(modeFor(ex))}
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
            {data.active ? t('Add to workout') : t('Start with this')}
          </Btn>
          <Btn
            variant="soft"
            onClick={() => setNoteOpen(true)}
            icon={<NotebookPen size={15} />}
          >
            {t('Add note')}
          </Btn>
          {last && (
            <Btn
              variant="ghost"
              onClick={() => navigate(`/history/${last.session.id}`)}
              icon={<History size={15} />}
            >
              {t('Last session')}
            </Btn>
          )}
        </div>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        <div>
          <SectionHeader
            title={t('How to perform it')}
            subtitle={
              steps.length
                ? t('{n} steps · {source}', {
                    n: steps.length,
                    source: isCustom
                      ? t('Your instructions')
                      : t('Form guide'),
                  })
                : t('Guide unavailable')
            }
          />
          {steps.length ? (
            <Card className="p-4">
              <ol className="space-y-3">
                {steps.map((s, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand/15 text-[11px] font-black text-brand">
                      {i + 1}
                    </span>
                    <p className="text-sm font-semibold leading-relaxed text-dim">
                      {s}
                    </p>
                  </li>
                ))}
              </ol>
              {tips.length > 0 && (
                <div className="mt-4 rounded-2xl bg-elevated p-3">
                  <p className="text-[10px] font-black uppercase tracking-wider text-mute">
                    {t('Tips')}
                  </p>
                  <ul className="mt-1.5 space-y-1.5">
                    {tips.map((tip, i) => (
                      <li
                        key={i}
                        className="flex gap-2 text-xs font-semibold leading-relaxed text-dim"
                      >
                        <span className="text-brand">•</span> {tip}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="mt-3 text-[10px] font-bold text-mute">
                {isCustom
                  ? t('Your exercise instructions')
                  : t('Form guide')}
                {instr?.url && (
                  <>
                    {' '}
                    ·{' '}
                    <a
                      href={instr.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-brand underline"
                    >
                      {t('Reference')}
                    </a>
                  </>
                )}
              </p>
            </Card>
          ) : (
            <EmptyState
              icon={<BookOpen size={22} />}
              title={t('No form notes yet')}
              body={t('Form guidance is not available for this movement.')}
            />
          )}

          <SectionHeader
            title={t('Your history')}
            subtitle={
              history.length
                ? t('{n} recent sessions', { n: history.length })
                : t('Nothing logged yet')
            }
            action={
              last ? (
                <Link
                  to={`/history/${last.session.id}`}
                  className="text-[11px] font-black text-brand"
                >
                  {t('Open session')}
                </Link>
              ) : undefined
            }
          />
          {history.length ? (
            <Card className="divide-y divide-border overflow-hidden">
              {history.map((h) => {
                const sets = h.ex.sets.filter((s) => s.kind !== 'warmup');
                return (
                  <Link
                    key={h.session.id}
                    to={`/history/${h.session.id}`}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-elevated"
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
                        {t('{n} working sets', { n: sets.length })}
                        {sets.some((s) => s.kind !== 'normal')
                          ? t(' · intensity techniques')
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
              title={t('No history yet')}
              body={t(
                'Log this exercise in a workout to start tracking e1RM and PRs.',
              )}
              action={
                <Btn variant="primary" size="sm" onClick={start}>
                  {t('Train it now')}
                </Btn>
              }
            />
          )}

          {notes.length > 0 && (
            <>
              <SectionHeader
                title={t('Exercise notes')}
                action={
                  <Link
                    to="/notes"
                    className="text-[11px] font-black text-brand"
                  >
                    {t('Journal')}
                  </Link>
                }
              />
              <Card className="divide-y divide-border overflow-hidden">
                {notes.map((n) => (
                  <div key={n.id} className="px-4 py-3">
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase text-mute">
                      <NotebookPen size={11} /> {relativeDay(n.date)} ·{' '}
                      {t(n.kind)}
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
                <p className="label">{t('Personal record')}</p>
                <p className="num mt-1 text-3xl font-black text-accent">
                  {record ? recordValue(record, unit) : '—'}
                </p>
              </div>
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-warn/10 text-warn">
                <Trophy size={20} />
              </div>
            </div>
            {record && (
              <p className="mt-2 text-xs font-bold text-mute">
                {t(recordLabel(record.kind))}
                {record.kind === 'weight' && record.oneRm > 0
                  ? ` · e1RM ${toDisplayWeight(record.oneRm, unit).toFixed(1)} ${unit}`
                  : ''}
              </p>
            )}
            {best && record?.kind === 'weight' ? (
              <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-bold text-mute">
                <span className="rounded-full bg-elevated px-2 py-1">
                  {t('Best set {load}', {
                    load: `${toDisplayWeight(best.set.weight, unit).toFixed(1)} ${unit} × ${best.set.reps}`,
                  })}
                </span>
                <span className="rounded-full bg-elevated px-2 py-1">
                  {relativeDay(dateKey(best.date))}
                </span>
                {best.set.rpe != null && (
                  <span className="rounded-full bg-elevated px-2 py-1">
                    RPE {best.set.rpe}
                  </span>
                )}
              </div>
            ) : !record ? (
              <p className="mt-3 text-xs font-semibold text-mute">
                {t('No records yet. Log a working set to start tracking.')}
              </p>
            ) : null}
          </Card>

          {record?.kind === 'weight' &&
            record.oneRm > 0 &&
            series.length > 1 && (
              <Card className="mt-3 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-black">{t('Estimated 1RM')}</p>
                  <span className="flex items-center gap-1 text-[10px] font-black text-success">
                    <TrendingUp size={12} />{' '}
                    {t('{n} points', { n: series.length })}
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

          <SectionHeader title={t('Muscles')} />
          <Card className="p-4">
            <div className="space-y-2">
              {muscleOptions.map((m) => (
                <div key={m.id} className="flex items-center gap-2">
                  <MuscleDot id={m.id} size={8} />
                  <span className="flex-1 text-xs font-extrabold">
                    {tm(m.id, m.label)}
                  </span>
                  <span className="text-[10px] font-black uppercase text-mute">
                    {m.id === ex.primary ? t('primary') : t('secondary')}
                  </span>
                </div>
              ))}
            </div>
          </Card>

          {related.length > 0 && (
            <>
              <SectionHeader title={t('Similar movements')} />
              <Card className="divide-y divide-border overflow-hidden">
                {related.map((r) => (
                  <Link
                    key={r.id}
                    to={`/library/${r.id}`}
                    className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-elevated"
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
        title={t('Note on {name}', { name: ex.name })}
        footer={
          <div className="flex gap-2">
            <Btn className="flex-1" onClick={() => setNoteOpen(false)}>
              {t('Cancel')}
            </Btn>
            <Btn
              className="flex-1"
              variant="primary"
              onClick={addNote}
              icon={<Plus size={15} />}
            >
              {t('Save note')}
            </Btn>
          </div>
        }
      >
        <textarea
          autoFocus
          className="input min-h-[120px]"
          placeholder={t('Cues that worked, pain to watch, setup notes…')}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <p className="mt-2 text-[11px] font-semibold text-mute">
          {t('Attached to {name} and visible in your journal.', {
            name: ex.name,
          })}
        </p>
      </Sheet>

      {dialogs}
      <Confirm
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => {
          deleteCustomExercise(ex.id);
          toast.push(t('Exercise deleted'));
          navigate('/library');
        }}
        title={t('Delete custom exercise?')}
        body={t(
          'It will be removed from your library and any routines using it. Logged history stays intact.',
        )}
        confirmLabel={t('Delete exercise')}
      />

      {ex.aliases.length > 0 && (
        <p className="mt-6 text-center text-[10px] font-bold text-mute">
          {t('Also known as {names}', { names: ex.aliases.join(', ') })}
        </p>
      )}
    </div>
  );
}
