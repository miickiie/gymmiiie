import {
  Archive,
  BookOpen,
  ChevronRight,
  Filter,
  Plus,
  Search,
  SlidersHorizontal,
  Star,
  X,
} from 'lucide-react';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getLibraryView, saveLibraryView } from '../lib/libraryView';
import { ArtThumb } from '../components/ExerciseArt';
import { ExerciseIcon } from '../components/ExerciseTile';
import {
  Btn,
  Card,
  Chip,
  EmptyState,
  Field,
  PageHeader,
  Segmented,
  Sheet,
  useDebounced,
  useToast,
} from '../components/ui';
import {
  DIFFICULTIES,
  EQUIPMENT,
  exerciseMatchesZone,
  searchExercises,
} from '../lib/exercises';
import { BODY_ZONES, MUSCLES, MUSCLE_LABEL, newId } from '../lib/stats';
import { allExercises, useStore } from '../lib/store';
import type { Exercise, ExerciseMode, LoadKind, MuscleId } from '../types';

type Sort = 'az' | 'muscle';

export default function Library() {
  const navigate = useNavigate();
  const { key } = useLocation();
  const accountId = useStore((s) => s.account?.id);
  const [savedView] = useState(() => getLibraryView(key, accountId));
  const filterStrip = useRef<HTMLDivElement>(null);
  const toast = useToast();
  const data = useStore((s) => s.data);
  const toggleFavorite = useStore((s) => s.toggleFavorite);
  const addCustomExercise = useStore((s) => s.addCustomExercise);
  const [q, setQ] = useState(savedView?.q ?? '');
  const dq = useDebounced(q, 160);
  const [zone, setZone] = useState<string | null>(savedView?.zone ?? null);
  const [muscle, setMuscle] = useState<MuscleId | null>(savedView?.muscle ?? null);
  const [equipment, setEquipment] = useState<string | null>(savedView?.equipment ?? null);
  const [fav, setFav] = useState(savedView?.fav ?? false);
  const [archived, setArchived] = useState(savedView?.archived ?? false);
  const [sort, setSort] = useState<Sort>(savedView?.sort ?? 'az');
  const [limit, setLimit] = useState(savedView?.limit ?? 80);
  const [createOpen, setCreateOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const view = useRef({ q, zone, muscle, equipment, fav, archived, sort, limit });
  view.current = { q, zone, muscle, equipment, fav, archived, sort, limit };

  useLayoutEffect(() => {
    if (savedView) {
      window.scrollTo({ top: savedView.scrollY, behavior: 'instant' as ScrollBehavior });
      if (filterStrip.current) filterStrip.current.scrollLeft = savedView.filterScrollLeft;
    }
    const strip = filterStrip.current;
    return () => {
      saveLibraryView(key, accountId, {
        ...view.current,
        scrollY: window.scrollY,
        filterScrollLeft: strip?.scrollLeft ?? 0,
      });
    };
  }, [key, accountId, savedView]);

  const all = useMemo(() => allExercises(), [data.customExercises]);
  const customIds = new Set(data.customExercises.map((e) => e.id));

  const results = useMemo(() => {
    let list = all.filter((e) =>
      archived ? data.archived.includes(e.id) : !data.archived.includes(e.id),
    );
    if (fav) list = list.filter((e) => data.favorites[e.id]);
    if (zone) list = list.filter((e) => exerciseMatchesZone(e, zone));
    if (muscle)
      list = list.filter(
        (e) => e.primary === muscle || e.secondary.includes(muscle),
      );
    if (equipment) list = list.filter((e) => e.equipment === equipment);
    list = searchExercises(list, dq);
    if (sort === 'az')
      list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    else
      list = [...list].sort(
        (a, b) =>
          a.primary.localeCompare(b.primary) || a.name.localeCompare(b.name),
      );
    return list;
  }, [
    all,
    data.archived,
    data.favorites,
    fav,
    zone,
    muscle,
    equipment,
    dq,
    archived,
    sort,
  ]);

  const clear = () => {
    setQ('');
    setZone(null);
    setMuscle(null);
    setEquipment(null);
    setFav(false);
    setArchived(false);
    setLimit(80);
  };
  const filters = [
    zone,
    muscle,
    equipment,
    fav ? 'favourites' : null,
    archived ? 'archived' : null,
  ].filter(Boolean).length;

  return (
    <div className="page-enter">
      <PageHeader
        eyebrow="Exercise library"
        title="Find your movement"
        subtitle={`${all.length} exercises · ${data.customExercises.length} custom · muscle, equipment and reviewed guides where available`}
        action={
          <Btn
            variant="primary"
            size="sm"
            onClick={() => setCreateOpen(true)}
            icon={<Plus size={15} />}
          >
            Create
          </Btn>
        }
      />

      <div className="sticky top-[57px] z-20 -mx-4 mb-3 border-b border-line bg-[var(--bg)]/90 px-4 pb-2 pt-1 backdrop-blur lg:top-0 lg:mx-0 lg:rounded-2xl lg:border lg:px-2">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-mute"
            />
            <input
              className="input pl-9"
              aria-label="Search exercise library"
              placeholder="Search exercises, muscles, equipment…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            {q && (
              <button
                onClick={() => setQ('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-mute"
              >
                <X size={15} />
              </button>
            )}
          </div>
          <Btn
            variant={filters ? 'primary' : 'soft'}
            size="icon"
            onClick={() => setFiltersOpen(true)}
            aria-label="Filters"
          >
            <SlidersHorizontal size={17} />
          </Btn>
        </div>
      <div ref={filterStrip} className="scroll-x mt-2 pb-1">
          <Chip on={fav} onClick={() => setFav(!fav)}>
            <Star size={12} /> Favourites{' '}
            {Object.keys(data.favorites).length || ''}
          </Chip>
          {Object.keys(BODY_ZONES).map((z) => (
            <Chip
              key={z}
              on={zone === z}
              onClick={() => {
                setZone(zone === z ? null : z);
                setMuscle(null);
              }}
            >
              {z}
            </Chip>
          ))}
          <Chip on={archived} onClick={() => setArchived(!archived)}>
            <Archive size={12} /> Archived
          </Chip>
          {muscle && (
            <Chip on onClick={() => setMuscle(null)}>
              <X size={12} /> {MUSCLE_LABEL[muscle]}
            </Chip>
          )}
        </div>
      </div>

      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-xs font-bold text-mute">
          {results.length} result{results.length === 1 ? '' : 's'}
          {zone ? ` · ${zone}` : ''}
          {muscle ? ` · ${MUSCLE_LABEL[muscle]}` : ''}
          {equipment ? ` · ${equipment}` : ''}
        </p>
        <Segmented
          value={sort}
          onChange={setSort}
          options={[
            { value: 'az', label: 'A–Z' },
            { value: 'muscle', label: 'Muscle' },
          ]}
        />
      </div>

      {results.length ? (
        <>
          <Card className="divide-y divide-[var(--line)] overflow-hidden">
            {results.slice(0, limit).map((ex) => {
              const isFav = !!data.favorites[ex.id];
              return (
                <div
                  key={ex.id}
                  className="flex items-center gap-2 px-3 py-2 hover:bg-[var(--surface-2)]"
                >
                  <button
                    onClick={() => navigate(`/library/${ex.id}`)}
                    aria-label={`View exercise: ${ex.name}`}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    <ArtThumb
                      slug={ex.art}
                      size={44}
                      fallback={<ExerciseIcon ex={ex} size={44} />}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 truncate text-sm font-extrabold">
                        {ex.name}
                        {customIds.has(ex.id) && (
                          <span className="rounded-full bg-[var(--accent-soft)] px-1.5 py-0.5 text-[9px] font-black text-[var(--accent)]">
                            custom
                          </span>
                        )}
                        {data.archived.includes(ex.id) && (
                          <span className="rounded-full bg-[var(--surface-3)] px-1.5 py-0.5 text-[9px] font-black text-mute">
                            archived
                          </span>
                        )}
                      </p>
                      <p className="truncate text-[11px] font-bold text-mute">
                        {MUSCLE_LABEL[ex.primary] ?? ex.primary}
                        {ex.secondary.length
                          ? ` + ${ex.secondary.map((m) => MUSCLE_LABEL[m] ?? m).join(', ')}`
                          : ''}{' '}
                        · {ex.equipment} · {ex.difficulty}
                      </p>
                    </div>
                    <ChevronRight size={16} className="text-mute" />
                  </button>
                  <button
                    onClick={() => {
                      toggleFavorite(ex.id);
                      toast.push(
                        isFav
                          ? 'Removed from favourites'
                          : 'Added to favourites',
                      );
                    }}
                    className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${isFav ? 'text-[var(--warn)]' : 'text-mute hover:bg-[var(--surface-3)]'}`}
                    aria-label={isFav ? 'Remove favourite' : 'Add favourite'}
                  >
                    <Star size={16} fill={isFav ? 'currentColor' : 'none'} />
                  </button>
                </div>
              );
            })}
          </Card>
          {results.length > limit && (
            <div className="mt-3 text-center">
              <Btn onClick={() => setLimit(limit + 80)}>
                Show more ({results.length - limit} left)
              </Btn>
            </div>
          )}
        </>
      ) : (
        <EmptyState
          icon={<BookOpen size={24} />}
          title={archived ? 'Archive is empty' : 'No exercises match'}
          body={
            archived
              ? 'Archived exercises are hidden from the picker. Unarchive one to use it again.'
              : 'Try a different muscle, piece of equipment, or search term. Or create your own movement.'
          }
          action={
            <div className="flex gap-2">
              <Btn onClick={clear}>Clear filters</Btn>
              <Btn variant="primary" onClick={() => setCreateOpen(true)}>
                Create exercise
              </Btn>
            </div>
          }
        />
      )}

      <Sheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title="Filters"
      >
        <div className="space-y-4">
          <div>
            <p className="label mb-2">Muscle</p>
            <div className="flex flex-wrap gap-1.5">
              {MUSCLES.map((m) => (
                <Chip
                  key={m.id}
                  on={muscle === m.id}
                  onClick={() => {
                    setZone(null);
                    setMuscle(muscle === m.id ? null : m.id);
                  }}
                >
                  {m.label}
                </Chip>
              ))}
            </div>
          </div>
          <div>
            <p className="label mb-2">Equipment</p>
            <div className="flex flex-wrap gap-1.5">
              {EQUIPMENT.map((e) => (
                <Chip
                  key={e}
                  on={equipment === e}
                  onClick={() => setEquipment(equipment === e ? null : e)}
                >
                  {e}
                </Chip>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Chip on={fav} onClick={() => setFav(!fav)}>
              <Star size={12} /> Favourites only
            </Chip>
            <Chip on={archived} onClick={() => setArchived(!archived)}>
              <Archive size={12} /> Archived
            </Chip>
          </div>
          <div className="flex gap-2">
            <Btn className="flex-1" onClick={clear}>
              Reset
            </Btn>
            <Btn
              className="flex-1"
              variant="primary"
              onClick={() => setFiltersOpen(false)}
            >
              Show {results.length}
            </Btn>
          </div>
        </div>
      </Sheet>

      <CreateExercise
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={(ex) => {
          addCustomExercise(ex);
          setCreateOpen(false);
          toast.push(`${ex.name} created`, 'good');
          navigate(`/library/${ex.id}`);
        }}
      />
    </div>
  );
}

function CreateExercise({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (ex: Exercise) => void;
}) {
  const [name, setName] = useState('');
  const [primary, setPrimary] = useState<MuscleId>('chest');
  const [secondary, setSecondary] = useState<string[]>([]);
  const [equipment, setEquipment] = useState('Dumbbell');
  const [difficulty, setDifficulty] = useState('Intermediate');
  const [steps, setSteps] = useState('');
  const [mode, setMode] = useState<ExerciseMode>('');
  const [loadKind, setLoadKind] = useState<LoadKind>('external');
  const [error, setError] = useState('');

  const submit = () => {
    if (name.trim().length < 2) {
      setError('Give the exercise a name.');
      return;
    }
    onCreate({
      id: newId('custom-'),
      name: name.trim(),
      primary,
      secondary: secondary.filter((m) => m !== primary),
      equipment,
      difficulty,
      art: '',
      steps: steps
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
      mode,
      loadKind: mode === 'cardio' ? 'none' : loadKind,
      aliases: [],
      kind: 'custom',
    });
    setName('');
    setSteps('');
    setSecondary([]);
    setError('');
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Create exercise"
      footer={
        <Btn
          variant="primary"
          className="w-full"
          onClick={submit}
          icon={<Plus size={16} />}
        >
          Create exercise
        </Btn>
      }
      size="lg"
    >
      <div className="space-y-4">
        <Field label="Exercise name">
          <input
            className="input"
            placeholder="e.g. Cable Y-raise"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError('');
            }}
          />
        </Field>
        {error && (
          <p className="text-xs font-bold text-[var(--bad)]">{error}</p>
        )}
        <div>
          <p className="label mb-2">Primary muscle</p>
          <div className="flex flex-wrap gap-1.5">
            {MUSCLES.map((m) => (
              <Chip
                key={m.id}
                on={primary === m.id}
                onClick={() => setPrimary(m.id)}
              >
                {m.label}
              </Chip>
            ))}
          </div>
        </div>
        <div>
          <p className="label mb-2">Secondary muscles</p>
          <div className="flex flex-wrap gap-1.5">
            {MUSCLES.filter((m) => m.id !== primary).map((m) => (
              <Chip
                key={m.id}
                on={secondary.includes(m.id)}
                onClick={() =>
                  setSecondary((s) =>
                    s.includes(m.id)
                      ? s.filter((x) => x !== m.id)
                      : [...s, m.id],
                  )
                }
              >
                {m.label}
              </Chip>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Equipment">
            <select
              className="input"
              value={equipment}
              onChange={(e) => setEquipment(e.target.value)}
            >
              {EQUIPMENT.map((e) => (
                <option key={e}>{e}</option>
              ))}
            </select>
          </Field>
          <Field label="Difficulty">
            <select
              className="input"
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
            >
              {DIFFICULTIES.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Track by">
            <select
              className="input"
              value={mode}
              onChange={(e) => setMode(e.target.value as ExerciseMode)}
            >
              <option value="">Repetitions</option>
              <option value="time">Time</option>
              <option value="cardio">Distance and time</option>
            </select>
          </Field>
          {mode !== 'cardio' && (
            <Field label="Load type">
              <select
                className="input"
                value={loadKind}
                onChange={(e) => setLoadKind(e.target.value as LoadKind)}
              >
                <option value="external">External weight</option>
                <option value="added">Added bodyweight load</option>
                <option value="assistance">Assistance weight</option>
                <option value="none">No weight</option>
              </select>
            </Field>
          )}
        </div>
        <Field
          label="Execution steps"
          hint="One step per line. These show on the exercise page."
        >
          <textarea
            className="input min-h-[96px]"
            placeholder={'Set up the bench…\nBrace your core…\nPress…'}
            value={steps}
            onChange={(e) => setSteps(e.target.value)}
          />
        </Field>
        <div className="flex items-center gap-2 rounded-xl border border-line bg-[var(--surface-2)] px-3 py-2 text-[11px] font-semibold text-mute">
          <Filter size={13} /> Custom exercises save with your account and work
          offline.
        </div>
      </div>
    </Sheet>
  );
}
