'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ HOOKS */

/** Mede o container para desenhar em pixels reais (traços sempre com 2px). */
function useSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    setWidth(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);

  return { ref, width };
}

/** Índice sob o ponteiro; funciona com mouse e com toque (pointer events). */
function useHoverIndex(count: number, width: number, padLeft: number, padRight: number) {
  const [index, setIndex] = useState<number | null>(null);

  const onMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const inner = width - padLeft - padRight;
      if (inner <= 0 || count < 2) return;
      const x = e.clientX - rect.left - padLeft;
      const step = inner / (count - 1);
      setIndex(Math.max(0, Math.min(count - 1, Math.round(x / step))));
    },
    [count, width, padLeft, padRight],
  );

  return { index, setIndex, onMove };
}

/* ------------------------------------------------------------- FORMATAÇÃO */

/**
 * Descritor de formato — precisa ser serializável para que Server Components
 * possam passá-lo a estes gráficos (funções não cruzam essa fronteira).
 */
export type NumberFormat = {
  /** Casas decimais; pt-BR renderiza com vírgula. */
  decimals?: number;
  prefix?: string;
  suffix?: string;
};

function formatValue(v: number, fmt?: NumberFormat) {
  const d = fmt?.decimals ?? 0;
  const n = v.toLocaleString('pt-BR', {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  });
  return `${fmt?.prefix ?? ''}${n}${fmt?.suffix ?? ''}`;
}

/* --------------------------------------------------------------- TOOLTIP */

function Tooltip({
  x,
  label,
  value,
  align,
}: {
  x: number;
  label: string;
  value: string;
  align: 'left' | 'center' | 'right';
}) {
  return (
    <div
      className="pointer-events-none absolute top-0 z-10 -translate-y-1"
      style={{
        left: x,
        transform:
          align === 'left'
            ? 'translateX(0)'
            : align === 'right'
              ? 'translateX(-100%)'
              : 'translateX(-50%)',
      }}
    >
      <div className="whitespace-nowrap rounded-lg border border-line bg-surface px-2.5 py-1.5 shadow-pop">
        <div className="text-2xs font-medium text-muted">{label}</div>
        <div className="text-sm font-bold tabular-nums text-fg">{value}</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- LINE CHART */

export function LineChart({
  data,
  labels,
  format,
  height = 160,
  color = 'brand',
  className,
  caption,
}: {
  data: number[];
  labels: string[];
  format?: NumberFormat;
  height?: number;
  color?: 'brand' | 'cat-1' | 'cat-2';
  className?: string;
  /** Descrição textual para leitores de tela. */
  caption: string;
}) {
  const { ref, width } = useSize<HTMLDivElement>();
  const PAD_L = 8;
  const PAD_R = 8;
  const PAD_T = 20;
  const PAD_B = 22;
  const { index, setIndex, onMove } = useHoverIndex(data.length, width, PAD_L, PAD_R);

  const stroke = `hsl(var(--${color === 'brand' ? 'brand' : color}))`;
  const innerW = Math.max(0, width - PAD_L - PAD_R);
  const innerH = height - PAD_T - PAD_B;

  // Domínio com folga de 12% — linhas não precisam começar no zero.
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const lo = min - span * 0.12;
  const hi = max + span * 0.12;

  const x = (i: number) => PAD_L + (innerW * i) / Math.max(1, data.length - 1);
  const y = (v: number) => PAD_T + innerH - ((v - lo) / (hi - lo)) * innerH;

  const line = data.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(v)}`).join(' ');
  const area = `${line} L${x(data.length - 1)},${PAD_T + innerH} L${x(0)},${PAD_T + innerH} Z`;

  const active = index ?? null;
  const gradId = `ryse-area-${color}`;

  return (
    <figure className={cn('m-0', className)}>
      <div
        ref={ref}
        className="relative touch-pan-y select-none"
        style={{ height }}
        onPointerMove={onMove}
        onPointerDown={onMove}
        onPointerLeave={() => setIndex(null)}
      >
        {width > 0 && (
          <svg
            width={width}
            height={height}
            role="img"
            aria-label={caption}
            className="overflow-visible"
          >
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={stroke} stopOpacity="0.18" />
                <stop offset="100%" stopColor={stroke} stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* grade recessiva: 3 linhas tracejadas, sem moldura */}
            {[0, 0.5, 1].map((t) => (
              <line
                key={t}
                x1={PAD_L}
                x2={width - PAD_R}
                y1={PAD_T + innerH * t}
                y2={PAD_T + innerH * t}
                stroke="hsl(var(--chart-grid))"
                strokeWidth={1}
                strokeDasharray="3 4"
              />
            ))}

            <path d={area} fill={`url(#${gradId})`} />
            <path
              d={line}
              fill="none"
              stroke={stroke}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {active !== null && (
              <>
                <line
                  x1={x(active)}
                  x2={x(active)}
                  y1={PAD_T - 4}
                  y2={PAD_T + innerH}
                  stroke="hsl(var(--chart-axis))"
                  strokeWidth={1}
                  strokeDasharray="3 3"
                />
                {/* anel de 2px na cor da superfície separa a marca do traço */}
                <circle
                  cx={x(active)}
                  cy={y(data[active])}
                  r={5}
                  fill={stroke}
                  stroke="hsl(var(--surface))"
                  strokeWidth={2}
                />
              </>
            )}

            {/* último ponto sempre visível — ancora a leitura no valor atual */}
            {active === null && (
              <circle
                cx={x(data.length - 1)}
                cy={y(data[data.length - 1])}
                r={5}
                fill={stroke}
                stroke="hsl(var(--surface))"
                strokeWidth={2}
              />
            )}

            {/* rótulos do eixo x: apenas extremos e meio, para não colidir */}
            {[0, Math.floor((labels.length - 1) / 2), labels.length - 1].map((i, k) => (
              <text
                key={`${i}-${k}`}
                x={x(i)}
                y={height - 6}
                textAnchor={k === 0 ? 'start' : k === 2 ? 'end' : 'middle'}
                className="fill-subtle text-[11px] font-medium"
              >
                {labels[i]}
              </text>
            ))}
          </svg>
        )}

        {active !== null && width > 0 && (
          <Tooltip
            x={x(active)}
            label={labels[active]}
            value={formatValue(data[active], format)}
            align={active === 0 ? 'left' : active === data.length - 1 ? 'right' : 'center'}
          />
        )}
      </div>
      <figcaption className="sr-only">{caption}</figcaption>
    </figure>
  );
}

/* -------------------------------------------------------------- BAR CHART */

export function BarChart({
  data,
  labels,
  format,
  height = 150,
  color = 'brand',
  highlightLast = true,
  className,
  caption,
}: {
  data: number[];
  labels: string[];
  format?: NumberFormat;
  height?: number;
  color?: 'brand' | 'cat-1' | 'cat-2' | 'cat-3';
  highlightLast?: boolean;
  className?: string;
  caption: string;
}) {
  const { ref, width } = useSize<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);

  const PAD_T = 18;
  const PAD_B = 22;
  const innerH = height - PAD_T - PAD_B;
  // Barras SEMPRE ancoradas no zero — truncar a base distorce a comparação.
  const max = Math.max(...data, 1);
  const fill = `hsl(var(--${color}))`;

  return (
    <figure className={cn('m-0', className)}>
      <div ref={ref} className="relative select-none" style={{ height }}>
        {width > 0 && (
          <>
            <svg width={width} height={height} role="img" aria-label={caption}>
              <line
                x1={0}
                x2={width}
                y1={PAD_T + innerH}
                y2={PAD_T + innerH}
                stroke="hsl(var(--chart-grid))"
                strokeWidth={1}
              />
              {data.map((v, i) => {
                // 2px de respiro entre barras vizinhas
                const slot = width / data.length;
                const barW = Math.min(28, slot - 6);
                const cx = slot * i + slot / 2;
                const h = Math.max(3, (v / max) * innerH);
                const isActive = active === i;
                const dim = highlightLast && i !== data.length - 1 && active === null;
                return (
                  <g key={i}>
                    <rect
                      x={cx - barW / 2}
                      y={PAD_T + innerH - h}
                      width={barW}
                      height={h}
                      rx={4}
                      fill={fill}
                      opacity={isActive ? 1 : dim ? 0.38 : 0.85}
                      className="transition-opacity"
                    />
                    <text
                      x={cx}
                      y={height - 6}
                      textAnchor="middle"
                      className={cn(
                        'text-[11px] font-medium',
                        isActive ? 'fill-fg' : 'fill-subtle',
                      )}
                    >
                      {labels[i]}
                    </text>
                    {/* alvo de toque maior que a marca */}
                    <rect
                      x={slot * i}
                      y={0}
                      width={slot}
                      height={height}
                      fill="transparent"
                      onPointerEnter={() => setActive(i)}
                      onPointerDown={() => setActive(i)}
                      onPointerLeave={() => setActive(null)}
                    />
                  </g>
                );
              })}
            </svg>

            {active !== null && (
              <Tooltip
                x={(width / data.length) * active + width / data.length / 2}
                label={labels[active]}
                value={formatValue(data[active], format)}
                align={
                  active === 0 ? 'left' : active === data.length - 1 ? 'right' : 'center'
                }
              />
            )}
          </>
        )}
      </div>
      <figcaption className="sr-only">{caption}</figcaption>
    </figure>
  );
}

/* ------------------------------------------------------------ STACKED BAR */

/**
 * Composição categórica em barra única.
 * Identidade nunca fica só na cor: legenda + rótulo direto acompanham cada fatia.
 */
export function StackedBar({
  segments,
  className,
}: {
  segments: { name: string; value: number; percent: number }[];
  className?: string;
}) {
  const colors = ['bg-cat-1', 'bg-cat-2', 'bg-cat-3'];
  const dots = ['bg-cat-1', 'bg-cat-2', 'bg-cat-3'];

  return (
    <div className={className}>
      {/* gap-0.5 = 2px de superfície entre as fatias */}
      <div className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full">
        {segments.map((s, i) => (
          <div
            key={s.name}
            className={cn('h-full first:rounded-l-full last:rounded-r-full', colors[i % 3])}
            style={{ width: `${s.percent}%` }}
            title={`${s.name}: ${s.percent}%`}
          />
        ))}
      </div>

      <ul className="mt-4 space-y-3">
        {segments.map((s, i) => (
          <li key={s.name} className="flex items-center gap-2.5">
            <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', dots[i % 3])} aria-hidden />
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-fg">{s.name}</span>
            <span className="text-sm tabular-nums text-muted">{s.value}</span>
            <span className="w-11 text-right text-sm font-bold tabular-nums text-fg">
              {s.percent}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* -------------------------------------------------------------- RING METER */

/** Medidor circular — um número-herói, não um gráfico de pizza. */
export function Ring({
  value,
  max,
  label,
  display,
  unit,
  size = 108,
  color = 'brand',
}: {
  value: number;
  max: number;
  label: string;
  display: string;
  unit?: string;
  size?: number;
  color?: 'brand' | 'cat-1' | 'cat-2' | 'cat-3';
}) {
  const stroke = 9;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pctRaw = max > 0 ? value / max : 0;
  const pct = Math.max(0, Math.min(1, pctRaw));
  const [drawn, setDrawn] = useState(0);

  // Anima do zero na montagem; respeita prefers-reduced-motion via CSS.
  useEffect(() => {
    const id = requestAnimationFrame(() => setDrawn(pct));
    return () => cancelAnimationFrame(id);
  }, [pct]);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          className="-rotate-90"
          role="img"
          aria-label={`${label}: ${display}${unit ?? ''} de ${max}`}
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="hsl(var(--surface-3))"
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={`hsl(var(--${color}))`}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - drawn)}
            style={{ transition: 'stroke-dashoffset .9s cubic-bezier(.16,1,.3,1)' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-bold tabular-nums leading-none">{display}</span>
          {unit && <span className="mt-0.5 text-2xs font-medium text-subtle">{unit}</span>}
        </div>
      </div>
      <span className="text-sm font-medium text-muted">{label}</span>
    </div>
  );
}

/* --------------------------------------------------------------- SPARKLINE */

export function Sparkline({
  data,
  className,
  color = 'brand',
}: {
  data: number[];
  className?: string;
  color?: 'brand' | 'success' | 'danger';
}) {
  const w = 72;
  const h = 24;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const d = data
    .map((v, i) => {
      const x = (w * i) / (data.length - 1);
      const y = h - ((v - min) / span) * h;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <svg width={w} height={h} className={className} aria-hidden>
      <path
        d={d}
        fill="none"
        stroke={`hsl(var(--${color}))`}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
