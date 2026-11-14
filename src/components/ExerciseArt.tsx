import clsx from 'clsx';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ArtData } from '../lib/art';
import { artEntry, loadMotion } from '../lib/art';

const CYCLE_MS = 1560;
const HOLD = 0.72;
const easeInOut = (t: number) =>
  t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

/**
 * Exercise animation, reproduced from GymMane's ExerciseArt timing:
 * ping-pong across frames; each step holds, then cross-fades into the next
 * frame over the last 28% of the step. CC BY-SA 4.0 artwork.
 */
export function ExerciseArt({
  slug,
  live = true,
  height = 210,
  radius = 20,
  className,
  fallback,
}: {
  slug: string;
  live?: boolean;
  height?: number;
  radius?: number;
  className?: string;
  fallback?: React.ReactNode;
}) {
  const [data, setData] = useState<ArtData | null>(null);
  const [failed, setFailed] = useState(false);
  const reduced = useReducedMotion();
  const playing = live && !reduced;

  useEffect(() => {
    let gone = false;
    setData(null);
    setFailed(false);
    if (!artEntry(slug)) {
      setFailed(true);
      return;
    }
    loadMotion(slug).then((d) => {
      if (gone) return;
      if (d) setData(d);
      else setFailed(true);
    });
    return () => {
      gone = true;
    };
  }, [slug]);

  const body = useMemo(() => {
    if (failed) return null;
    if (!data) return 'loading' as const;
    return <MotionSvg data={data} playing={playing} />;
  }, [data, failed, playing]);

  if (body === null) {
    return (
      <div
        className={clsx(
          'grid place-items-center bg-art-well text-art-ink',
          className,
        )}
        style={{ height, borderRadius: radius }}
      >
        {fallback}
      </div>
    );
  }
  if (body === 'loading') {
    return (
      <div
        className={clsx('animate-pulse bg-art-well', className)}
        style={{ height, borderRadius: radius }}
      />
    );
  }

  return (
    <div
      className={clsx(
        'overflow-hidden border border-border/60 bg-art-well text-art-ink',
        className,
      )}
      style={{ height, borderRadius: radius }}
    >
      {body}
    </div>
  );
}

// Monochrome source art ships a painted light background plus a dark figure.
// Re-map those two layers to theme tokens so the silhouette never emits a harsh
// white rectangle in the dark or warm Solar themes.
const ART_FILL: Record<string, string> = {
  '#333333': 'rgb(var(--art-ink))',
  '#ffffff': 'rgb(var(--art-well))',
};

function themedFill(fill: string): string {
  return ART_FILL[fill.toLowerCase()] ?? fill;
}

// ---------------------------------------------------------------------------
// The animated svg itself
// ---------------------------------------------------------------------------
function MotionSvg({ data, playing }: { data: ArtData; playing: boolean }) {
  const n = data.frames.length;
  const holdRef = useRef({ from: 0, to: 0, blend: 0 });
  const [state, setState] = useState({ from: 0, to: 0, blend: 0 });

  useEffect(() => {
    if (!playing || n < 2) {
      holdRef.current = { from: 0, to: 0, blend: 0 };
      setState({ from: 0, to: 0, blend: 0 });
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const t = ((now - t0) % CYCLE_MS) / CYCLE_MS;
      const steps = (n - 1) * 2;
      const pos = t * steps;
      const step = Math.floor(pos) % steps;
      const f = pos - Math.floor(pos);
      const ascending = step < n - 1;
      const from = ascending ? step : steps - step;
      const to = ascending ? from + 1 : from - 1;
      const blend = f < HOLD ? 0 : easeInOut((f - HOLD) / (1 - HOLD));
      const cur = { from, to, blend };
      const prev = holdRef.current;
      if (
        cur.from !== prev.from ||
        cur.to !== prev.to ||
        cur.blend !== prev.blend
      ) {
        holdRef.current = cur;
        setState(cur);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, n]);

  const stillIndex = 0;
  const visible =
    !playing || n < 2 ? { from: stillIndex, to: -1, blend: 0 } : state;

  return (
    <svg
      viewBox={data.viewBox}
      className="h-full w-full text-current"
      aria-hidden
    >
      {data.frames.map((frame, fi) => {
        const alpha =
          fi === visible.from
            ? 1 - visible.blend
            : fi === visible.to && visible.blend > 0
              ? visible.blend
              : 0;
        return (
          <g key={fi} style={{ opacity: alpha }} className="transition-none">
            {frame.map((path, pi) => (
              <path
                key={pi}
                d={path.d}
                fill={themedFill(path.fill)}
                fillRule={path.fillRule}
                opacity={path.opacity}
              />
            ))}
          </g>
        );
      })}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Reduced motion
// ---------------------------------------------------------------------------
function useReducedMotion(): boolean {
  const [v, setV] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mq) return;
    setV(mq.matches);
    const fn = (e: MediaQueryListEvent) => setV(e.matches);
    mq.addEventListener?.('change', fn);
    return () => mq.removeEventListener?.('change', fn);
  }, []);
  return v;
}

// ---------------------------------------------------------------------------
// ArtThumb — lazy still thumbnail for list rows. Fetches the SVG only once the
// row becomes visible (each art file is ~40–90 KB, so lists must not prefetch).
// Falls back to the equipment icon when no motion exists for the exercise.
// ---------------------------------------------------------------------------
export function ArtThumb({
  slug,
  size = 44,
  className,
  fallback,
}: {
  slug?: string | undefined;
  size?: number;
  className?: string;
  fallback: React.ReactNode;
}) {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const hasArt = !!slug && !!artEntry(slug);

  useEffect(() => {
    if (!hasArt) return;
    const el = ref.current;
    if (!el || visible) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: '144px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [visible, hasArt]);

  return (
    <div
      ref={ref}
      className={className}
      style={{ width: size, height: size, flexShrink: 0 }}
    >
      {!visible || !hasArt ? (
        fallback
      ) : (
        <ExerciseArt
          slug={slug!}
          live={false}
          height={size}
          radius={12}
          className="w-full"
          fallback={fallback}
        />
      )}
    </div>
  );
}
