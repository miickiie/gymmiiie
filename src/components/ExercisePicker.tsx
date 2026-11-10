import { useMemo, useState } from 'react';
import { Search, Star, X } from 'lucide-react';
import type { Exercise } from '../types';
import { useStore, allExercises } from '../lib/store';
import { EXERCISES, searchExercises, EQUIPMENT } from '../lib/exercises';
import { BODY_ZONES, MUSCLES } from '../lib/stats';
import { Chip, Sheet } from './ui';
import { ExerciseRow } from './ExerciseTile';

export default function ExercisePicker({ open, onClose, onPick, exclude = [], title = 'Add exercise' }: {
  open: boolean;
  onClose: () => void;
  onPick: (ex: Exercise) => void;
  exclude?: string[];
  title?: string;
}) {
  const data = useStore((s) => s.data);
  const [q, setQ] = useState('');
  const [muscle, setMuscle] = useState<string | null>(null);
  const [equip, setEquip] = useState<string | null>(null);
  const [fav, setFav] = useState(false);

  const all = useMemo(() => allExercises(), [data.customExercises]);
  const results = useMemo(() => {
    let list = all.filter((e) => !exclude.includes(e.id) && !data.archived.includes(e.id));
    if (fav) list = list.filter((e) => data.favorites[e.id]);
    if (muscle) list = list.filter((e) => e.primary === muscle || e.secondary.includes(muscle));
    if (equip) list = list.filter((e) => e.equipment === equip);
    return searchExercises(list, q).slice(0, 80);
  }, [all, q, muscle, equip, fav, exclude, data.archived, data.favorites]);

  return (
    <Sheet open={open} onClose={onClose} title={title} size="lg">
      <div className="sticky top-0 z-10 -mx-5 -mt-4 mb-2 bg-[var(--surface)] px-5 pb-2 pt-4">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-mute" />
          <input autoFocus className="input pl-9" placeholder="Search 466 exercises…" value={q} onChange={(e) => setQ(e.target.value)} />
          {q && <button onClick={() => setQ('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-mute"><X size={15} /></button>}
        </div>
        <div className="scroll-x mt-2 pb-1">
          <Chip on={fav} onClick={() => setFav(!fav)}><Star size={12} /> Favourites</Chip>
          {Object.keys(BODY_ZONES).map((z) => (
            <Chip key={z} on={muscle != null && BODY_ZONES[z].includes(muscle as never)} onClick={() => setMuscle(muscle && BODY_ZONES[z].includes(muscle as never) ? null : BODY_ZONES[z][0])}>{z}</Chip>
          ))}
          {muscle && <Chip on onClick={() => setMuscle(null)}><X size={12} /> {MUSCLES.find((m) => m.id === muscle)?.label}</Chip>}
        </div>
        <div className="scroll-x pb-1">
          {['Barbell', 'Dumbbell', 'Machine', 'Cable', 'Bodyweight', 'Band', 'Kettlebell'].map((e) => (
            <Chip key={e} on={equip === e} onClick={() => setEquip(equip === e ? null : e)}>{e}</Chip>
          ))}
        </div>
      </div>
      <div className="space-y-0.5">
        {results.map((ex) => (
          <ExerciseRow
            key={ex.id}
            ex={ex}
            onClick={() => { onPick(ex); onClose(); }}
            right={<span className="rounded-full bg-[var(--surface-2)] px-2 py-1 text-[10px] font-black text-mute">{ex.difficulty}</span>}
          />
        ))}
        {!results.length && <p className="py-10 text-center text-sm font-semibold text-mute">No exercises match those filters.</p>}
      </div>
    </Sheet>
  );
}

export { EXERCISES, EQUIPMENT };
