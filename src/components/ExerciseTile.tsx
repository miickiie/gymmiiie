import clsx from 'clsx';
import {
  Bike,
  Cable,
  Cog,
  Dumbbell,
  HeartPulse,
  PersonStanding,
  StretchHorizontal,
  Trophy,
  Waves,
  Zap,
} from 'lucide-react';
import { modeFor } from '../lib/exercises';
import { MUSCLE_LABEL } from '../lib/stats';
import { useI18n } from '../lib/i18n';
import type { Exercise } from '../types';
import { ArtThumb } from './ExerciseArt';

const TH: Record<string, string> = {};

export function ExerciseIcon({
  ex,
  size = 40,
  className,
}: {
  ex: Exercise;
  size?: number;
  className?: string;
}) {
  const mode = modeFor(ex);
  const Icon =
    mode === 'cardio'
      ? ex.id.includes('bike') || ex.id.includes('cycling')
        ? Bike
        : HeartPulse
      : mode === 'time'
        ? StretchHorizontal
        : ex.kind === 'sport'
          ? Trophy
          : ex.equipment === 'Bodyweight' || ex.equipment === 'Weighted'
            ? PersonStanding
            : ex.equipment === 'Cable'
              ? Cable
              : ex.equipment === 'Machine'
                ? Cog
                : ex.equipment === 'Band'
                  ? Waves
                  : ex.equipment === 'Rings'
                    ? Zap
                    : Dumbbell;
  return (
    <div
      className={clsx(
        'grid shrink-0 place-items-center rounded-xl bg-[var(--surface-2)] text-[var(--accent)]',
        className,
      )}
      style={{ width: size, height: size }}
    >
      <Icon size={Math.round(size * 0.45)} strokeWidth={2.2} />
    </div>
  );
}

const MUSCLE_COLOR: Record<string, string> = {
  chest: '#df7f4a',
  shoulders: '#e7a25f',
  biceps: '#c98fc9',
  abdomen: '#7fbf9a',
  obliques: '#6fb3a8',
  quads: '#d9a05b',
  forearm: '#b98f6a',
  trapezius: '#9aa5d9',
  back: '#7f9fd9',
  lowerback: '#6f86b8',
  triceps: '#a48fd9',
  glutes: '#d98fa8',
  hamstrings: '#c98f8f',
  calves: '#8fb3c9',
};

export function MuscleDot({ id, size = 6 }: { id: string; size?: number }) {
  return (
    <span
      className="inline-block shrink-0 rounded-full"
      style={{
        width: size,
        height: size,
        background: MUSCLE_COLOR[id] ?? 'var(--accent)',
      }}
    />
  );
}

export function ExerciseRow({
  ex,
  onClick,
  right,
  compact,
}: {
  ex: Exercise;
  onClick?: () => void;
  right?: React.ReactNode;
  compact?: boolean;
}) {
  const { t, tm } = useI18n(TH);
  const size = compact ? 36 : 44;
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-left transition hover:bg-[var(--surface-2)]"
    >
      <ArtThumb
        slug={ex.art}
        size={size}
        fallback={<ExerciseIcon ex={ex} size={size} />}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-extrabold">{ex.name}</p>
        <p className="flex items-center gap-1.5 truncate text-[11px] font-bold text-mute">
          <MuscleDot id={ex.primary} />{' '}
          {tm(ex.primary, MUSCLE_LABEL[ex.primary] ?? ex.primary)}
          <span className="opacity-40">·</span> {t(ex.equipment)}
        </p>
      </div>
      {right}
    </button>
  );
}
