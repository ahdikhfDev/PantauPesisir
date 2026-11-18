"use client";

import { useId } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { EmptyState } from "@/components/ui";
import { fixed } from "@/lib/format";
import type { Observation } from "@/lib/types";

const AXIS = { stroke: "#6d7a7c", fontSize: 10, fontFamily: "var(--font-mono)" };
const GRID = "#e5e1d6";

function timeLabel(value: unknown): string {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Jakarta",
  }).format(new Date(Number(value as number | string)));
}

export function ObservationCharts({ items }: { items: Observation[] }) {
  const gradientId = useId();
  const data = [...items]
    .filter((item) => item.validation_status === "valid")
    .reverse()
    .map((item) => ({
      time: new Date(item.observed_at).getTime(),
      label: new Intl.DateTimeFormat("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "Asia/Jakarta",
      }).format(new Date(item.observed_at)),
      height: item.parameters.wave_height_m,
      wind: item.parameters.wind_speed_mps,
      period: item.parameters.wave_period_s,
      pressure: item.parameters.air_pressure_hpa,
    }));

  if (data.length < 2) {
    return (
      <EmptyState
        title="Pembacaan valid belum cukup untuk seri"
        description="Kirim batch telemetri atau perpanjang rentang waktu. Catatan tidak valid atau dikarantina dikecualikan dari grafik."
      />
    );
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[1.35fr_1fr]">
      <div className="card p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-semibold tracking-[-0.02em]">Kondisi laut pada jendela</h2>
            <p className="mt-1 text-[11px] text-muted">
              Tinggi gelombang signifikan (m) dan kecepatan angin (m/s) · telemetri buoy · WIB
            </p>
          </div>
          <div className="flex items-center gap-3 text-[10px] font-semibold ">
            <span className="flex items-center gap-1.5 text-signal">
              <span className="h-2 w-2 rounded-full bg-signal" aria-hidden /> Tinggi gelombang
            </span>
            <span className="flex items-center gap-1.5 text-sea">
              <span className="h-2 w-2 rounded-full bg-sea" aria-hidden /> Angin
            </span>
          </div>
        </div>

        <div className="mt-5 h-[260px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: -18 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#d93a2b" stopOpacity={0.22} />
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
                minTickGap={28}
                tickFormatter={(value: number) =>
                  new Intl.DateTimeFormat("en-GB", {
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                    timeZone: "Asia/Jakarta",
                  }).format(new Date(value))
                }
              />
              <YAxis
                yAxisId="height"
                tick={AXIS}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value: number) => `${fixed(value, 1)}`}
                label={{ value: "m", angle: -90, position: "insideLeft", fill: "#6d7a7c", fontSize: 10 }}
              />
              <YAxis
                yAxisId="wind"
                orientation="right"
                tick={AXIS}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value: number) => `${fixed(value, 0)}`}
                label={{ value: "m/s", angle: 90, position: "insideRight", fill: "#6d7a7c", fontSize: 10 }}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: 12,
                  border: "1px solid #e5e1d6",
                  fontSize: 11,
                  fontFamily: "var(--font-sans)",
                  boxShadow: "0 18px 40px -30px rgba(17,24,27,0.5)",
                }}
                labelFormatter={(label) => `${timeLabel(label)} WIB`}
                formatter={(value, name) => [
                  `${fixed(Number(value), 2)} ${name === "Tinggi gelombang" ? "m" : "m/s"}`,
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
                strokeWidth={1.6}
                strokeDasharray="5 4"
                dot={false}
                isAnimationActive={false}
              />
              <Legend wrapperStyle={{ display: "none" }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card p-5 sm:p-6">
        <div>
          <h2 className="text-[15px] font-semibold tracking-[-0.02em]">Tekanan & periode</h2>
          <p className="mt-1 text-[11px] text-muted">
            Barometer yang turun dengan periode yang memanjang adalah pola yang dipantau model.
          </p>
        </div>

        <div className="mt-5 h-[260px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: -20 }}>
              <CartesianGrid stroke={GRID} strokeDasharray="3 4" vertical={false} />
              <XAxis dataKey="time" type="number" scale="time" domain={["dataMin", "dataMax"]} tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} minTickGap={28} tickFormatter={timeLabel} />
              <YAxis
                yAxisId="pressure"
                domain={["auto", "auto"]}
                tick={AXIS}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value: number) => `${fixed(value, 0)}`}
              />
              <YAxis
                yAxisId="period"
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
                }}
                labelFormatter={(label) => `${timeLabel(label)} WIB`}
                formatter={(value, name) => [
                  `${fixed(Number(value), 1)} ${name === "Tekanan udara" ? "hPa" : "s"}`,
                  name,
                ]}
              />
              <Line
                yAxisId="pressure"
                type="monotone"
                dataKey="pressure"
                name="Tekanan udara"
                stroke="#94651a"
                strokeWidth={1.8}
                dot={false}
                isAnimationActive={false}
              />
              <Line
                yAxisId="period"
                type="monotone"
                dataKey="period"
                name="Periode gelombang"
                stroke="#123f46"
                strokeWidth={1.6}
                dot={false}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
