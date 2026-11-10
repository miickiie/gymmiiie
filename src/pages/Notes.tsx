import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle, CalendarCheck, CheckCircle2, ChevronRight, Dumbbell, Folder, NotebookPen,
  Pencil, Pin, Plus, Search, StickyNote, Trash2, X,
} from 'lucide-react';
import type { Note } from '../types';
import { allExercises, useStore } from '../lib/store';
import { dateKey, fmtDate, relativeDay } from '../lib/date';
import {
  Btn, Card, Chip, Confirm, EmptyState, Field, PageHeader, Segmented, Sheet, useToast,
} from '../components/ui';
import ExercisePicker from '../components/ExercisePicker';

const KINDS: { id: Note['kind']; label: string; icon: React.ReactNode; tone: string }[] = [
  { id: 'note', label: 'Note', icon: <StickyNote size={14} />, tone: 'text-dim' },
  { id: 'plan', label: 'Plan', icon: <CalendarCheck size={14} />, tone: 'text-[var(--accent)]' },
  { id: 'done', label: 'Done', icon: <CheckCircle2 size={14} />, tone: 'text-[var(--good)]' },
  { id: 'pain', label: 'Pain', icon: <AlertTriangle size={14} />, tone: 'text-[var(--bad)]' },
];

const KIND_MAP = Object.fromEntries(KINDS.map((k) => [k.id, k])) as Record<Note['kind'], (typeof KINDS)[number]>;

export default function Notes() {
  const toast = useToast();
  const data = useStore((s) => s.data);
  const saveNote = useStore((s) => s.saveNote);
  const deleteNote = useStore((s) => s.deleteNote);
  const all = useMemo(() => allExercises(), [data.customExercises]);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'all' | Note['kind']>('all');
  const [folderFilter, setFolderFilter] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Note | null>(null);
  const [picker, setPicker] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Note | null>(null);

  const [kind, setKind] = useState<Note['kind']>('note');
  const [text, setText] = useState('');
  const [date, setDate] = useState(dateKey());
  const [exerciseId, setExerciseId] = useState('');
  const [folder, setFolder] = useState('');
  const [pinned, setPinned] = useState(false);

  const exerciseName = (id: string) => all.find((e) => e.id === id)?.name ?? '';

  const notes = useMemo(() => {
    const query = q.trim().toLowerCase();
    return [...data.notes]
      .filter((n) => (filter === 'all' ? true : n.kind === filter))
      .filter((n) => !folderFilter || n.folder === folderFilter)
      .filter((n) => !query || `${n.text} ${n.folder ?? ''} ${exerciseName(n.exerciseId)}`.toLowerCase().includes(query))
      .sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  }, [data.notes, filter, q, folderFilter, data.customExercises]);

  const folders = [...new Set(data.notes.map((n) => n.folder).filter(Boolean))] as string[];

  const openNew = () => {
    setEditing(null);
    setKind('note'); setText(''); setDate(dateKey()); setExerciseId(''); setFolder(''); setPinned(false);
    setOpen(true);
  };
  const openEdit = (n: Note) => {
    setEditing(n);
    setKind(n.kind); setText(n.text); setDate(n.date); setExerciseId(n.exerciseId); setFolder(n.folder ?? ''); setPinned(!!n.pinned);
    setOpen(true);
  };

  const submit = () => {
    if (!text.trim()) { toast.push('Write something first', 'bad'); return; }
    saveNote({ ...(editing ? { id: editing.id } : {}), kind, text: text.trim(), date, exerciseId, folder: folder.trim(), pinned });
    setOpen(false);
    toast.push(editing ? 'Note updated' : 'Note saved', 'good');
  };

  const togglePin = (n: Note) => saveNote({ ...n, pinned: !n.pinned });

  return (
    <div className="page-enter">
      <PageHeader
        eyebrow="Journal"
        title="Notes that train with you"
        subtitle={`${data.notes.length} entries · pin cues, plans and pain flags to exercises or days`}
        action={<Btn variant="primary" size="sm" onClick={openNew} icon={<Plus size={15} />}>New note</Btn>}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {KINDS.map((k) => {
          const count = data.notes.filter((n) => n.kind === k.id).length;
          return (
            <button key={k.id} onClick={() => setFilter(filter === k.id ? 'all' : k.id)} className={`card p-3 text-left transition hover:border-strong ${filter === k.id ? 'border-[var(--accent-line)] bg-[var(--accent-soft)]' : ''}`}>
              <span className={k.tone}>{k.icon}</span>
              <p className="mt-1 text-sm font-black">{count}</p>
              <p className="text-[10px] font-black uppercase text-mute">{k.label}s</p>
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-mute" />
          <input className="input pl-9" placeholder="Search notes, folders, exercises…" value={q} onChange={(e) => setQ(e.target.value)} />
          {q && <button onClick={() => setQ('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-mute"><X size={14} /></button>}
        </div>
        <Segmented
          value={filter}
          onChange={(v) => setFilter(v)}
          options={[{ value: 'all', label: 'All' }, ...KINDS.map((k) => ({ value: k.id, label: k.label }))]}
        />
      </div>

      {folders.length > 0 && (
        <div className="scroll-x mt-2 pb-1">
          <Chip on={!folderFilter} onClick={() => setFolderFilter('')}>All folders</Chip>
          {folders.map((f) => <Chip key={f} on={folderFilter === f} onClick={() => setFolderFilter(folderFilter === f ? '' : f)}><Folder size={11} /> {f}</Chip>)}
        </div>
      )}

      {notes.length ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {notes.map((n) => {
            const k = KIND_MAP[n.kind];
            const exName = exerciseName(n.exerciseId);
            return (
              <Card key={n.id} className={`p-4 ${n.pinned ? 'border-[var(--accent-line)]' : ''}`}>
                <div className="flex items-start gap-3">
                  <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--surface-2)] ${k.tone}`}>{k.icon}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={`text-[10px] font-black uppercase tracking-wide ${k.tone}`}>{k.label}</span>
                      <span className="text-[10px] font-bold text-mute">· {relativeDay(n.date)}</span>
                      {n.pinned && <Pin size={11} className="text-[var(--accent)]" fill="currentColor" />}
                      {n.folder && <span className="flex items-center gap-0.5 rounded-full bg-[var(--surface-2)] px-1.5 py-0.5 text-[9px] font-black text-mute"><Folder size={9} /> {n.folder}</span>}
                    </div>
                    <p className="mt-1.5 whitespace-pre-wrap text-sm font-semibold leading-relaxed text-dim">{n.text}</p>
                    {exName && (
                      <Link to={`/library/${n.exerciseId}`} className="mt-2 inline-flex items-center gap-1 rounded-full bg-[var(--surface-2)] px-2 py-1 text-[10px] font-black text-[var(--accent)]">
                        <Dumbbell size={10} /> {exName} <ChevronRight size={9} />
                      </Link>
                    )}
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-line pt-2.5">
                  <span className="text-[9px] font-bold text-mute">Added {fmtDate(n.createdAt, { day: 'numeric', month: 'short' })}</span>
                  <div className="flex gap-0.5">
                    <button onClick={() => togglePin(n)} className={`grid h-7 w-7 place-items-center rounded-full hover:bg-[var(--surface-2)] ${n.pinned ? 'text-[var(--accent)]' : 'text-mute'}`} title="Pin"><Pin size={13} /></button>
                    <button onClick={() => openEdit(n)} className="grid h-7 w-7 place-items-center rounded-full text-mute hover:bg-[var(--surface-2)]" title="Edit"><Pencil size={13} /></button>
                    <button onClick={() => setConfirmDelete(n)} className="grid h-7 w-7 place-items-center rounded-full text-mute hover:bg-[var(--surface-2)] hover:text-[var(--bad)]" title="Delete"><Trash2 size={13} /></button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={<NotebookPen size={24} />}
          title={data.notes.length ? 'No notes match' : 'Your journal is empty'}
          body={data.notes.length ? 'Try another search or filter.' : 'Write cues that worked, plan next week, or flag a niggle before it becomes an injury.'}
          action={<Btn variant="primary" onClick={openNew} icon={<Plus size={15} />}>Write a note</Btn>}
        />
      )}

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? 'Edit note' : 'New note'}
        size="lg"
        footer={<div className="flex gap-2"><Btn className="flex-1" onClick={() => setOpen(false)}>Cancel</Btn><Btn className="flex-1" variant="primary" onClick={submit} icon={<CheckCircle2 size={16} />}>{editing ? 'Save changes' : 'Save note'}</Btn></div>}
      >
        <div className="space-y-4">
          <div>
            <p className="label mb-2">Type</p>
            <div className="grid grid-cols-4 gap-1.5">
              {KINDS.map((k) => (
                <button key={k.id} onClick={() => setKind(k.id)} className={`flex flex-col items-center gap-1 rounded-xl border py-2 text-[10px] font-black ${kind === k.id ? 'border-[var(--accent-line)] bg-[var(--accent-soft)] text-[var(--accent)]' : 'border-line bg-[var(--surface-2)] text-mute'}`}>
                  {k.icon} {k.label}
                </button>
              ))}
            </div>
          </div>
          <Field label="Note">
            <textarea autoFocus className="input min-h-[120px]" placeholder={kind === 'pain' ? 'Where does it hurt? What movement triggers it?' : kind === 'plan' ? 'Next session plan, targets, cues…' : 'What do you want to remember?'} value={text} onChange={(e) => setText(e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date">
              <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label="Folder" hint="Optional, e.g. Technique">
              <input className="input" placeholder="Folder" value={folder} onChange={(e) => setFolder(e.target.value)} />
            </Field>
          </div>
          <div>
            <p className="label mb-2">Exercise (optional)</p>
            <div className="flex flex-wrap items-center gap-2">
              {exerciseId ? (
                <span className="flex items-center gap-1 rounded-full bg-[var(--accent-soft)] px-3 py-1.5 text-xs font-black text-[var(--accent)]">
                  <Dumbbell size={12} /> {exerciseName(exerciseId)}
                  <button onClick={() => setExerciseId('')} className="ml-1"><X size={12} /></button>
                </span>
              ) : (
                <Btn size="sm" variant="soft" onClick={() => setPicker(true)} icon={<Dumbbell size={13} />}>Attach exercise</Btn>
              )}
            </div>
          </div>
          <button onClick={() => setPinned(!pinned)} className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left ${pinned ? 'border-[var(--accent-line)] bg-[var(--accent-soft)]' : 'border-line bg-[var(--surface-2)]'}`}>
            <span>
              <span className="block text-sm font-extrabold">Pin to top</span>
              <span className="block text-[10px] font-semibold text-mute">Keep this note visible in the journal</span>
            </span>
            <span className={`grid h-6 w-6 place-items-center rounded-full ${pinned ? 'bg-[var(--accent)] text-[#1a0d07]' : 'bg-[var(--surface-3)] text-mute'}`}><Pin size={12} fill={pinned ? 'currentColor' : 'none'} /></span>
          </button>
        </div>
      </Sheet>

      <ExercisePicker open={picker} onClose={() => setPicker(false)} onPick={(ex) => setExerciseId(ex.id)} title="Attach exercise" />

      <Confirm
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => { if (confirmDelete) { deleteNote(confirmDelete.id); toast.push('Note deleted'); } }}
        title="Delete note?"
        body="This journal entry will be permanently removed."
        confirmLabel="Delete note"
      />
    </div>
  );
}
