import clsx from 'clsx';
import { useState } from 'react';
import { MUSCLE_LABEL } from '../lib/stats';
import { useI18n } from '../lib/i18n';
import type { MuscleId } from '../types';

const TH: Record<string, string> = {
  front: 'ด้านหน้า',
  back: 'ด้านหลัง',
  '{side} body map': 'แผนที่ร่างกาย{side}',
  '{muscle}: {n} working sets': '{muscle}: {n} เซ็ตทำงาน',
};

interface Props {
  selected?: string[];
  onToggle?: (id: MuscleId) => void;
  heat?: Record<string, number>;
  compact?: boolean;
}

const FRONT: { id: MuscleId; render: (p: RegionProps) => React.ReactNode }[] = [
  {
    id: 'chest',
    render: (p) => (
      <>
        <ellipse cx="94" cy="104" rx="16" ry="13" {...p} />
        <ellipse cx="126" cy="104" rx="16" ry="13" {...p} />
      </>
    ),
  },
  {
    id: 'shoulders',
    render: (p) => (
      <>
        <ellipse cx="69" cy="88" rx="13" ry="12" {...p} />
        <ellipse cx="151" cy="88" rx="13" ry="12" {...p} />
      </>
    ),
  },
  {
    id: 'biceps',
    render: (p) => (
      <>
        <ellipse cx="61" cy="121" rx="9.5" ry="19" {...p} />
        <ellipse cx="159" cy="121" rx="9.5" ry="19" {...p} />
      </>
    ),
  },
  {
    id: 'forearm',
    render: (p) => (
      <>
        <ellipse
          cx="51"
          cy="163"
          rx="8"
          ry="21"
          transform="rotate(6 51 163)"
          {...p}
        />
        <ellipse
          cx="169"
          cy="163"
          rx="8"
          ry="21"
          transform="rotate(-6 169 163)"
          {...p}
        />
      </>
    ),
  },
  {
    id: 'abdomen',
    render: (p) => <rect x="96" y="129" width="28" height="56" rx="9" {...p} />,
  },
  {
    id: 'obliques',
    render: (p) => (
      <>
        <path d="M96 132 Q86 142 87 168 L92 182 L96 176 Z" {...p} />
        <path d="M124 132 Q134 142 133 168 L128 182 L124 176 Z" {...p} />
      </>
    ),
  },
  {
    id: 'quads',
    render: (p) => (
      <>
        <ellipse cx="93" cy="251" rx="15" ry="39" {...p} />
        <ellipse cx="127" cy="251" rx="15" ry="39" {...p} />
      </>
    ),
  },
];

const BACK: { id: MuscleId; render: (p: RegionProps) => React.ReactNode }[] = [
  {
    id: 'trapezius',
    render: (p) => (
      <path
        d="M88 73 Q110 64 132 73 L145 96 L125 90 L110 86 L95 90 L75 96 Z"
        {...p}
      />
    ),
  },
  {
    id: 'back',
    render: (p) => (
      <>
        <path d="M91 96 Q76 108 78 142 L92 158 L96 118 Z" {...p} />
        <path d="M129 96 Q144 108 142 142 L128 158 L124 118 Z" {...p} />
      </>
    ),
  },
  {
    id: 'lowerback',
    render: (p) => <rect x="96" y="150" width="28" height="38" rx="9" {...p} />,
  },
  {
    id: 'triceps',
    render: (p) => (
      <>
        <ellipse cx="61" cy="123" rx="9.5" ry="20" {...p} />
        <ellipse cx="159" cy="123" rx="9.5" ry="20" {...p} />
      </>
    ),
  },
  {
    id: 'glutes',
    render: (p) => (
      <>
        <ellipse cx="97" cy="205" rx="18" ry="16" {...p} />
        <ellipse cx="123" cy="205" rx="18" ry="16" {...p} />
      </>
    ),
  },
  {
    id: 'hamstrings',
    render: (p) => (
      <>
        <ellipse cx="93" cy="252" rx="15" ry="38" {...p} />
        <ellipse cx="127" cy="252" rx="15" ry="38" {...p} />
      </>
    ),
  },
  {
    id: 'calves',
    render: (p) => (
      <>
        <ellipse cx="95" cy="329" rx="11" ry="24" {...p} />
        <ellipse cx="125" cy="329" rx="11" ry="24" {...p} />
      </>
    ),
  },
];

type RegionProps = {
  fill: string;
  stroke: string;
  strokeWidth: number;
  opacity?: number;
  className: string;
  onClick?: () => void;
  style?: React.CSSProperties;
  'aria-label'?: string;
  role?: string;
  tabIndex?: number;
  onKeyDown?: React.KeyboardEventHandler;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
};

function Body({
  side,
  selected = [],
  onToggle,
  heat,
}: { side: 'front' | 'back' } & Props) {
  const { t, tm } = useI18n(TH);
  const regions = side === 'front' ? FRONT : BACK;
  const [hover, setHover] = useState<string | null>(null);
  const maxHeat = heat ? Math.max(1, ...Object.values(heat)) : 1;

  const bodyFill = 'rgb(var(--elevated))';
  const heatFills = [
    'rgb(var(--heat-0))',
    'rgb(var(--heat-1))',
    'rgb(var(--heat-2))',
    'rgb(var(--heat-3))',
    'rgb(var(--heat-4))',
  ];
  const heatFill = (value: number) => {
    if (value <= 0) return heatFills[0];
    const level = Math.min(4, Math.max(1, Math.ceil((value / maxHeat) * 4)));
    return heatFills[level];
  };

  return (
    <svg
      viewBox="0 0 220 390"
      className="h-auto w-full max-w-[240px] select-none"
      role="group"
      aria-label={t('{side} body map', { side: t(side) })}
    >
      <defs>
        <filter
          id={`glow-${side}`}
          x="-30%"
          y="-30%"
          width="160%"
          height="160%"
        >
          <feGaussianBlur stdDeviation="3" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* silhouette */}
      <g fill={bodyFill} stroke="rgb(var(--border))" strokeWidth="1">
        <circle cx="110" cy="40" r="21" />
        <rect x="102" y="57" width="16" height="12" rx="5" />
        <ellipse cx="110" cy="78" rx="32" ry="10" />
        <path d="M78 78 Q110 69 142 78 L146 132 Q144 170 132 198 L88 198 Q76 170 74 132 Z" />
        <path d="M88 194 Q110 204 132 194 L136 224 Q110 238 84 224 Z" />
        <ellipse
          cx="62"
          cy="110"
          rx="11"
          ry="27"
          transform="rotate(6 62 110)"
        />
        <ellipse
          cx="158"
          cy="110"
          rx="11"
          ry="27"
          transform="rotate(-6 158 110)"
        />
        <ellipse
          cx="51"
          cy="159"
          rx="8.5"
          ry="25"
          transform="rotate(7 51 159)"
        />
        <ellipse
          cx="169"
          cy="159"
          rx="8.5"
          ry="25"
          transform="rotate(-7 169 159)"
        />
        <circle cx="47" cy="187" r="7" />
        <circle cx="173" cy="187" r="7" />
        <ellipse cx="94" cy="254" rx="18" ry="46" />
        <ellipse cx="126" cy="254" rx="18" ry="46" />
        <ellipse cx="95" cy="333" rx="12" ry="37" />
        <ellipse cx="125" cy="333" rx="12" ry="37" />
        <path d="M88 368 Q95 368 99 380 L88 380 Z" />
        <path d="M132 368 Q125 368 121 380 L132 380 Z" />
      </g>

      {/* muscle regions */}
      {regions.map(({ id, render }) => {
        const on = selected.includes(id);
        const hv = heat?.[id] ?? 0;
        return (
          <g
            key={id}
            role={onToggle ? 'button' : 'img'}
            tabIndex={onToggle ? 0 : undefined}
            aria-label={
              heat
                ? t('{muscle}: {n} working sets', {
                    muscle: tm(id, MUSCLE_LABEL[id]),
                    n: Math.round(hv * 10) / 10,
                  })
                : tm(id, MUSCLE_LABEL[id])
            }
            aria-pressed={onToggle ? on : undefined}
            onClick={onToggle ? () => onToggle(id) : undefined}
            onKeyDown={(event) => {
              if (onToggle && (event.key === 'Enter' || event.key === ' ')) {
                event.preventDefault();
                onToggle(id);
              }
            }}
            onMouseEnter={() => setHover(id)}
            onMouseLeave={() => setHover(null)}
          >
            {render({
              fill: on
                ? 'rgb(var(--brand))'
                : heat
                  ? heatFill(hv)
                  : 'rgb(var(--inset))',
              stroke: on
                ? 'rgb(var(--brand))'
                : hover === id
                  ? 'rgb(var(--brand) / 0.35)'
                  : 'rgb(var(--border))',
              strokeWidth: on ? 1.6 : 1,
              opacity: on ? 0.95 : 1,
              className: clsx(
                'transition-all duration-150',
                onToggle && 'cursor-pointer',
              ),
              style: { filter: on ? `url(#glow-${side})` : undefined },
            })}
            <text
              x="110"
              y="386"
              textAnchor="middle"
              className="pointer-events-none"
              fontSize="0"
            >
              {tm(id, MUSCLE_LABEL[id])}
            </text>
          </g>
        );
      })}

      <text
        x="110"
        y="388"
        textAnchor="middle"
        fontSize="9"
        fontWeight="800"
        fill="rgb(var(--fg-muted))"
        className="pointer-events-none uppercase tracking-widest"
      >
        {t(side)}
      </text>
      {hover && (
        <text
          x="110"
          y="12"
          textAnchor="middle"
          fontSize="10"
          fontWeight="800"
          fill="rgb(var(--brand))"
          className="pointer-events-none"
        >
          {tm(hover, MUSCLE_LABEL[hover as MuscleId])}
        </text>
      )}
    </svg>
  );
}

export default function BodyMap({
  selected = [],
  onToggle,
  heat,
  compact,
}: Props) {
  const { t } = useI18n(TH);
  const [tab, setTab] = useState<'front' | 'back'>('front');
  return (
    <div>
      <div className={clsx('grid gap-2', 'sm:grid-cols-2')}>
        <div
          className={clsx(
            'flex justify-center',
            tab !== 'front' && 'hidden sm:flex',
          )}
        >
          <Body
            side="front"
            selected={selected}
            onToggle={onToggle}
            heat={heat}
            compact={compact}
          />
        </div>
        <div
          className={clsx(
            'flex justify-center',
            tab !== 'back' && 'hidden sm:flex',
          )}
        >
          <Body
            side="back"
            selected={selected}
            onToggle={onToggle}
            heat={heat}
            compact={compact}
          />
        </div>
      </div>
      <div className="mt-2 flex justify-center gap-2 sm:hidden">
        {(['front', 'back'] as const).map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={tab === s}
            onClick={() => setTab(s)}
            className={clsx(
              'rounded-full px-4 py-1.5 text-xs font-black capitalize',
              tab === s
                ? 'bg-inset text-fg'
                : 'text-mute',
            )}
          >
            {t(s)}
          </button>
        ))}
      </div>
    </div>
  );
}
