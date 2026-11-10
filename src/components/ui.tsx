import clsx from 'clsx';
import { Minus, Plus, X } from 'lucide-react';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { CatCompanion } from './CatCompanion';
import { useAppUpdate } from '../lib/useAppUpdate';

/* ------------------------------------------------------------------ */
/* Toast                                                               */
/* ------------------------------------------------------------------ */

type Tone = 'default' | 'good' | 'bad';
interface ToastItem {
  id: number;
  msg: string;
  tone: Tone;
  persistent?: boolean;
  action?: { label: string; onClick: () => void; disabled: boolean };
}
const ToastCtx = createContext<{
  push: (msg: string, tone?: Tone) => void;
  clear: () => void;
  mountCat: (host: HTMLElement) => () => void;
}>({
  push: () => {},
  clear: () => {},
  mountCat: () => () => {},
});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const update = useAppUpdate();
  const [items, setItems] = useState<ToastItem[]>([]);
  const [catHosts, setCatHosts] = useState<HTMLElement[]>([]);
  const mountCat = useCallback((host: HTMLElement) => {
    setCatHosts((hosts) => [...hosts, host]);
    return () => setCatHosts((hosts) => hosts.filter((item) => item !== host));
  }, []);
  const clear = useCallback(() => setItems([]), []);
  const dismiss = useCallback(() => setItems((xs) => xs.slice(1)), []);
  const push = useCallback((msg: string, tone: Tone = 'default') => {
    const id = Date.now() + Math.random();
    const item = { id, msg, tone };
    setItems((xs) => tone === 'bad' ? [item, ...xs] : [...xs, item]);
  }, []);
  const encourage = useCallback((msg: string) => push(msg, 'good'), [push]);
  const updateNotice: ToastItem | undefined = update.version ? {
    id: -1,
    msg: update.error || 'Psst! A newer Gymmiie is ready. Want to refresh and check it out? Mochi will keep your saved workout safe.',
    tone: update.error ? 'bad' : 'default',
    persistent: true,
    action: {
      label: update.refreshing ? 'Refreshing…' : 'Refresh app',
      onClick: () => { void update.refresh(); },
      disabled: update.refreshing,
    },
  } : undefined;
  return (
    <ToastCtx.Provider value={{ push, clear, mountCat }}>
      {children}
      <CatCompanion
        message={items[0] ?? updateNotice}
        pending={Math.max(0, items.length - 1) + (items.length && updateNotice ? 1 : 0)}
        onDismiss={items.length ? dismiss : update.dismiss}
        onEncourage={encourage}
        host={catHosts.at(-1)}
      />
    </ToastCtx.Provider>
  );
}

/* ------------------------------------------------------------------ */
/* Layout primitives                                                   */
/* ------------------------------------------------------------------ */

export function Card({
  className,
  children,
  onClick,
}: {
  className?: string;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={clsx(
        'card',
        onClick &&
          'cursor-pointer transition hover:border-[var(--line-strong)] active:scale-[.995]',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function SectionHeader({
  title,
  action,
  subtitle,
}: {
  title: string;
  action?: React.ReactNode;
  subtitle?: string;
}) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div>
        <h2 className="text-[17px] font-black tracking-tight">{title}</h2>
        {subtitle && (
          <p className="mt-0.5 text-xs font-semibold text-mute">{subtitle}</p>
        )}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex items-start justify-between gap-4">
      <div>
        {eyebrow && <p className="label mb-1">{eyebrow}</p>}
        <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 max-w-xl text-sm font-semibold text-dim">
            {subtitle}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Buttons                                                             */
/* ------------------------------------------------------------------ */

export function Btn({
  children,
  variant = 'soft',
  size = 'md',
  className,
  icon,
  trailing,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'soft' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  icon?: React.ReactNode;
  trailing?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      {...rest}
      className={clsx(
        'btn',
        `btn-${variant}`,
        size === 'sm' && 'px-3 py-1.5 text-xs',
        size === 'md' && 'px-4 py-2.5 text-sm',
        size === 'lg' && 'px-6 py-3.5 text-base',
        size === 'icon' && 'h-11 w-11 shrink-0',
        className,
      )}
    >
      {icon}
      {children}
      {trailing}
    </button>
  );
}

export function Chip({
  on,
  children,
  onClick,
  className,
}: {
  on?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      data-on={on ? 'true' : 'false'}
      onClick={onClick}
      className={clsx('chip', className)}
    >
      {children}
    </button>
  );
}

export function Toggle({
  on,
  onChange,
  label,
  hint,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  label?: string;
  hint?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className="flex w-full items-center justify-between gap-4 py-1 text-left"
    >
      {(label || hint) && (
        <span>
          {label && (
            <span className="block text-sm font-extrabold">{label}</span>
          )}
          {hint && (
            <span className="mt-0.5 block text-xs font-semibold text-mute">
              {hint}
            </span>
          )}
        </span>
      )}
      <span
        className={clsx(
          'relative h-7 w-12 shrink-0 rounded-full border transition',
          on
            ? 'border-transparent bg-[var(--accent)]'
            : 'border-line bg-[var(--surface-3)]',
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

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  className,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        'flex rounded-full border border-line bg-[var(--surface-2)] p-1',
        className,
      )}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={clsx(
            'flex-1 rounded-full px-3 py-1.5 text-xs font-extrabold transition',
            value === o.value
              ? 'bg-[var(--surface-3)] text-[var(--text)] shadow-sm'
              : 'text-mute hover:text-dim',
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

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="label mb-1.5 block">{label}</span>
      {children}
      {hint && (
        <span className="mt-1 block text-[11px] font-semibold text-mute">
          {hint}
        </span>
      )}
    </label>
  );
}

export function NumField({
  value,
  onChange,
  unit,
  min = 0,
  max = 100000,
  step = 1,
  placeholder,
  className,
}: {
  value: number | '';
  onChange: (v: number) => void;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  className?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);

  return (
    <div className={clsx('relative', className)}>
      <input
        type="number"
        inputMode="decimal"
        className="input !pr-12 text-right num"
        value={draft ?? value}
        min={min}
        max={max}
        step={step}
        placeholder={placeholder}
        onChange={(e) => {
          const raw = e.target.value;
          setDraft(raw);
          const next = Number(raw);
          if (raw !== '' && Number.isFinite(next) && next >= min && next <= max)
            onChange(next);
        }}
        onBlur={(e) => {
          const raw = e.target.value;
          const next = Number(raw);
          if (raw !== '' && Number.isFinite(next))
            onChange(Math.max(min, Math.min(max, next)));
          setDraft(null);
        }}
        onFocus={(e) => e.target.select()}
      />
      {unit && (
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-black text-mute">
          {unit}
        </span>
      )}
    </div>
  );
}

export function Stepper({
  value,
  onChange,
  step = 1,
  min = 0,
  max = 999,
  unit,
}: {
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
  unit?: string;
}) {
  const set = (v: number) =>
    onChange(Math.max(min, Math.min(max, Math.round(v * 100) / 100)));
  return (
    <div className="flex items-center gap-1.5 rounded-xl border border-line bg-[var(--surface-2)] p-1">
      <button
        type="button"
        aria-label={`Decrease${unit ? ` ${unit}` : ''}`}
        onClick={() => set(value - step)}
        className="grid h-8 w-8 place-items-center rounded-lg text-dim hover:bg-[var(--surface-3)]"
      >
        <Minus size={15} />
      </button>
      <div className="min-w-[52px] text-center">
        <span className="num text-sm font-black">{value}</span>
        {unit && (
          <span className="ml-0.5 text-[10px] font-bold text-mute">{unit}</span>
        )}
      </div>
      <button
        type="button"
        aria-label={`Increase${unit ? ` ${unit}` : ''}`}
        onClick={() => set(value + step)}
        className="grid h-8 w-8 place-items-center rounded-lg text-dim hover:bg-[var(--surface-3)]"
      >
        <Plus size={15} />
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Modal / bottom sheet                                                */
/* ------------------------------------------------------------------ */

type OpenSheet = {
  id: string;
  layer: HTMLDivElement;
  panel: HTMLDivElement;
  trigger: HTMLElement | null;
};
const openSheets: OpenSheet[] = [];
let previousOverflow = '';
let rootWasInert = false;

function syncSheets() {
  const app = document.getElementById('root');
  if (app) app.inert = openSheets.length > 0 || rootWasInert;
  openSheets.forEach((sheet, index) => {
    sheet.layer.inert = index !== openSheets.length - 1;
    sheet.layer.style.zIndex = String(80 + index * 2);
  });
}

const FOCUSABLE =
  'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
function focusableIn(panel: HTMLElement) {
  return Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => el.getClientRects().length > 0 && !el.closest('[inert]'),
  );
}

export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
  size = 'md',
  dismissible = true,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'md' | 'lg';
  dismissible?: boolean;
}) {
  const id = useId();
  const layerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const catHostRef = useRef<HTMLDivElement>(null);
  const { mountCat } = useContext(ToastCtx);
  const openerRef = useRef<HTMLElement | null>(null);
  const wasOpenRef = useRef(false);
  // Capture before React mounts an auto-focused input inside the portal.
  if (open && !wasOpenRef.current)
    openerRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
  wasOpenRef.current = open;
  const closeRef = useRef(onClose);
  const dismissibleRef = useRef(dismissible);
  closeRef.current = onClose;
  dismissibleRef.current = dismissible;

  useLayoutEffect(() => {
    if (!open || !layerRef.current || !panelRef.current) return;
    if (!openSheets.length) {
      previousOverflow = document.body.style.overflow;
      rootWasInert = document.getElementById('root')?.inert ?? false;
      document.body.style.overflow = 'hidden';
    }
    const entry: OpenSheet = {
      id,
      layer: layerRef.current,
      panel: panelRef.current,
      trigger: openerRef.current,
    };
    openSheets.push(entry);
    syncSheets();
    const focusFirst = () =>
      (focusableIn(entry.panel)[0] ?? entry.panel).focus();
    if (!entry.panel.contains(document.activeElement)) focusFirst();
    const onKey = (event: KeyboardEvent) => {
      if (openSheets.at(-1)?.id !== id) return;
      if (event.key === 'Escape' && dismissibleRef.current) {
        event.preventDefault();
        event.stopImmediatePropagation();
        closeRef.current();
      }
      if (event.key === 'Tab') {
        const targets = focusableIn(entry.panel);
        const first = targets[0];
        const last = targets.at(-1);
        if (!first || !last) {
          event.preventDefault();
          entry.panel.focus();
          return;
        }
        const current = document.activeElement;
        if (
          event.shiftKey &&
          (current === first || !entry.panel.contains(current))
        ) {
          event.preventDefault();
          last.focus();
        } else if (
          !event.shiftKey &&
          (current === last || !entry.panel.contains(current))
        ) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    const onFocus = (event: FocusEvent) => {
      if (
        openSheets.at(-1)?.id === id &&
        !entry.panel.contains(event.target as Node)
      )
        focusFirst();
    };
    window.addEventListener('keydown', onKey, true);
    document.addEventListener('focusin', onFocus);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      document.removeEventListener('focusin', onFocus);
      const index = openSheets.findIndex((sheet) => sheet.id === id);
      if (index >= 0) openSheets.splice(index, 1);
      syncSheets();
      if (!openSheets.length) document.body.style.overflow = previousOverflow;
      const parent = openSheets.at(-1);
      if (
        entry.trigger?.isConnected &&
        (!parent || parent.panel.contains(entry.trigger))
      )
        entry.trigger.focus();
      else if (parent) (focusableIn(parent.panel)[0] ?? parent.panel).focus();
    };
  }, [open, id]);

  useLayoutEffect(() => {
    if (open && catHostRef.current) return mountCat(catHostRef.current);
  }, [open, mountCat]);

  if (!open) return null;
  return createPortal(
    <div
      ref={layerRef}
      className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => {
          if (dismissible && openSheets.at(-1)?.id === id) onClose();
        }}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        tabIndex={-1}
        className={clsx(
          'animate-fadeUp relative flex max-h-[92dvh] w-full flex-col overflow-hidden border border-line bg-[var(--surface)] shadow-2xl',
          'rounded-t-[2rem] sm:rounded-[2rem]',
          size === 'md' ? 'sm:max-w-lg' : 'sm:max-w-2xl',
        )}
      >
        <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-4">
          <h2 id={`${id}-title`} className="text-base font-black">
            {title ?? 'Dialog'}
          </h2>
          <button
            type="button"
            aria-label="Close dialog"
            disabled={!dismissible}
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-full bg-[var(--surface-2)] text-dim hover:text-[var(--text)] disabled:opacity-40"
          >
            <X size={18} />
          </button>
        </div>
        <div className="thin-scroll overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="border-t border-line bg-[var(--surface)] px-5 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:pb-3">
            {footer}
          </div>
        )}
        <div ref={catHostRef} className="gym-cat-dialog-host" />
      </div>
    </div>,
    document.body,
  );
}

export function Confirm({
  open,
  onClose,
  onConfirm,
  title,
  body,
  confirmLabel = 'Delete',
  danger = true,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  body: string;
  confirmLabel?: string;
  danger?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (open) setError('');
  }, [open]);
  const confirm = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await onConfirm();
      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not complete this action. Try again.',
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet
      open={open}
      onClose={onClose}
      dismissible={!busy}
      title={title}
      footer={
        <div className="flex gap-2">
          <Btn disabled={busy} className="flex-1" onClick={onClose}>
            Cancel
          </Btn>
          <Btn
            disabled={busy}
            className="flex-1"
            variant={danger ? 'danger' : 'primary'}
            onClick={() => void confirm()}
          >
            {busy ? 'Working…' : confirmLabel}
          </Btn>
        </div>
      }
    >
      <p className="text-sm font-semibold text-dim">{body}</p>
      {error && (
        <p role="alert" className="mt-3 text-sm font-bold text-[var(--bad)]">
          {error}
        </p>
      )}
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */
/* Display                                                            */
/* ------------------------------------------------------------------ */

export function Stat({
  label,
  value,
  sub,
  accent,
  icon,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  accent?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5 text-mute">
        {icon}
        <span className="label">{label}</span>
      </div>
      <div
        className={clsx(
          'num mt-1 text-2xl font-black leading-none',
          accent && 'text-accent',
        )}
      >
        {value}
      </div>
      {sub && <div className="mt-1 text-[11px] font-bold text-mute">{sub}</div>}
    </div>
  );
}

export function Ring({
  value,
  size = 64,
  stroke = 7,
  children,
}: {
  value: number;
  size?: number;
  stroke?: number;
  children?: React.ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div
      className="relative grid place-items-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--surface-3)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (pct / 100) * c}
          style={{ transition: 'stroke-dashoffset .4s ease' }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  );
}

export function Sparkline({
  data,
  height = 40,
  className,
}: {
  data: number[];
  height?: number;
  className?: string;
}) {
  const w = 120;
  const max = Math.max(1, ...data);
  const min = Math.min(...data);
  const span = max - min || 1;
  const pts = data.map(
    (v, i) =>
      `${(i / Math.max(1, data.length - 1)) * w},${height - ((v - min) / span) * (height - 6) - 3}`,
  );
  return (
    <svg
      viewBox={`0 0 ${w} ${height}`}
      className={clsx('w-full', className)}
      preserveAspectRatio="none"
    >
      <polyline
        points={pts.join(' ')}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <polygon
        points={`0,${height} ${pts.join(' ')} ${w},${height}`}
        fill="var(--accent)"
        opacity="0.12"
      />
    </svg>
  );
}

export function BarChart({
  data,
  height = 140,
  unit = '',
  format,
}: {
  data: { label: string; value: number }[];
  height?: number;
  unit?: string;
  format?: (v: number) => string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const fmt =
    format ??
    ((v: number) =>
      `${Math.round(v).toLocaleString()}${unit ? ` ${unit}` : ''}`);
  return (
    <div>
      <div className="flex items-end gap-1.5" style={{ height }}>
        {data.map((d, i) => (
          <div
            key={i}
            className="group flex h-full flex-1 flex-col justify-end gap-1"
          >
            <div
              className="relative w-full rounded-t-md bg-[var(--accent)]/85 transition-all hover:bg-[var(--accent)]"
              style={{ height: `${Math.max(2, (d.value / max) * 100)}%` }}
              title={`${d.label}: ${fmt(d.value)}`}
            />
            <span className="truncate text-center text-[9px] font-bold text-mute">
              {d.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function LineChart({
  data,
  height = 150,
  format,
  className,
}: {
  data: { date: string; value: number }[];
  height?: number;
  format?: (v: number) => string;
  className?: string;
}) {
  const w = 340;
  const h = height;
  const pad = { l: 4, r: 4, t: 10, b: 18 };
  const vals = data.map((d) => d.value);
  const max = Math.max(1, ...vals);
  const min = Math.min(...vals);
  const span = max - min || 1;
  const x = (i: number) =>
    pad.l + (i / Math.max(1, data.length - 1)) * (w - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - (v - min) / span) * (h - pad.t - pad.b);
  const pts = data.map((d, i) => `${x(i)},${y(d.value)}`);
  const fmt = format ?? ((v: number) => Math.round(v).toLocaleString());
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className={clsx('w-full', className)}
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="lineFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.3" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {data.length > 1 && (
        <>
          <polygon
            points={`${pad.l},${h - pad.b} ${pts.join(' ')} ${w - pad.r},${h - pad.b}`}
            fill="url(#lineFill)"
          />
          <polyline
            points={pts.join(' ')}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </>
      )}
      {data.map((d, i) => (
        <circle
          key={i}
          cx={x(i)}
          cy={y(d.value)}
          r={data.length > 20 ? 1.2 : 2.4}
          fill="var(--accent)"
        />
      ))}
      <text
        x={pad.l}
        y={h - 3}
        fontSize="8"
        fill="var(--text-mute)"
        fontWeight="700"
      >
        {data[0]?.date?.slice(5)}
      </text>
      <text
        x={w - pad.r}
        y={h - 3}
        fontSize="8"
        fill="var(--text-mute)"
        fontWeight="700"
        textAnchor="end"
      >
        {data[data.length - 1]?.date?.slice(5)}
      </text>
      <text
        x={pad.l}
        y={9}
        fontSize="8"
        fill="var(--text-mute)"
        fontWeight="700"
      >
        {fmt(max)}
      </text>
      <title>{data.map((d) => `${d.date}: ${fmt(d.value)}`).join('\n')}</title>
    </svg>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  body?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-line px-6 py-12 text-center">
      {icon && (
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-[var(--surface-2)] text-mute">
          {icon}
        </div>
      )}
      <div>
        <h2 className="font-black">{title}</h2>
        {body && (
          <p className="mx-auto mt-1 max-w-xs text-sm font-semibold text-mute">
            {body}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}

export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const initials = (name || 'G')
    .trim()
    .split(/\s+/)
    .map((s) => s[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <div
      className="grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-[var(--accent)] to-[var(--accent-strong)] font-black text-[#1a0d07]"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {initials}
    </div>
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
