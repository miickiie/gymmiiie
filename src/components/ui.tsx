import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { Check, ChevronRight, Minus, Plus, X } from 'lucide-react';

/* ------------------------------------------------------------------ */
/* Toast                                                               */
/* ------------------------------------------------------------------ */

type Tone = 'default' | 'good' | 'bad';
interface ToastItem { id: number; msg: string; tone: Tone }
const ToastCtx = createContext<{ push: (msg: string, tone?: Tone) => void }>({ push: () => {} });
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const push = useCallback((msg: string, tone: Tone = 'default') => {
    const id = Date.now() + Math.random();
    setItems((xs) => [...xs, { id, msg, tone }]);
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), 2600);
  }, []);
  return (
    <ToastCtx.Provider value={{ push }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-3 z-[100] flex flex-col items-center gap-2 px-3">
        {items.map((t) => (
          <div
            key={t.id}
            className={clsx(
              'animate-fadeUp rounded-full border px-4 py-2 text-sm font-extrabold shadow-card backdrop-blur',
              t.tone === 'good' && 'border-[color-mix(in_srgb,var(--good)_35%,transparent)] bg-[var(--good-soft)] text-[var(--good)]',
              t.tone === 'bad' && 'border-[color-mix(in_srgb,var(--bad)_35%,transparent)] bg-[var(--bad-soft)] text-[var(--bad)]',
              t.tone === 'default' && 'border-line bg-[var(--surface-2)] text-[var(--text)]',
            )}
          >
            {t.msg}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/* ------------------------------------------------------------------ */
/* Layout primitives                                                   */
/* ------------------------------------------------------------------ */

export function Card({ className, children, onClick }: { className?: string; children: React.ReactNode; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      className={clsx('card', onClick && 'cursor-pointer transition hover:border-[var(--line-strong)] active:scale-[.995]', className)}
    >
      {children}
    </div>
  );
}

export function SectionHeader({ title, action, subtitle }: { title: string; action?: React.ReactNode; subtitle?: string }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div>
        <h2 className="text-[17px] font-black tracking-tight">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs font-semibold text-mute">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({ eyebrow, title, subtitle, action }: { eyebrow?: string; title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-5 flex items-start justify-between gap-4">
      <div>
        {eyebrow && <p className="label mb-1">{eyebrow}</p>}
        <h1 className="text-2xl font-black tracking-tight sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 max-w-xl text-sm font-semibold text-dim">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Buttons                                                             */
/* ------------------------------------------------------------------ */

export function Btn({
  children, variant = 'soft', size = 'md', className, icon, trailing, ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'soft' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  icon?: React.ReactNode;
  trailing?: React.ReactNode;
}) {
  return (
    <button
      {...rest}
      className={clsx(
        'btn',
        `btn-${variant}`,
        size === 'sm' && 'px-3 py-1.5 text-xs',
        size === 'md' && 'px-4 py-2.5 text-sm',
        size === 'lg' && 'px-6 py-3.5 text-base',
        size === 'icon' && 'h-10 w-10',
        className,
      )}
    >
      {icon}
      {children}
      {trailing}
    </button>
  );
}

export function Chip({ on, children, onClick, className }: { on?: boolean; children: React.ReactNode; onClick?: () => void; className?: string }) {
  return (
    <button type="button" data-on={on ? 'true' : 'false'} onClick={onClick} className={clsx('chip', className)}>
      {children}
    </button>
  );
}

export function Toggle({ on, onChange, label, hint }: { on: boolean; onChange: (v: boolean) => void; label?: string; hint?: string }) {
  return (
    <button type="button" onClick={() => onChange(!on)} className="flex w-full items-center justify-between gap-4 py-1 text-left">
      {(label || hint) && (
        <span>
          {label && <span className="block text-sm font-extrabold">{label}</span>}
          {hint && <span className="mt-0.5 block text-xs font-semibold text-mute">{hint}</span>}
        </span>
      )}
      <span
        className={clsx(
          'relative h-7 w-12 shrink-0 rounded-full border transition',
          on ? 'border-transparent bg-[var(--accent)]' : 'border-line bg-[var(--surface-3)]',
        )}
      >
        <span
          className={clsx(
            'absolute top-0.5 h-5.5 w-5.5 rounded-full bg-white shadow transition-all',
            on ? 'left-[26px]' : 'left-1',
          )}
          style={{ height: 22, width: 22 }}
        />
      </span>
    </button>
  );
}

export function Segmented<T extends string>({ value, options, onChange, className }: {
  value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; className?: string;
}) {
  return (
    <div className={clsx('flex rounded-full border border-line bg-[var(--surface-2)] p-1', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={clsx(
            'flex-1 rounded-full px-3 py-1.5 text-xs font-extrabold transition',
            value === o.value ? 'bg-[var(--surface-3)] text-[var(--text)] shadow-sm' : 'text-mute hover:text-dim',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Inputs                                                             */
/* ------------------------------------------------------------------ */

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label mb-1.5 block">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] font-semibold text-mute">{hint}</span>}
    </label>
  );
}

export function NumField({ value, onChange, unit, min = 0, max = 100000, step = 1, placeholder, className }: {
  value: number | ''; onChange: (v: number) => void; unit?: string; min?: number; max?: number; step?: number; placeholder?: string; className?: string;
}) {
  return (
    <div className={clsx('relative', className)}>
      <input
        type="number"
        inputMode="decimal"
        className="input pr-12 text-right num"
        value={value}
        min={min}
        max={max}
        step={step}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))}
        onFocus={(e) => e.target.select()}
      />
      {unit && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-black text-mute">{unit}</span>}
    </div>
  );
}

export function Stepper({ value, onChange, step = 1, min = 0, max = 999, unit }: {
  value: number; onChange: (v: number) => void; step?: number; min?: number; max?: number; unit?: string;
}) {
  const set = (v: number) => onChange(Math.max(min, Math.min(max, Math.round(v * 100) / 100)));
  return (
    <div className="flex items-center gap-1.5 rounded-xl border border-line bg-[var(--surface-2)] p-1">
      <button type="button" onClick={() => set(value - step)} className="grid h-8 w-8 place-items-center rounded-lg text-dim hover:bg-[var(--surface-3)]">
        <Minus size={15} />
      </button>
      <div className="min-w-[52px] text-center">
        <span className="num text-sm font-black">{value}</span>
        {unit && <span className="ml-0.5 text-[10px] font-bold text-mute">{unit}</span>}
      </div>
      <button type="button" onClick={() => set(value + step)} className="grid h-8 w-8 place-items-center rounded-lg text-dim hover:bg-[var(--surface-3)]">
        <Plus size={15} />
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Modal / bottom sheet                                                */
/* ------------------------------------------------------------------ */

export function Sheet({ open, onClose, title, children, footer, size = 'md' }: {
  open: boolean; onClose: () => void; title?: string; children: React.ReactNode; footer?: React.ReactNode; size?: 'md' | 'lg';
}) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className={clsx(
          'animate-fadeUp relative flex max-h-[92vh] w-full flex-col overflow-hidden border border-line bg-[var(--surface)] shadow-2xl',
          'rounded-t-[2rem] sm:rounded-[2rem]',
          size === 'md' ? 'sm:max-w-lg' : 'sm:max-w-2xl',
        )}
      >
        <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-4">
          <h3 className="text-base font-black">{title}</h3>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-[var(--surface-2)] text-dim hover:text-[var(--text)]">
            <X size={18} />
          </button>
        </div>
        <div className="thin-scroll overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="border-t border-line bg-[var(--surface)] px-5 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:pb-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function Confirm({ open, onClose, onConfirm, title, body, confirmLabel = 'Delete', danger = true }: {
  open: boolean; onClose: () => void; onConfirm: () => void; title: string; body: string; confirmLabel?: string; danger?: boolean;
}) {
  return (
    <Sheet open={open} onClose={onClose} title={title} footer={
      <div className="flex gap-2">
        <Btn className="flex-1" onClick={onClose}>Cancel</Btn>
        <Btn className="flex-1" variant={danger ? 'danger' : 'primary'} onClick={() => { onConfirm(); onClose(); }}>{confirmLabel}</Btn>
      </div>
    }>
      <p className="text-sm font-semibold text-dim">{body}</p>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */
/* Display                                                            */
/* ------------------------------------------------------------------ */

export function Stat({ label, value, sub, accent, icon }: { label: string; value: React.ReactNode; sub?: string; accent?: boolean; icon?: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5 text-mute">
        {icon}
        <span className="label">{label}</span>
      </div>
      <div className={clsx('num mt-1 text-2xl font-black leading-none', accent && 'text-accent')}>{value}</div>
      {sub && <div className="mt-1 text-[11px] font-bold text-mute">{sub}</div>}
    </div>
  );
}

export function Ring({ value, size = 64, stroke = 7, children }: { value: number; size?: number; stroke?: number; children?: React.ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--accent)" strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c - (pct / 100) * c}
          style={{ transition: 'stroke-dashoffset .4s ease' }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  );
}

export function Sparkline({ data, height = 40, className }: { data: number[]; height?: number; className?: string }) {
  const w = 120;
  const max = Math.max(1, ...data);
  const min = Math.min(...data);
  const span = max - min || 1;
  const pts = data.map((v, i) => `${(i / Math.max(1, data.length - 1)) * w},${height - ((v - min) / span) * (height - 6) - 3}`);
  return (
    <svg viewBox={`0 0 ${w} ${height}`} className={clsx('w-full', className)} preserveAspectRatio="none">
      <polyline points={pts.join(' ')} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <polygon points={`0,${height} ${pts.join(' ')} ${w},${height}`} fill="var(--accent)" opacity="0.12" />
    </svg>
  );
}

export function BarChart({ data, height = 140, unit = '', format }: {
  data: { label: string; value: number }[]; height?: number; unit?: string; format?: (v: number) => string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const fmt = format ?? ((v: number) => `${Math.round(v).toLocaleString()}${unit ? ` ${unit}` : ''}`);
  return (
    <div>
      <div className="flex items-end gap-1.5" style={{ height }}>
        {data.map((d, i) => (
          <div key={i} className="group flex h-full flex-1 flex-col justify-end gap-1">
            <div
              className="relative w-full rounded-t-md bg-[var(--accent)]/85 transition-all hover:bg-[var(--accent)]"
              style={{ height: `${Math.max(2, (d.value / max) * 100)}%` }}
              title={`${d.label}: ${fmt(d.value)}`}
            />
            <span className="truncate text-center text-[9px] font-bold text-mute">{d.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function LineChart({ data, height = 150, format, className }: {
  data: { date: string; value: number }[]; height?: number; format?: (v: number) => string; className?: string;
}) {
  const w = 340;
  const h = height;
  const pad = { l: 4, r: 4, t: 10, b: 18 };
  const vals = data.map((d) => d.value);
  const max = Math.max(1, ...vals);
  const min = Math.min(...vals);
  const span = max - min || 1;
  const x = (i: number) => pad.l + (i / Math.max(1, data.length - 1)) * (w - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - (v - min) / span) * (h - pad.t - pad.b);
  const pts = data.map((d, i) => `${x(i)},${y(d.value)}`);
  const fmt = format ?? ((v: number) => Math.round(v).toLocaleString());
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={clsx('w-full', className)} preserveAspectRatio="none">
      <defs>
        <linearGradient id="lineFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.3" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {data.length > 1 && (
        <>
          <polygon points={`${pad.l},${h - pad.b} ${pts.join(' ')} ${w - pad.r},${h - pad.b}`} fill="url(#lineFill)" />
          <polyline points={pts.join(' ')} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        </>
      )}
      {data.map((d, i) => (
        <circle key={i} cx={x(i)} cy={y(d.value)} r={data.length > 20 ? 1.2 : 2.4} fill="var(--accent)" />
      ))}
      <text x={pad.l} y={h - 3} fontSize="8" fill="var(--text-mute)" fontWeight="700">{data[0]?.date?.slice(5)}</text>
      <text x={w - pad.r} y={h - 3} fontSize="8" fill="var(--text-mute)" fontWeight="700" textAnchor="end">{data[data.length - 1]?.date?.slice(5)}</text>
      <text x={pad.l} y={9} fontSize="8" fill="var(--text-mute)" fontWeight="700">{fmt(max)}</text>
      <title>{data.map((d) => `${d.date}: ${fmt(d.value)}`).join('\n')}</title>
    </svg>
  );
}

export function EmptyState({ icon, title, body, action }: { icon?: React.ReactNode; title: string; body?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-line px-6 py-12 text-center">
      {icon && <div className="grid h-14 w-14 place-items-center rounded-2xl bg-[var(--surface-2)] text-mute">{icon}</div>}
      <div>
        <p className="font-black">{title}</p>
        {body && <p className="mx-auto mt-1 max-w-xs text-sm font-semibold text-mute">{body}</p>}
      </div>
      {action}
    </div>
  );
}

export function RowLink({ title, subtitle, icon, right, onClick, to }: {
  title: string; subtitle?: string; icon?: React.ReactNode; right?: React.ReactNode; onClick?: () => void; to?: string;
}) {
  const inner = (
    <div className="flex items-center gap-3 px-4 py-3.5">
      {icon && <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--surface-2)] text-dim">{icon}</div>}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-extrabold">{title}</p>
        {subtitle && <p className="truncate text-xs font-semibold text-mute">{subtitle}</p>}
      </div>
      {right ?? <ChevronRight size={18} className="text-mute" />}
    </div>
  );
  if (to) return <a href={to}>{inner}</a>;
  return <button type="button" onClick={onClick} className="w-full text-left">{inner}</button>;
}

export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const initials = (name || 'G').trim().split(/\s+/).map((s) => s[0]).slice(0, 2).join('').toUpperCase();
  return (
    <div
      className="grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-[var(--accent)] to-[var(--accent-strong)] font-black text-[#1a0d07]"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {initials}
    </div>
  );
}

export function CheckBullet({ on }: { on: boolean }) {
  return (
    <span className={clsx('grid h-5 w-5 place-items-center rounded-full border', on ? 'border-transparent bg-[var(--good)] text-black' : 'border-strong text-transparent')}>
      <Check size={12} strokeWidth={3} />
    </span>
  );
}

export function useNow(active: boolean, interval = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), interval);
    return () => clearInterval(t);
  }, [active, interval]);
  return now;
}

export function useDebounced<T>(value: T, ms = 200) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function cx(...args: (string | false | null | undefined)[]) {
  return clsx(...args);
}

export { useMemo };
