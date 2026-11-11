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
import { useI18n } from '../lib/i18n';
import type { Exercise, ExerciseMode, LoadKind, MuscleId } from '../types';

type Sort = 'az' | 'muscle';

const TH: Record<string, string> = {
  'Exercise library': 'คลังท่าออกกำลัง',
  'Find your movement': 'หาท่าที่ใช่',
  '{n} exercises · {n2} custom · muscle, equipment and reviewed guides where available':
    '{n} ท่า · {n2} ท่าที่สร้างเอง · เลือกตามกล้ามเนื้อ อุปกรณ์ พร้อมคู่มือที่ตรวจแล้ว',
  Create: 'สร้าง',
  'Search exercise library': 'ค้นหาคลังท่าออกกำลัง',
  'Search exercises, muscles, equipment…': 'ค้นหาท่า กล้ามเนื้อ อุปกรณ์…',
  Filters: 'ตัวกรอง',
  Favourites: 'รายการโปรด',
  Archived: 'เก็บถาวร',
  '{n} result': '{n} รายการ',
  '{n} results': '{n} รายการ',
  Muscle: 'กล้ามเนื้อ',
  'View exercise: {name}': 'ดูท่า: {name}',
  custom: 'กำหนดเอง',
  archived: 'เก็บถาวร',
  'Removed from favourites': 'นำออกจากรายการโปรดแล้ว',
  'Added to favourites': 'เพิ่มในรายการโปรดแล้ว',
  'Remove favourite': 'นำออกจากรายการโปรด',
  'Add favourite': 'เพิ่มในรายการโปรด',
  'Show more ({n} left)': 'แสดงเพิ่ม ({n} ที่เหลือ)',
  'Archive is empty': 'ยังไม่มีรายการเก็บถาวร',
  'No exercises match': 'ไม่พบท่าที่ตรงกัน',
  'Archived exercises are hidden from the picker. Unarchive one to use it again.':
    'ท่าที่เก็บถาวรจะถูกซ่อนจากหน้าตัวเลือก ยกเลิกการเก็บถาวรเพื่อใช้ท่าอีกครั้ง',
  'Try a different muscle, piece of equipment, or search term. Or create your own movement.':
    'ลองเปลี่ยนกล้ามเนื้อ อุปกรณ์ หรือคำค้นหา หรือสร้างท่าของคุณเอง',
  'Clear filters': 'ล้างตัวกรอง',
  'Create exercise': 'สร้างท่า',
  'Favourites only': 'เฉพาะรายการโปรด',
  Reset: 'รีเซ็ต',
  'Show {n}': 'แสดง {n}',
  Equipment: 'อุปกรณ์',
  '{name} created': 'สร้าง {name} แล้ว',
  'Give the exercise a name.': 'ตั้งชื่อท่าก่อน',
  'Exercise name': 'ชื่อท่า',
  'e.g. Cable Y-raise': 'เช่น Cable Y-raise',
  'Primary muscle': 'กล้ามเนื้อหลัก',
  'Secondary muscles': 'กล้ามเนื้อรอง',
  Difficulty: 'ระดับความยาก',
  'Track by': 'วัดผลด้วย',
  Repetitions: 'จำนวนครั้ง',
  Time: 'เวลา',
  'Distance and time': 'ระยะทางและเวลา',
  'Load type': 'ประเภทน้ำหนัก',
  'External weight': 'น้ำหนักภายนอก',
  'Added bodyweight load': 'น้ำหนักที่เพิ่มจากตัว',
  'Assistance weight': 'น้ำหนักช่วย',
  'No weight': 'ไม่มีน้ำหนัก',
  'Execution steps': 'ขั้นตอนการทำ',
  'One step per line. These show on the exercise page.':
    'หนึ่งขั้นตอนต่อหนึ่งบรรทัด จะแสดงในหน้าท่า',
  'Set up the bench…\nBrace your core…\nPress…':
    'ตั้งม้านั่ง…\nเกร็งแกนกลางลำตัว…\nดัน…',
  'Custom exercises save with your account and work offline.':
    'ท่าที่สร้างเองจะบันทึกกับบัญชีและใช้ได้แบบออฟไลน์',
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
  Chest: 'อก',
  Back: 'หลัง',
  Shoulders: 'ไหล่',
  Arms: 'แขน',
  Core: 'แกนกลาง',
  Legs: 'ขา',
};

export default function Library() {
  const { t, tm } = useI18n(TH);
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
        eyebrow={t('Exercise library')}
        title={t('Find your movement')}
        subtitle={t(
          '{n} exercises · {n2} custom · muscle, equipment and reviewed guides where available',
          { n: all.length, n2: data.customExercises.length },
        )}
        action={
          <Btn
            variant="primary"
            size="sm"
            onClick={() => setCreateOpen(true)}
            icon={<Plus size={15} />}
          >
            {t('Create')}
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
              aria-label={t('Search exercise library')}
              placeholder={t('Search exercises, muscles, equipment…')}
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
            aria-label={t('Filters')}
          >
            <SlidersHorizontal size={17} />
          </Btn>
        </div>
      <div ref={filterStrip} className="scroll-x mt-2 pb-1">
          <Chip on={fav} onClick={() => setFav(!fav)}>
            <Star size={12} /> {t('Favourites')}{' '}
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
              {t(z)}
            </Chip>
          ))}
          <Chip on={archived} onClick={() => setArchived(!archived)}>
            <Archive size={12} /> {t('Archived')}
          </Chip>
          {muscle && (
            <Chip on onClick={() => setMuscle(null)}>
              <X size={12} /> {tm(muscle, MUSCLE_LABEL[muscle])}
            </Chip>
          )}
        </div>
      </div>

      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-xs font-bold text-mute">
          {results.length === 1
            ? t('{n} result', { n: results.length })
            : t('{n} results', { n: results.length })}
          {zone ? ` · ${t(zone)}` : ''}
          {muscle ? ` · ${tm(muscle, MUSCLE_LABEL[muscle])}` : ''}
          {equipment ? ` · ${t(equipment)}` : ''}
        </p>
        <Segmented
          value={sort}
          onChange={setSort}
          options={[
            { value: 'az', label: 'A–Z' },
            { value: 'muscle', label: t('Muscle') },
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
                    aria-label={t('View exercise: {name}', { name: ex.name })}
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
                            {t('custom')}
                          </span>
                        )}
                        {data.archived.includes(ex.id) && (
                          <span className="rounded-full bg-[var(--surface-3)] px-1.5 py-0.5 text-[9px] font-black text-mute">
                            {t('archived')}
                          </span>
                        )}
                      </p>
                      <p className="truncate text-[11px] font-bold text-mute">
                        {tm(ex.primary, MUSCLE_LABEL[ex.primary] ?? ex.primary)}
                        {ex.secondary.length
                          ? ` + ${ex.secondary
                              .map((m) => tm(m, MUSCLE_LABEL[m] ?? m))
                              .join(', ')}`
                          : ''}{' '}
                        · {t(ex.equipment)} · {t(ex.difficulty)}
                      </p>
                    </div>
                    <ChevronRight size={16} className="text-mute" />
                  </button>
                  <button
                    onClick={() => {
                      toggleFavorite(ex.id);
                      toast.push(
                        isFav
                          ? t('Removed from favourites')
                          : t('Added to favourites'),
                      );
                    }}
                    className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${isFav ? 'text-[var(--warn)]' : 'text-mute hover:bg-[var(--surface-3)]'}`}
                    aria-label={
                      isFav ? t('Remove favourite') : t('Add favourite')
                    }
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
                {t('Show more ({n} left)', { n: results.length - limit })}
              </Btn>
            </div>
          )}
        </>
      ) : (
        <EmptyState
          icon={<BookOpen size={24} />}
          title={archived ? t('Archive is empty') : t('No exercises match')}
          body={
            archived
              ? t(
                  'Archived exercises are hidden from the picker. Unarchive one to use it again.',
                )
              : t(
                  'Try a different muscle, piece of equipment, or search term. Or create your own movement.',
                )
          }
          action={
            <div className="flex gap-2">
              <Btn onClick={clear}>{t('Clear filters')}</Btn>
              <Btn variant="primary" onClick={() => setCreateOpen(true)}>
                {t('Create exercise')}
              </Btn>
            </div>
          }
        />
      )}

      <Sheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title={t('Filters')}
      >
        <div className="space-y-4">
          <div>
            <p className="label mb-2">{t('Muscle')}</p>
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
                  {tm(m.id, m.label)}
                </Chip>
              ))}
            </div>
          </div>
          <div>
            <p className="label mb-2">{t('Equipment')}</p>
            <div className="flex flex-wrap gap-1.5">
              {EQUIPMENT.map((e) => (
                <Chip
                  key={e}
                  on={equipment === e}
                  onClick={() => setEquipment(equipment === e ? null : e)}
                >
                  {t(e)}
                </Chip>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Chip on={fav} onClick={() => setFav(!fav)}>
              <Star size={12} /> {t('Favourites only')}
            </Chip>
            <Chip on={archived} onClick={() => setArchived(!archived)}>
              <Archive size={12} /> {t('Archived')}
            </Chip>
          </div>
          <div className="flex gap-2">
            <Btn className="flex-1" onClick={clear}>
              {t('Reset')}
            </Btn>
            <Btn
              className="flex-1"
              variant="primary"
              onClick={() => setFiltersOpen(false)}
            >
              {t('Show {n}', { n: results.length })}
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
          toast.push(t('{name} created', { name: ex.name }), 'good');
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
  const { t, tm } = useI18n(TH);
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
      setError(t('Give the exercise a name.'));
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
      title={t('Create exercise')}
      footer={
        <Btn
          variant="primary"
          className="w-full"
          onClick={submit}
          icon={<Plus size={16} />}
        >
          {t('Create exercise')}
        </Btn>
      }
      size="lg"
    >
      <div className="space-y-4">
        <Field label={t('Exercise name')}>
          <input
            className="input"
            placeholder={t('e.g. Cable Y-raise')}
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
          <p className="label mb-2">{t('Primary muscle')}</p>
          <div className="flex flex-wrap gap-1.5">
            {MUSCLES.map((m) => (
              <Chip
                key={m.id}
                on={primary === m.id}
                onClick={() => setPrimary(m.id)}
              >
                {tm(m.id, m.label)}
              </Chip>
            ))}
          </div>
        </div>
        <div>
          <p className="label mb-2">{t('Secondary muscles')}</p>
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
                {tm(m.id, m.label)}
              </Chip>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('Equipment')}>
            <select
              className="input"
              value={equipment}
              onChange={(e) => setEquipment(e.target.value)}
            >
              {EQUIPMENT.map((e) => (
                <option key={e}>{t(e)}</option>
              ))}
            </select>
          </Field>
          <Field label={t('Difficulty')}>
            <select
              className="input"
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
            >
              {DIFFICULTIES.map((d) => (
                <option key={d}>{t(d)}</option>
              ))}
            </select>
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t('Track by')}>
            <select
              className="input"
              value={mode}
              onChange={(e) => setMode(e.target.value as ExerciseMode)}
            >
              <option value="">{t('Repetitions')}</option>
              <option value="time">{t('Time')}</option>
              <option value="cardio">{t('Distance and time')}</option>
            </select>
          </Field>
          {mode !== 'cardio' && (
            <Field label={t('Load type')}>
              <select
                className="input"
                value={loadKind}
                onChange={(e) => setLoadKind(e.target.value as LoadKind)}
              >
                <option value="external">{t('External weight')}</option>
                <option value="added">{t('Added bodyweight load')}</option>
                <option value="assistance">{t('Assistance weight')}</option>
                <option value="none">{t('No weight')}</option>
              </select>
            </Field>
          )}
        </div>
        <Field
          label={t('Execution steps')}
          hint={t('One step per line. These show on the exercise page.')}
        >
          <textarea
            className="input min-h-[96px]"
            placeholder={t('Set up the bench…\nBrace your core…\nPress…')}
            value={steps}
            onChange={(e) => setSteps(e.target.value)}
          />
        </Field>
        <div className="flex items-center gap-2 rounded-xl border border-line bg-[var(--surface-2)] px-3 py-2 text-[11px] font-semibold text-mute">
          <Filter size={13} />{' '}
          {t('Custom exercises save with your account and work offline.')}
        </div>
      </div>
    </Sheet>
  );
}
