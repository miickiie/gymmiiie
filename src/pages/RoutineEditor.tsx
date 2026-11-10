import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowDown, ArrowLeft, ArrowUp, Check, Clock, Dumbbell, GripVertical, Moon, Play, Plus,
  Save, Trash2, X,
} from 'lucide-react';
import { allExercises, useStore } from '../lib/store';
import { Btn, Card, Confirm, EmptyState, Field, PageHeader, SectionHeader, Stepper, useToast } from '../components/ui';
import ExercisePicker from '../components/ExercisePicker';
import { ExerciseIcon, MuscleDot } from '../components/ExerciseTile';
import { ArtThumb } from '../components/ExerciseArt';
import { MUSCLE_LABEL } from '../lib/stats';

const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function RoutineEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const data = useStore((s) => s.data);
  const updateRoutine = useStore((s) => s.updateRoutine);
  const deleteRoutine = useStore((s) => s.deleteRoutine);
  const startFromRoutine = useStore((s) => s.startFromRoutine);
  const setWeekPlan = useStore((s) => s.setWeekPlan);
  const [picker, setPicker] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const routine = data.routines.find((r) => r.id === id);
  const all = useMemo(() => allExercises(), [data.customExercises]);

  if (!routine) {
    return <EmptyState icon={<Dumbbell size={24} />} title="Routine not found" body="It may have been deleted." action={<Btn variant="primary" onClick={() => navigate('/routines')}>Back to routines</Btn>} />;
  }

  const totalSets = routine.exerciseIds.reduce((n, eid) => n + (routine.sets[eid] ?? 3), 0);
  const planned = Object.entries(data.weekPlan).filter(([, rid]) => rid === routine.id).map(([d]) => Number(d));

  const patch = (p: Parameters<typeof updateRoutine>[1]) => updateRoutine(routine.id, p);

  const addExercise = (exId: string) => {
    if (routine.exerciseIds.includes(exId)) return;
    patch({
      exerciseIds: [...routine.exerciseIds, exId],
      sets: { ...routine.sets, [exId]: 3 },
      rest: { ...routine.rest, [exId]: data.settings.restSec },
    });
  };

  const remove = (exId: string) => {
    const sets = { ...routine.sets };
    const rest = { ...routine.rest };
    delete sets[exId];
    delete rest[exId];
    patch({ exerciseIds: routine.exerciseIds.filter((x) => x !== exId), sets, rest });
  };

  const move = (from: number, to: number) => {
    if (to < 0 || to >= routine.exerciseIds.length) return;
    const ids = [...routine.exerciseIds];
    const [item] = ids.splice(from, 1);
    ids.splice(to, 0, item);
    patch({ exerciseIds: ids });
  };

  const start = () => {
    if (data.active) { toast.push('Finish or discard the active workout first', 'bad'); return; }
    if (!routine.exerciseIds.length) { toast.push('Add at least one exercise', 'bad'); return; }
    startFromRoutine(routine.id);
    navigate('/session');
  };

  return (
    <div className="page-enter">
      <div className="mb-3 flex items-center gap-2">
        <button onClick={() => navigate('/routines')} className="grid h-9 w-9 place-items-center rounded-full bg-[var(--surface-2)] text-dim"><ArrowLeft size={18} /></button>
        <p className="label">Routine editor</p>
        <span className="ml-auto flex items-center gap-1 text-[10px] font-black text-[var(--good)]"><Check size={12} /> saved locally</span>
      </div>

      <Card className="p-4">
        <div className="grid gap-3 sm:grid-cols-[1.5fr_1fr]">
          <Field label="Routine name">
            <input className="input" value={routine.name} onChange={(e) => patch({ name: e.target.value })} placeholder="Push day, Legs, Upper…" />
          </Field>
          <Field label="Group (optional)" hint="e.g. PPL, Arnold, Rehab">
            <input className="input" value={routine.group ?? ''} onChange={(e) => patch({ group: e.target.value })} placeholder="Split name" />
          </Field>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-[var(--surface-2)] px-2.5 py-1 text-[10px] font-black text-mute">{routine.exerciseIds.length} exercises</span>
          <span className="rounded-full bg-[var(--surface-2)] px-2.5 py-1 text-[10px] font-black text-mute">{totalSets} sets</span>
          <span className="rounded-full bg-[var(--surface-2)] px-2.5 py-1 text-[10px] font-black text-mute">~{Math.round(totalSets * 3.2)} min</span>
          <div className="ml-auto flex gap-2">
            <Btn variant="primary" size="sm" onClick={start} disabled={!routine.exerciseIds.length} icon={<Play size={14} />}>Start</Btn>
            <Btn variant="ghost" size="sm" onClick={() => setConfirmDelete(true)} icon={<Trash2 size={14} />}>Delete</Btn>
          </div>
        </div>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <SectionHeader
            title="Exercises"
            subtitle={routine.exerciseIds.length ? 'Sets and rest are saved as you edit' : 'Add movements from the library'}
            action={<Btn size="sm" onClick={() => setPicker(true)} icon={<Plus size={14} />}>Add</Btn>}
          />
          {routine.exerciseIds.length ? (
            <div className="space-y-2">
              {routine.exerciseIds.map((exId, i) => {
                const ex = all.find((e) => e.id === exId);
                if (!ex) return null;
                return (
                  <Card key={exId} className="p-3">
                    <div className="flex items-center gap-2.5">
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--surface-2)] text-[10px] font-black text-mute">{i + 1}</span>
                      <ArtThumb slug={ex.art} size={40} fallback={<ExerciseIcon ex={ex} size={40} />} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-extrabold">{ex.name}</p>
                        <p className="flex items-center gap-1 text-[10px] font-bold text-mute"><MuscleDot id={ex.primary} size={5} /> {MUSCLE_LABEL[ex.primary] ?? ex.primary} · {ex.equipment}</p>
                      </div>
                      <div className="flex shrink-0 gap-0.5">
                        <button disabled={i === 0} onClick={() => move(i, i - 1)} className="grid h-7 w-7 place-items-center rounded-lg text-mute disabled:opacity-25"><ArrowUp size={14} /></button>
                        <button disabled={i === routine.exerciseIds.length - 1} onClick={() => move(i, i + 1)} className="grid h-7 w-7 place-items-center rounded-lg text-mute disabled:opacity-25"><ArrowDown size={14} /></button>
                        <button onClick={() => remove(exId)} className="grid h-7 w-7 place-items-center rounded-lg text-mute hover:text-[var(--bad)]"><X size={14} /></button>
                      </div>
                    </div>
                    <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-line pt-2.5">
                      <span className="text-[10px] font-black uppercase text-mute">Sets</span>
                      <Stepper value={routine.sets[exId] ?? 3} onChange={(v) => patch({ sets: { ...routine.sets, [exId]: Math.max(1, v) } })} min={1} max={12} />
                      <span className="ml-2 flex items-center gap-1 text-[10px] font-black uppercase text-mute"><Clock size={11} /> Rest</span>
                      <Stepper
                        value={routine.rest[exId] ?? data.settings.restSec}
                        onChange={(v) => patch({ rest: { ...routine.rest, [exId]: Math.max(0, v) } })}
                        min={0}
                        max={600}
                        step={15}
                        unit="s"
                      />
                    </div>
                  </Card>
                );
              })}
              <button onClick={() => setPicker(true)} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-line py-3 text-xs font-black text-mute hover:border-strong hover:text-dim">
                <Plus size={15} /> Add exercise
              </button>
            </div>
          ) : (
            <EmptyState icon={<Dumbbell size={24} />} title="No exercises yet" body="Add the movements you want this routine to include." action={<Btn variant="primary" onClick={() => setPicker(true)} icon={<Plus size={15} />}>Add exercise</Btn>} />
          )}
        </div>

        <div>
          <SectionHeader title="Schedule" subtitle="Tap days to plan this routine" />
          <Card className="p-4">
            <div className="grid grid-cols-7 gap-1.5">
              {DAY_SHORT.map((d, day) => {
                const on = planned.includes(day);
                return (
                  <button
                    key={d}
                    onClick={() => setWeekPlan(day, on ? null : routine.id)}
                    className={`flex flex-col items-center gap-1 rounded-xl border px-1 py-2 text-[10px] font-black uppercase transition ${on ? 'border-[var(--accent-line)] bg-[var(--accent-soft)] text-[var(--accent)]' : 'border-line bg-[var(--surface-2)] text-mute hover:border-strong'}`}
                  >
                    {on ? <Check size={13} /> : <Moon size={13} />}
                    {d}
                  </button>
                );
              })}
            </div>
            <p className="mt-3 text-[11px] font-semibold text-mute">Scheduled days show on Today and Train. Only one routine per weekday.</p>
          </Card>

          <SectionHeader title="Routine tips" />
          <Card className="space-y-3 p-4 text-xs font-semibold text-dim">
            <div className="flex gap-2"><GripVertical size={15} className="mt-0.5 shrink-0 text-mute" /><p>Order matters: big compound lifts first, isolation and finishers later.</p></div>
            <div className="flex gap-2"><Save size={15} className="mt-0.5 shrink-0 text-mute" /><p>Everything autosaves to this device. Use export in Settings for a backup.</p></div>
            <div className="flex gap-2"><Play size={15} className="mt-0.5 shrink-0 text-mute" /><p>Starting the routine pre-fills sets from your last workout and adds warm-ups.</p></div>
          </Card>

          {routine.exerciseIds.length > 0 && (
            <Card className="mt-3 p-4">
              <p className="label mb-2">Session preview</p>
              <div className="space-y-1">
                {routine.exerciseIds.map((eid, i) => {
                  const ex = all.find((e) => e.id === eid);
                  if (!ex) return null;
                  return (
                    <div key={eid} className="flex items-center gap-2">
                      <span className="w-4 text-[10px] font-black text-mute">{i + 1}</span>
                      <span className="min-w-0 flex-1 truncate text-[11px] font-bold">{ex.name}</span>
                      <span className="text-[10px] font-black text-mute">{routine.sets[eid] ?? 3} × {routine.rest[eid] ?? data.settings.restSec}s</span>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </div>
      </div>

      <ExercisePicker open={picker} onClose={() => setPicker(false)} onPick={(ex) => addExercise(ex.id)} exclude={routine.exerciseIds} title="Add to routine" />

      <Confirm
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => { deleteRoutine(routine.id); toast.push('Routine deleted'); navigate('/routines'); }}
        title="Delete routine?"
        body={`“${routine.name}” will be deleted and removed from the weekly plan. History is untouched.`}
        confirmLabel="Delete routine"
      />
    </div>
  );
}
