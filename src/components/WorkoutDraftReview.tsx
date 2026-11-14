import { ArrowDown, ArrowUp, BookOpen, Plus, RotateCcw, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { AiWorkoutPlan } from '../../shared/ai-workout';
import { AI_WORKOUT_LIMITS } from '../../shared/ai-workout';
import { AI_WORKOUT_TH } from '../lib/ai-workout';
import { openingSets } from '../lib/exercises';
import { useI18n } from '../lib/i18n';
import { lastSetsFor, MUSCLE_LABEL, toDisplayWeight } from '../lib/stats';
import { allExercises, useStore } from '../lib/store';
import type { Exercise } from '../types';
import { ArtThumb } from './ExerciseArt';
import { ExerciseGuide } from './ExerciseGuide';
import ExercisePicker from './ExercisePicker';
import { ExerciseIcon } from './ExerciseTile';
import { Btn, Card, Chip, SectionHeader } from './ui';

const WARMUP_IDS = ['jumping-jack', 'cat-cow-stretch', 'leg-swings-stretch', 'band-pull-apart'];
const isWarmup = (exercise: Exercise): boolean => exercise.kind === 'mobility' || WARMUP_IDS.includes(exercise.id);

export default function WorkoutDraftReview({ draft, selectedMuscles, onChange }: {
  draft: AiWorkoutPlan; selectedMuscles: string[]; onChange: (draft: AiWorkoutPlan) => void;
}) {
  const { t, tm } = useI18n(AI_WORKOUT_TH);
  const data = useStore(state => state.data);
  const all = useMemo(() => allExercises(), [data.customExercises]);
  const [picker, setPicker] = useState<'add' | string | null>(null);
  const [guide, setGuide] = useState<Exercise | null>(null);
  const uncovered = selectedMuscles.filter(muscle => !draft.items.some(item => { const exercise = all.find(exercise => exercise.id === item.exerciseId); return exercise && !isWarmup(exercise) && exercise.primary === muscle; }));
  const move = (from: number, to: number): void => {
    if (to < 0 || to >= draft.items.length) return;
    const items = [...draft.items];
    const [item] = items.splice(from, 1);
    items.splice(to, 0, item);
    onChange({ ...draft, items });
  };
  return <div className="space-y-3">
    <Card className="p-4">
      <div className="flex flex-wrap gap-2">{selectedMuscles.map(muscle => <Chip key={muscle} on>{tm(muscle, MUSCLE_LABEL[muscle] ?? muscle)}</Chip>)}</div>
      {uncovered.length > 0 && <p role="status" className="mt-3 text-sm font-bold text-[var(--warn)]">{t('No primary movement for {muscles}. Add an exercise or change the focus.', { muscles: uncovered.map(muscle => tm(muscle, MUSCLE_LABEL[muscle] ?? muscle)).join(', ') })}</p>}
      <p className="mt-3 text-xs text-dim">{t('Previous working sets; adjust when workout starts.')}</p>
    </Card>
    {draft.mode === 'routine' && <label className="block text-sm font-bold">{t('Routine name')}<input className="mt-1 w-full rounded-xl border border-line bg-[var(--bg)] p-3" value={draft.name ?? ''} maxLength={AI_WORKOUT_LIMITS.name} onChange={event => onChange({ ...draft, name: event.target.value })} /></label>}
    <SectionHeader title={t('Exercises')} action={<Btn size="sm" icon={<Plus size={15} />} onClick={() => setPicker('add')}>{t('Add exercise')}</Btn>} />
    {!draft.items.length && <p role="status">{t('No exercises selected')}</p>}
    {draft.items.map((item, index) => {
      const exercise = all.find(exercise => exercise.id === item.exerciseId);
      if (!exercise) return null;
      const sets = openingSets(exercise, data.sessions, data.settings.unit, item.sets, 10, false);
      const hasHistory = lastSetsFor(data.sessions, exercise.id).length > 0;
      return <Card key={item.exerciseId} className="p-3">
        <div className="flex items-center gap-3">
          <span className="text-xs text-mute">{index + 1}</span>
          <ArtThumb slug={exercise.art} size={40} fallback={<ExerciseIcon ex={exercise} size={40} />} />
          <div className="min-w-0 flex-1"><button type="button" className="text-left text-sm font-black" onClick={() => setGuide(exercise)}>{exercise.name}</button><p className="text-xs text-mute">{tm(exercise.primary, MUSCLE_LABEL[exercise.primary] ?? exercise.primary)} · {t(exercise.equipment)}</p>{isWarmup(exercise) && <span className="text-xs text-[var(--warn)]">{t('Warm-up / mobility')}</span>}</div>
        </div>
        {item.reason && <p className="mt-2 text-sm text-dim">{item.reason}</p>}
        <p className="mt-2 text-xs text-mute" data-testid={`starting-sets-${exercise.id}`}>
          {hasHistory ? sets.map(set => exercise.mode === 'cardio' ? `${set.sec ?? 0}s / ${set.km ?? 0}km` : `${exercise.mode === 'time' ? `${set.sec ?? 0}s` : `${set.reps}${set.repsR !== undefined ? `/${set.repsR}` : ''}`} × ${Number(toDisplayWeight(set.weight, data.settings.unit).toFixed(2))} ${data.settings.unit}`).join(' · ') : t('No working-set history; existing defaults will be used.')}
        </p>
        {draft.mode === 'routine' && <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="text-xs font-bold">{t('Sets')}<input aria-label={`${t('Sets')} · ${exercise.name}`} type="number" min={1} max={12} step={1} value={item.sets ?? 3} className="mt-1 w-full rounded-lg border border-line bg-[var(--bg)] p-2" onChange={event => { const value = event.target.valueAsNumber; if (Number.isInteger(value) && value >= 1 && value <= 12) onChange({ ...draft, items: draft.items.map((other, i) => i === index ? { ...other, sets: value } : other) }); }} /></label>
          <label className="text-xs font-bold">{t('Rest (seconds)')}<input aria-label={`${t('Rest (seconds)')} · ${exercise.name}`} type="number" min={0} max={600} step={15} value={item.restSeconds ?? 90} className="mt-1 w-full rounded-lg border border-line bg-[var(--bg)] p-2" onChange={event => { const value = event.target.valueAsNumber; if (Number.isInteger(value) && value >= 0 && value <= 600 && value % 15 === 0) onChange({ ...draft, items: draft.items.map((other, i) => i === index ? { ...other, restSeconds: value } : other) }); }} /></label>
        </div>}
        <div className="mt-2 flex flex-wrap justify-end gap-1">
          <Btn size="sm" icon={<BookOpen size={14} />} aria-label={t('Form guide · {name}', { name: exercise.name })} onClick={() => setGuide(exercise)}>{t('Form guide')}</Btn>
          <Btn size="icon" disabled={index === 0} aria-label={t('Move {name} up', { name: exercise.name })} onClick={() => move(index, index - 1)}><ArrowUp size={16} /></Btn>
          <Btn size="icon" disabled={index === draft.items.length - 1} aria-label={t('Move {name} down', { name: exercise.name })} onClick={() => move(index, index + 1)}><ArrowDown size={16} /></Btn>
          <Btn size="sm" icon={<RotateCcw size={14} />} onClick={() => setPicker(exercise.id)}>{t('Replace')}</Btn>
          <Btn size="icon" aria-label={t('Remove {name}', { name: exercise.name })} onClick={() => onChange({ ...draft, items: draft.items.filter((_, i) => i !== index) })}><X size={16} /></Btn>
        </div>
      </Card>;
    })}
    <ExercisePicker open={picker !== null} title={picker === 'add' ? t('Add exercise') : t('Replace exercise')} onClose={() => setPicker(null)} exclude={draft.items.map(item => item.exerciseId)} onPick={exercise => {
      const item = { exerciseId: exercise.id, reason: '', ...(draft.mode === 'routine' ? { sets: 3, restSeconds: Math.min(600, Math.max(0, Math.round(data.settings.restSec / 15) * 15)) } : {}) };
      onChange({ ...draft, items: picker === 'add' ? [...draft.items, item] : draft.items.map(existing => existing.exerciseId === picker ? item : existing) });
      setPicker(null);
    }} />
    <ExerciseGuide exercise={guide} open={guide !== null} onClose={() => setGuide(null)} />
  </div>;
}
