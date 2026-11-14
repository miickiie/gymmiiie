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
import { fmtDate, fmtDuration, fmtTime, sessionTrainingDate } from '../lib/date';
import { EXERCISES } from '../lib/exercises';
import { useI18n } from '../lib/i18n';
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

const TH: Record<string, string> = {
  'Workout not found': 'ไม่พบการฝึก',
  'It may have been deleted, or the link is incomplete.':
    'อาจถูกลบไปแล้ว หรือลิงก์ไม่ครบ',
  'Back to history': 'กลับไปประวัติ',
  'Gymmiie · {name}': 'Gymmiie · {name}',
  'Gymmiie workout': 'การฝึก Gymmiie',
  'warm-up:': 'วอร์มอัป:',
  'Workout copied to clipboard': 'คัดลอกการฝึกแล้ว',
  'Could not share': 'แชร์ไม่สำเร็จ',
  'Workout deleted': 'ลบการฝึกแล้ว',
  'started {time}': 'เริ่ม {time}',
  'finished {time}': 'จบ {time}',
  '{n} total sets': 'รวม {n} เซ็ต',
  'Working sets': 'เซ็ตฝึกจริง',
  'excluding warm-ups': 'ไม่รวมวอร์มอัป',
  '{n} new PR': 'PR ใหม่ {n} รายการ',
  '{n} new PRs': 'PR ใหม่ {n} รายการ',
  'no new PRs': 'ไม่มี PR ใหม่',
  'Repeat workout': 'ฝึกซ้ำ',
  'Copy / share': 'คัดลอก / แชร์',
  'Session note': 'โน้ตการฝึก',
  '{m} · {n} sets': '{m} · {n} เซ็ต',
  '{unit} vol': '{unit} ปริมาณ',
  'SESSION RECAP': 'สรุปการฝึก',
  'You trained {muscles} for {dur} and moved {vol}.':
    'คุณฝึก {muscles} นาน {dur} และยกไป {vol}',
  'No sets were recorded in this session.': 'ไม่มีเซ็ตที่บันทึกไว้ในการฝึกครั้งนี้',
  '{name} routine': 'ตารางฝึก {name}',
  'Delete workout?': 'ลบการฝึกนี้?',
  'This permanently removes the session from history and all progress calculations.':
    'การฝึกครั้งนี้จะถูกลบออกจากประวัติและการคำนวณความก้าวหน้าทั้งหมดอย่างถาวร',
  'Delete workout': 'ลบการฝึก',
  'Share workout': 'แชร์การฝึก',
  '{n} exercises · {sets} working sets · {vol} volume':
    '{n} ท่า · {sets} เซ็ตทำงาน · ปริมาณ {vol}',
  Delete: 'ลบ',
  Duration: 'ระยะเวลา',
  Exercises: 'ท่าออกกำลัง',
  Volume: 'ปริมาณการฝึก',
  Workout: 'การฝึก',
};

export default function SessionDetail() {
  const { t, tm } = useI18n(TH);
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
        ? data.sessions.filter((s) => new Date(sessionTrainingDate(s)) < new Date(sessionTrainingDate(session)))
        : [],
    [data.sessions, session],
  );

  if (!session) {
    return (
      <EmptyState
        icon={<CalendarDays size={24} />}
        title={t('Workout not found')}
        body={t('It may have been deleted, or the link is incomplete.')}
        action={
          <Btn variant="primary" onClick={() => navigate('/history')}>
            {t('Back to history')}
          </Btn>
        }
      />
    );
  }

  const d = new Date(sessionTrainingDate(session));
  const routine = data.routines.find((r) => r.id === session.routineId);
  const prs = sessionPRCount(session, prior);
  const volume = sessionVolume(session);
  const sets = sessionSets(session);

  const shareText = [
    t('Gymmiie · {name}', {
      name: session.name || routine?.name || t('Workout'),
    }),
    `${fmtDate(d, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · ${fmtDuration(session.durationSec)}`,
    t('{n} exercises · {sets} working sets · {vol} volume', {
      n: session.exercises.length,
      sets,
      vol: volumeLabel(volume, unit),
    }),
    '',
    ...session.exercises.map(
      (e) =>
        `${e.name}\n${e.sets.map((s) => (s.kind === 'warmup' ? `  ${t('warm-up:')} ${formatLoggedSet(s, e, unit)}` : `  ${formatLoggedSet(s, e, unit)}`)).join('\n')}`,
    ),
  ].join('\n');

  const share = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: session.name || t('Gymmiie workout'),
          text: shareText,
        });
      } else {
        await navigator.clipboard.writeText(shareText);
        toast.push(t('Workout copied to clipboard'), 'good');
      }
    } catch {
      toast.push(t('Could not share'), 'bad');
    }
  };

  const repeat = () => {
    requestStart(() => startFromSession(session.id));
  };

  const remove = () => {
    deleteSession(session.id);
    toast.push(t('Workout deleted'));
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
              t('Workout')}
          </h1>
        </div>
        <button
          onClick={share}
          className="grid h-9 w-9 place-items-center rounded-full bg-[var(--surface-2)] text-dim"
          title={t('Share workout')}
        >
          <Share2 size={17} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          {
            label: t('Duration'),
            value: fmtDuration(session.durationSec),
            icon: <Clock size={14} />,
            sub: t(session.startedAt ? 'started {time}' : 'finished {time}', {
              time: fmtTime(d),
            }),
          },
          {
            label: t('Exercises'),
            value: String(session.exercises.length),
            icon: <Dumbbell size={14} />,
            sub: t('{n} total sets', {
              n: session.exercises.reduce((n, e) => n + e.sets.length, 0),
            }),
          },
          {
            label: t('Working sets'),
            value: String(sets),
            icon: <TrendingUp size={14} />,
            sub: t('excluding warm-ups'),
          },
          {
            label: t('Volume'),
            value: volumeLabel(volume, unit),
            icon: <Flame size={14} />,
            sub: prs
              ? t(prs === 1 ? '{n} new PR' : '{n} new PRs', { n: prs })
              : t('no new PRs'),
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
          {t('Repeat workout')}
        </Btn>
        <Btn onClick={share} icon={<Copy size={15} />}>
          {t('Copy / share')}
        </Btn>
        <Btn
          variant="ghost"
          onClick={() => setConfirmDelete(true)}
          icon={<Trash2 size={15} />}
        >
          {t('Delete')}
        </Btn>
        {prs > 0 && (
          <span className="ml-auto flex items-center gap-1 rounded-full bg-[var(--warn)]/15 px-3 py-1.5 text-xs font-black text-[var(--warn)]">
            <Trophy size={14} /> {prs} PR{prs === 1 ? '' : 's'}
          </span>
        )}
      </div>

      {session.note && (
        <Card className="mt-4 p-4">
          <p className="label mb-1">{t('Session note')}</p>
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
                  {t('{m} · {n} sets', {
                    m: tm(ex.primary, MUSCLE_LABEL[ex.primary] ?? ex.primary),
                    n: ex.sets.length,
                  })}
                </p>
              </div>
              <div className="text-right">
                <p className="num text-sm font-black">
                  {Math.round(
                    toDisplayWeight(exerciseVolume(ex), unit),
                  ).toLocaleString()}
                </p>
                <p className="text-[9px] font-black uppercase text-mute">
                  {t('{unit} vol', { unit })}
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
          <Timer size={13} /> {t('SESSION RECAP')}
        </div>
        <p className="mt-1 text-sm font-semibold text-dim">
          {session.exercises.length
            ? t('You trained {muscles} for {dur} and moved {vol}.', {
                muscles: [
                  ...new Set(
                    session.exercises.map((e) =>
                      tm(e.primary, MUSCLE_LABEL[e.primary] ?? e.primary),
                    ),
                  ),
                ].join(', '),
                dur: fmtDuration(session.durationSec),
                vol: volumeLabel(volume, unit),
              })
            : t('No sets were recorded in this session.')}
        </p>
        {routine && (
          <Link
            to={`/routines/${routine.id}`}
            className="mt-2 inline-flex items-center gap-1 text-[11px] font-black text-[var(--accent)]"
          >
            <CalendarDays size={12} />{' '}
            {t('{name} routine', { name: routine.name })}
          </Link>
        )}
      </div>

      {dialogs}
      <Confirm
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={remove}
        title={t('Delete workout?')}
        body={t(
          'This permanently removes the session from history and all progress calculations.',
        )}
        confirmLabel={t('Delete workout')}
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
    kind: 'custom',
  };
}
