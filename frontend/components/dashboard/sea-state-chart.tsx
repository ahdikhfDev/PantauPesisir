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

const AXIS = { stroke: "#6d7a7c", fontSize: 10, fontFamily: "var(--font-mono)" };
const GRID = "#e5e1d6";

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
    timeZone: "UTC",
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
              <stop offset="0%" stopColor="#d93a2b" stopOpacity={0.2} />
              <stop offset="100%" stopColor="#d93a2b" stopOpacity={0} />
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
            minTickGap={36}
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
              borderRadius: 12,
              border: "1px solid #e5e1d6",
              fontSize: 11,
              fontFamily: "var(--font-sans)",
              boxShadow: "0 18px 40px -30px rgba(17,24,27,0.5)",
            }}
            labelFormatter={(label) => `${timeLabel(label)} UTC`}
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
            stroke="#d93a2b"
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            dot={false}
            activeDot={{ r: 3 }}
            isAnimationActive={false}
          />
          <Line
            yAxisId="wind"
            type="monotone"
            dataKey="wind"
            name="Kecepatan angin"
            stroke="#123f46"
            strokeWidth={1.5}
            strokeDasharray="5 4"
            dot={false}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
