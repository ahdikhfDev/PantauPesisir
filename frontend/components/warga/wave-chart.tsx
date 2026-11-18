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

import { fixed } from "@/lib/format";

const AXIS = { stroke: "#6d7a7c", fontSize: 10, fontFamily: "var(--font-mono)" };
const GRID = "#e5e1d6";

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
      <div className="grid h-[210px] place-items-center rounded-[10px] border border-dashed border-line-strong px-6 text-center">
        <p className="text-[12px] leading-relaxed text-muted">
          Belum cukup pembacaan untuk menggambar 24 jam terakhir.
        </p>
      </div>
    );
  }

  const peak = Math.max(...data.map((point) => point.height), limit);
  const top = Math.max(Math.ceil((peak + 0.35) * 2) / 2, limit + 0.5);

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 12, right: 10, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#123f46" stopOpacity={0.18} />
              <stop offset="100%" stopColor="#123f46" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={GRID} strokeDasharray="3 4" vertical={false} />
          <XAxis
            dataKey="time"
            type="number"
            scale="time"
            domain={["dataMin", "dataMax"]}
            tick={AXIS}
            tickLine={false}
            axisLine={{ stroke: GRID }}
            minTickGap={44}
            tickFormatter={timeLabel}
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
              borderRadius: 10,
              border: "1px solid #e5e1d6",
              fontSize: 11,
              fontFamily: "var(--font-sans)",
              boxShadow: "0 18px 40px -30px rgba(17,24,27,0.5)",
            }}
            labelFormatter={(label) => `${timeLabel(label)} WIB`}
            formatter={(value) => [`${fixed(Number(value), 2)} m`, "Tinggi ombak"]}
          />
          <ReferenceLine
            y={limit}
            stroke="#94651a"
            strokeDasharray="5 4"
            strokeWidth={1.2}
            label={{ value: limitLabel, position: "insideTopRight", fill: "#94651a", fontSize: 9 }}
          />
          <Area
            type="monotone"
            dataKey="height"
            name="Tinggi ombak"
            stroke="#123f46"
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            dot={false}
            activeDot={{ r: 3 }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
