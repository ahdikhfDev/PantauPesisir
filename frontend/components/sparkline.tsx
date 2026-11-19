"use client";

import { useId } from "react";

const STROKE = {
  ink: "#0e1b26",
  sea: "#5f6f7c",
  signal: "#c9200f",
} as const;

export function Sparkline({
  values,
  width = 168,
  height = 44,
  tone = "sea",
  strokeWidth = 1.6,
  showArea = true,
}: {
  values: number[];
  width?: number;
  height?: number;
  tone?: keyof typeof STROKE;
  strokeWidth?: number;
  showArea?: boolean;
}) {
  const gradientId = useId();
  const clean = values.filter((value) => Number.isFinite(value));
  if (clean.length < 2) {
    return (
      <svg width={width} height={height} aria-hidden>
        <line x1="0" y1={height / 2} x2={width} y2={height / 2} stroke="currentColor" strokeOpacity="0.25" />
      </svg>
    );
  }
  const min = Math.min(...clean);
  const max = Math.max(...clean);
  const span = max - min || 1;
  const pad = 3;
  const points = clean.map((value, index) => {
    const x = (index / (clean.length - 1)) * width;
    const y = height - pad - ((value - min) / span) * (height - pad * 2);
    return [x, y] as const;
  });
  const path = points
    .map(([x, y], index) => `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`)
    .join(" ");
  const area = `${path} L${width},${height} L0,${height} Z`;
  const stroke = STROKE[tone];

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} fill="none" aria-hidden>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity={0.16} />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      {showArea ? <path d={area} fill={`url(#${gradientId})`} /> : null}
      <path d={path} stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
