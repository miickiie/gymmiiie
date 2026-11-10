export const DAY_MS = 86400000;

export function pad(n: number) {
  return String(n).padStart(2, '0');
}

export function dateKey(d: Date | string | number = new Date()): string {
  const date = typeof d === 'string' || typeof d === 'number' ? new Date(d) : d;
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function parseKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 12, 0, 0, 0);
}

export function startOfDay(d: Date = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addDays(d: Date, n: number): Date {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
}

export function addDaysKey(key: string, n: number): string {
  return dateKey(addDays(parseKey(key), n));
}

export function daysBetween(a: string, b: string): number {
  return Math.round((parseKey(b).getTime() - parseKey(a).getTime()) / DAY_MS);
}

export function startOfWeek(d: Date = new Date(), weekStart: 0 | 1 | 6 = 1): Date {
  const c = startOfDay(d);
  const diff = (c.getDay() - weekStart + 7) % 7;
  return addDays(c, -diff);
}

export function weekDates(weekStart: 0 | 1 | 6 = 1, base: Date = new Date()): Date[] {
  const start = startOfWeek(base, weekStart);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function weekdayIndex(d: Date = new Date()): number {
  return d.getDay();
}

export function fmtDate(d: Date | string, opts?: Intl.DateTimeFormatOptions): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString(undefined, opts ?? { weekday: 'short', day: 'numeric', month: 'short' });
}

export function fmtTime(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export function relativeDay(key: string): string {
  const today = dateKey();
  const diff = daysBetween(key, today);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff === -1) return 'Tomorrow';
  if (diff > 1 && diff < 7) return `${diff} days ago`;
  return fmtDate(parseKey(key), { day: 'numeric', month: 'short', year: 'numeric' });
}

export function fmtDuration(sec: number, compact = false): string {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (compact) return `${m}:${pad(ss)}`;
  if (m === 0) return `${ss}s`;
  return `${m}m ${ss ? `${ss}s` : ''}`.trim();
}

export function fmtClock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(ss)}` : `${pad(m)}:${pad(ss)}`;
}

export function fmtNumber(n: number, digits = 0): string {
  if (!Number.isFinite(n)) return '0';
  return n.toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: 0 });
}

export function roundTo(n: number, step: number): number {
  if (step <= 0) return n;
  return Math.round(n / step) * step;
}

export function isoNow(): string {
  return new Date().toISOString();
}
