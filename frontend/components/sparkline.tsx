"use client";

import { useId } from "react";

export function Sparkline({
  values,
  width = 168,
  height = 44,
  tone = "signal",
  strokeWidth = 1.8,
  showArea = true,
}: {
  values: number[];
  width?: number;
  height?: number;
  tone?: "signal" | "light" | "sea";
  strokeWidth?: number;
  showArea?: boolean;
}) {
  const gradientId = useId();
  const clean = values.filter((value) => Number.isFinite(value));
  if (clean.length < 2) {
    return (
      <svg width={width} height={height} aria-hidden>
        <line x1="0" y1={height / 2} x2={width} y2={height / 2} stroke="currentColor" strokeOpacity="0.2" />
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
  const stroke = tone === "signal" ? "#e23a2e" : tone === "sea" ? "#0f4b52" : "rgba(255,255,255,0.85)";
  const fill = tone === "signal" ? "#e23a2e" : tone === "sea" ? "#0f4b52" : "#ffffff";

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} fill="none" aria-hidden>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={fill} stopOpacity={tone === "light" ? 0.28 : 0.18} />
          <stop offset="100%" stopColor={fill} stopOpacity="0" />
        </linearGradient>
      </defs>
      {showArea ? <path d={area} fill={`url(#${gradientId})`} /> : null}
      <path d={path} stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <circle
        cx={points[points.length - 1][0]}
        cy={points[points.length - 1][1]}
        r="2.2"
        fill={stroke}
      />
    </svg>
  );
}
