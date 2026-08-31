"use client";

import { useRef, useState } from "react";
import { formatCompactNumber } from "@/lib/format";

const WIDTH = 320;
const HEIGHT = 120;
const PADDING_X = 4;
const PADDING_TOP = 16;
const PADDING_BOTTOM = 20;

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function formatValue(value: number, unit: "count" | "sats"): string {
  if (unit === "sats") {
    return `${formatCompactNumber(value)} sats`;
  }
  return value.toLocaleString();
}

export default function TrendChart({
  label,
  points,
  unit,
}: {
  label: string;
  points: { date: string; value: number }[];
  unit: "count" | "sats";
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  if (points.length < 2) {
    return (
      <div className="rounded-2xl border border-black/[.08] bg-white p-4 dark:border-white/[.145] dark:bg-zinc-900">
        <p className="text-xs uppercase tracking-wide text-zinc-500">
          {label}
        </p>
        <p className="mt-6 text-sm text-zinc-500">
          Trend coming soon — not enough history yet.
        </p>
      </div>
    );
  }

  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const plotWidth = WIDTH - PADDING_X * 2;
  const plotHeight = HEIGHT - PADDING_TOP - PADDING_BOTTOM;

  const x = (i: number) => PADDING_X + (i / (points.length - 1)) * plotWidth;
  const y = (v: number) =>
    PADDING_TOP + plotHeight - ((v - min) / range) * plotHeight;

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(p.value)}`)
    .join(" ");
  const areaPath = `${linePath} L${x(points.length - 1)},${
    PADDING_TOP + plotHeight
  } L${x(0)},${PADDING_TOP + plotHeight} Z`;

  const last = points[points.length - 1];
  const active = hoverIndex !== null ? points[hoverIndex] : last;
  const activeIndex = hoverIndex ?? points.length - 1;

  function handleMove(e: React.PointerEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const fraction = (e.clientX - rect.left) / rect.width;
    const i = Math.round(fraction * (points.length - 1));
    setHoverIndex(Math.min(points.length - 1, Math.max(0, i)));
  }

  return (
    <div className="rounded-2xl border border-black/[.08] bg-white p-4 dark:border-white/[.145] dark:bg-zinc-900">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs uppercase tracking-wide text-zinc-500">
          {label}
        </p>
        <p className="font-mono text-xs text-zinc-500">
          {formatDate(active.date)}
        </p>
      </div>
      <p className="mt-1 text-xl font-semibold tabular-nums">
        {formatValue(active.value, unit)}
      </p>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="mt-2 w-full touch-none"
        role="img"
        aria-label={`${label} trend from ${formatDate(points[0].date)} to ${formatDate(last.date)}`}
        onPointerMove={handleMove}
        onPointerLeave={() => setHoverIndex(null)}
      >
        <line
          x1={PADDING_X}
          x2={WIDTH - PADDING_X}
          y1={PADDING_TOP + plotHeight}
          y2={PADDING_TOP + plotHeight}
          className="stroke-zinc-200 dark:stroke-zinc-700"
          strokeWidth={1}
        />
        <path
          d={areaPath}
          className="fill-amber-500/10 dark:fill-amber-400/10"
        />
        <path
          d={linePath}
          fill="none"
          className="stroke-amber-600 dark:stroke-amber-500"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {hoverIndex !== null && (
          <line
            x1={x(activeIndex)}
            x2={x(activeIndex)}
            y1={PADDING_TOP}
            y2={PADDING_TOP + plotHeight}
            className="stroke-zinc-300 dark:stroke-zinc-600"
            strokeWidth={1}
          />
        )}
        <circle
          cx={x(activeIndex)}
          cy={y(active.value)}
          r={6}
          className="fill-white dark:fill-zinc-900"
        />
        <circle
          cx={x(activeIndex)}
          cy={y(active.value)}
          r={4}
          className="fill-amber-600 dark:fill-amber-500"
        />
      </svg>

      <details className="mt-2">
        <summary className="cursor-pointer text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
          View as table
        </summary>
        <div className="mt-2 max-h-40 overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-zinc-500">
                <th className="pb-1 pr-2 font-normal">Date</th>
                <th className="pb-1 font-normal">{label}</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {[...points].reverse().map((p) => (
                <tr key={p.date}>
                  <td className="py-0.5 pr-2 text-zinc-500">
                    {formatDate(p.date)}
                  </td>
                  <td className="py-0.5">{formatValue(p.value, unit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
