"use client";

import { useId } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { fixed, formatShortWib } from "@/lib/format";

const AXIS = { stroke: "#6b6f75", fontSize: 11, fontFamily: "var(--font-mono)" };
const GRID = "rgba(24,20,20,0.12)";
const PAPER = "#ffffff";
const SEA = "#d01f16";

export interface WavePoint {
  time: number;
  height: number;
}

function timeLabel(value: unknown): string {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Jakarta",
  }).format(new Date(Number(value as number | string)));
}

function dayLabel(value: unknown): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    timeZone: "Asia/Jakarta",
  }).format(new Date(Number(value as number | string)));
}

/**
 * One-metric wave chart for the citizen page: wave height over the last day with
 * the safe limit for the selected activity drawn as a reference line. No second
 * axis and no technical series — the console keeps the full telemetry view.
 */
export function WaveHistoryChart({
  points,
  limit,
  limitLabel,
  height = 210,
}: {
  points: WavePoint[];
  limit: number;
  limitLabel: string;
  height?: number;
}) {
  const gradientId = useId();
  const data = [...points].sort((a, b) => a.time - b.time);

  if (data.length < 2) {
    return (
      <div className="grid h-[210px] place-items-center border border-dashed border-line-strong px-6 text-center">
        <p className="text-[13.5px] leading-relaxed text-muted">
          Belum cukup pembacaan untuk menggambar grafik di rentang ini.
        </p>
      </div>
    );
  }

  const peak = Math.max(...data.map((point) => point.height), limit);
  const top = Math.max(Math.ceil((peak + 0.35) * 2) / 2, limit + 0.5);
  // A seven-day window needs date ticks; a one-day window needs clock ticks.
  const multiDay = (data[data.length - 1].time - data[0].time) / 3_600_000 > 30;
  const tickText = multiDay ? dayLabel : timeLabel;
  const tooltipText = (value: unknown) =>
    multiDay
      ? `${formatShortWib(new Date(Number(value)).toISOString())} WIB`
      : `${timeLabel(value)} WIB`;

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 12, right: 10, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={SEA} stopOpacity={0.16} />
              <stop offset="100%" stopColor={SEA} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={GRID} strokeDasharray="2 4" vertical={false} />
          <XAxis
            dataKey="time"
            type="number"
            scale="time"
            domain={["dataMin", "dataMax"]}
            tick={AXIS}
            tickLine={false}
            axisLine={{ stroke: "#0e1b26", strokeOpacity: 0.26 }}
            minTickGap={multiDay ? 96 : 44}
            tickFormatter={tickText}
          />
          <YAxis
            domain={[0, top]}
            ticks={[0, Math.round((top / 2) * 10) / 10, top]}
            tick={AXIS}
            tickLine={false}
            axisLine={false}
            width={38}
            tickFormatter={(value: number) => `${fixed(value, 1)}`}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 0,
              border: "1px solid rgba(24,20,20,0.18)",
              background: PAPER,
              color: "#0e1b26",
              fontSize: 12,
              fontFamily: "var(--font-sans)",
              boxShadow: "none",
            }}
            labelFormatter={(label) => tooltipText(label)}
            formatter={(value) => [`${fixed(Number(value), 2)} m`, "Tinggi ombak"]}
          />
          <ReferenceLine
            y={limit}
            stroke="#a34a06"
            strokeDasharray="4 3"
            strokeWidth={1.4}
            label={{ value: limitLabel, position: "insideTopRight", fill: "#a34a06", fontSize: 10 }}
          />
          <Area
            type="monotone"
            dataKey="height"
            name="Tinggi ombak"
            stroke={SEA}
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            dot={false}
            activeDot={{ r: 3, fill: SEA, stroke: PAPER }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
