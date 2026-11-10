import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CalendarDays, ChevronRight, Clock, Dumbbell, Flame, Search, Timer, Trophy, TrendingUp, X,
} from 'lucide-react';
import type { LoggedSession } from '../types';
import { useStore } from '../lib/store';
import {
  heatmapLevels, sessionPRCount, sessionSets, sessionVolume, sortedSessions, totalSets, totalVolume, volumeLabel,
} from '../lib/stats';
import { addDaysKey, dateKey, fmtDate, fmtDuration, fmtTime, relativeDay } from '../lib/date';
import { Btn, Card, Chip, EmptyState, PageHeader, Segmented, Stat } from '../components/ui';

type Range = 'all' | '30' | '90' | '365';

export default function History() {
  const data = useStore((s) => s.data);
  const unit = data.settings.unit;
  const [q, setQ] = useState('');
  const [range, setRange] = useState<Range>('all');
  const [routineId, setRoutineId] = useState<string | null>(null);

  const sessions = useMemo(() => sortedSessions(data.sessions), [data.sessions]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    const cutoff = range === 'all' ? 0 : Date.now() - Number(range) * 86400000;
    return sessions.filter((s) => {
      if (cutoff && new Date(s.date).getTime() < cutoff) return false;
      if (routineId && s.routineId !== routineId) return false;
      if (!query) return true;
      const routine = data.routines.find((r) => r.id === s.routineId);
      const hay = `${s.name ?? ''} ${routine?.name ?? ''} ${s.exercises.map((e) => e.name).join(' ')}`.toLowerCase();
      return query.split(/\s+/).every((w) => hay.includes(w));
    });
  }, [sessions, q, range, routineId, data.routines]);

  const groups = useMemo(() => {
    const map = new Map<string, LoggedSession[]>();
    for (const s of filtered) {
      const d = new Date(s.date);
      const key = d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
      const list = map.get(key) ?? [];
      list.push(s);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [filtered]);

  const levels = useMemo(() => heatmapLevels(data.sessions, 119), [data.sessions]);
  const totalTime = data.sessions.reduce((n, s) => n + s.durationSec, 0);

  return (
    <div className="page-enter">
      <PageHeader
        eyebrow="History"
        title="Every rep counted"
        subtitle={`${data.sessions.length} workouts · ${fmtDuration(totalTime)} under the bar · ${volumeLabel(totalVolume(data.sessions), unit)} lifted`}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Workouts', value: data.sessions.length, icon: <Dumbbell size={14} />, sub: 'all time' },
          { label: 'Sets', value: totalSets(data.sessions).toLocaleString(), icon: <TrendingUp size={14} />, sub: 'working only' },
          { label: 'Time', value: fmtDuration(totalTime), icon: <Clock size={14} />, sub: 'in the gym' },
          { label: 'Volume', value: volumeLabel(totalVolume(data.sessions), unit), icon: <Flame size={14} />, sub: 'total lifted' },
        ].map((s) => (
          <Card key={s.label} className="p-4"><Stat label={s.label} value={s.value} sub={s.sub} icon={s.icon} /></Card>
        ))}
      </div>

      <Card className="mt-4 p-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-black">Training heatmap</p>
          <p className="text-[10px] font-bold text-mute">last 17 weeks</p>
        </div>
        <div className="flex gap-[3px] overflow-x-auto pb-1">
          {Array.from({ length: 17 }, (_, week) => (
            <div key={week} className="flex flex-col gap-[3px]">
              {Array.from({ length: 7 }, (_, day) => {
                const idx = week * 7 + day;
                const lvl = levels[idx] ?? 0;
                const date = addDaysKey(dateKey(), idx - (levels.length - 1));
                const op = [0.06, 0.28, 0.48, 0.72, 1][lvl];
                return (
                  <span
                    key={day}
                    title={`${date} · level ${lvl}`}
                    className="h-3 w-3 rounded-[3px]"
                    style={{ background: lvl ? `color-mix(in srgb, var(--accent) ${op * 100}%, transparent)` : 'var(--surface-3)' }}
                  />
                );
              })}
            </div>
          ))}
        </div>
        <div className="mt-2 flex items-center justify-end gap-1.5 text-[9px] font-bold text-mute">
          Less {[0, 1, 2, 3, 4].map((l) => <span key={l} className="h-2.5 w-2.5 rounded-[2px]" style={{ background: l ? `color-mix(in srgb, var(--accent) ${[6, 28, 48, 72, 100][l]}%, transparent)` : 'var(--surface-3)' }} />)} More
        </div>
      </Card>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-mute" />
          <input className="input pl-9" placeholder="Search exercises, workouts, routines…" value={q} onChange={(e) => setQ(e.target.value)} />
          {q && <button onClick={() => setQ('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-mute"><X size={14} /></button>}
        </div>
        <Segmented
          value={range}
          onChange={(v) => setRange(v)}
          options={[{ value: 'all', label: 'All' }, { value: '365', label: 'Year' }, { value: '90', label: '90d' }, { value: '30', label: '30d' }]}
        />
      </div>

      {data.routines.length > 0 && (
        <div className="scroll-x mt-2 pb-1">
          <Chip on={routineId == null} onClick={() => setRoutineId(null)}>All routines</Chip>
          {data.routines.map((r) => <Chip key={r.id} on={routineId === r.id} onClick={() => setRoutineId(routineId === r.id ? null : r.id)}>{r.name}</Chip>)}
        </div>
      )}

      <div className="mt-4 space-y-5">
        {groups.map(([month, list]) => (
          <div key={month}>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-black">{month}</h2>
              <span className="text-[10px] font-bold text-mute">{list.length} workout{list.length === 1 ? '' : 's'} · {volumeLabel(list.reduce((n, s) => n + sessionVolume(s), 0), unit)}</span>
            </div>
            <div className="space-y-2">
              {list.map((s) => {
                const d = new Date(s.date);
                const prior = data.sessions.filter((p) => new Date(p.date) < d);
                const prs = sessionPRCount(s, prior);
                const routine = data.routines.find((r) => r.id === s.routineId);
                return (
                  <Link key={s.id} to={`/history/${s.id}`} className="card flex items-center gap-3 p-3.5 transition hover:border-strong">
                    <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-[var(--surface-2)]">
                      <span className="text-[9px] font-black uppercase leading-none text-mute">{d.toLocaleDateString(undefined, { month: 'short' })}</span>
                      <span className="num text-xl font-black leading-none">{d.getDate()}</span>
                      <span className="text-[8px] font-bold uppercase leading-none text-mute">{d.toLocaleDateString(undefined, { weekday: 'short' })}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="truncate text-sm font-black">{s.name || routine?.name || s.exercises[0]?.name || 'Workout'}</p>
                        {prs > 0 && <span className="flex items-center gap-0.5 rounded-full bg-[var(--warn)]/15 px-1.5 py-0.5 text-[9px] font-black text-[var(--warn)]"><Trophy size={9} /> {prs} PR</span>}
                        {s.deload && <span className="rounded-full bg-[var(--surface-2)] px-1.5 py-0.5 text-[9px] font-black text-mute">deload</span>}
                      </div>
                      <p className="mt-0.5 truncate text-[11px] font-bold text-mute">
                        {s.exercises.map((e) => e.name).join(' · ') || 'No exercises'}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] font-bold text-mute">
                        <span className="flex items-center gap-1"><Clock size={10} /> {fmtDuration(s.durationSec)}</span>
                        <span className="flex items-center gap-1"><Dumbbell size={10} /> {sessionSets(s)} sets</span>
                        <span className="flex items-center gap-1"><TrendingUp size={10} /> {volumeLabel(sessionVolume(s), unit)}</span>
                        <span className="flex items-center gap-1"><Timer size={10} /> {fmtTime(s.date)}</span>
                      </div>
                    </div>
                    <ChevronRight size={18} className="shrink-0 text-mute" />
                  </Link>
                );
              })}
            </div>
          </div>
        ))}

        {!filtered.length && (
          <EmptyState
            icon={<CalendarDays size={24} />}
            title={data.sessions.length ? 'No workouts match' : 'Your log starts here'}
            body={data.sessions.length ? 'Try a wider date range, another routine, or a different search.' : 'Finish your first session and it will appear here, set by set.'}
            action={<Link to="/train"><Btn variant="primary">Start training</Btn></Link>}
          />
        )}
      </div>

      {filtered.length > 0 && (
        <p className="mt-6 text-center text-[11px] font-bold text-mute">
          Showing {filtered.length} of {data.sessions.length} workouts · {filtered.length === 1 ? relativeDay(dateKey(filtered[0].date)) : `${fmtDate(filtered[filtered.length - 1].date, { day: 'numeric', month: 'short' })} — ${fmtDate(filtered[0].date, { day: 'numeric', month: 'short' })}`}
        </p>
      )}
    </div>
  );
}
