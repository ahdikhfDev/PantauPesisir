"use client";

import { useId } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { EmptyState } from "@/components/ui";
import { fixed } from "@/lib/format";

const AXIS = { stroke: "#6b6f75", fontSize: 11, fontFamily: "var(--font-mono)" };
const GRID = "rgba(24,20,20,0.12)";
const PAPER = "#ffffff";

export interface SeaPoint {
  time: number;
  height: number;
  wind: number;
}

function timeLabel(value: unknown): string {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Jakarta",
  }).format(new Date(Number(value as number | string)));
}

export function SeaStateChart({ points, height = 280 }: { points: SeaPoint[]; height?: number }) {
  const gradientId = useId();
  const data = [...points].sort((a, b) => a.time - b.time);

  if (data.length < 2) {
    return (
      <EmptyState
        title="Menunggu pembacaan"
        description="Kirim batch telemetri atau perpanjang jendela waktu. Hanya baris valid yang digambar."
      />
    );
  }

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -20 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#d01f16" stopOpacity={0.14} />
              <stop offset="100%" stopColor="#d01f16" stopOpacity={0} />
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
            minTickGap={42}
            tickFormatter={timeLabel}
          />
          <YAxis
            yAxisId="height"
            tick={AXIS}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value: number) => `${fixed(value, 1)}`}
          />
          <YAxis
            yAxisId="wind"
            orientation="right"
            tick={AXIS}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value: number) => `${fixed(value, 0)}`}
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
            labelFormatter={(label) => `${timeLabel(label)} WIB`}
            formatter={(value, name) => [
              `${fixed(Number(value), name === "Tinggi gelombang" ? 2 : 1)} ${name === "Tinggi gelombang" ? "m" : "m/s"}`,
              name,
            ]}
          />
          <Area
            yAxisId="height"
            type="monotone"
            dataKey="height"
            name="Tinggi gelombang"
            stroke="#d01f16"
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            dot={false}
            activeDot={{ r: 3, fill: "#d01f16", stroke: PAPER }}
            isAnimationActive={false}
          />
          <Line
            yAxisId="wind"
            type="monotone"
            dataKey="wind"
            name="Kecepatan angin"
            stroke="#5f6f7c"
            strokeWidth={1.5}
            strokeDasharray="4 3"
            dot={false}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
