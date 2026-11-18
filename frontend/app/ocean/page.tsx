"use client";

import { ArrowUpRight, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { ObservationCharts } from "@/components/observation-charts";
import { SimulatorPanel } from "@/components/simulator-panel";
import {
  KeyValue,
  Metric,
  PageHero,
  SourceBadge,
  StatusPill,
} from "@/components/ui";
import { cn, compass, enumLabel, fixed, formatAge, formatShortUtc, formatUtc } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import type { HistoryResponse, LatestResponse, Zone } from "@/lib/types";

const RANGES = [
  { minutes: 60, label: "1 jam" },
  { minutes: 360, label: "6 jam" },
  { minutes: 1440, label: "24 jam" },
];

export default function OceanPage() {
  const [zoneCode, setZoneCode] = useState("JKT-BAY");
  const [rangeMinutes, setRangeMinutes] = useState(360);
  const [anchor, setAnchor] = useState<number>(() => Date.now());

  useEffect(() => {
    const fromQuery = new URLSearchParams(window.location.search).get("zone");
    if (fromQuery) setZoneCode(fromQuery.toUpperCase());
  }, []);

  const zones = useApi<Zone[]>("/coastal/zones");
  const latest = useApi<LatestResponse>("/buoy/latest", 20000);

  const since = useMemo(() => new Date(anchor - rangeMinutes * 60_000).toISOString(), [anchor, rangeMinutes]);
  const history = useApi<HistoryResponse>(
    `/buoy/history?zone_code=${encodeURIComponent(zoneCode)}&page_size=500&observed_from=${encodeURIComponent(since)}`,
    30000,
  );

  const zone = zones.data?.find((item) => item.zone_code === zoneCode) ?? zones.data?.[0] ?? null;
  const observation =
    latest.data?.items.find((item) => item.zone_code === zoneCode) ??
    history.data?.items[0] ??
    null;
  const parameters = observation?.parameters;

  const quality = useMemo(() => {
    const items = history.data?.items ?? [];
    const valid = items.filter((item) => item.validation_status === "valid");
    const invalid = items.length - valid.length;
    const times = valid
      .map((item) => new Date(item.observed_at).getTime())
      .sort((a, b) => a - b);
    const gaps = times.slice(1).map((time, index) => (time - times[index]) / 60000);
    const medianGap = gaps.length
      ? [...gaps].sort((a, b) => a - b)[Math.floor(gaps.length / 2)]
      : null;
    return { count: valid.length, invalid, medianGap };
  }, [history.data]);

  const refreshAll = () => {
    setAnchor(Date.now());
    latest.refresh();
    history.refresh();
  };

  const selectZone = (code: string) => {
    setZoneCode(code);
    const url = new URL(window.location.href);
    url.searchParams.set("zone", code);
    window.history.replaceState({}, "", url);
  };

  return (
    <>
      <PageHero
        eyebrow="Pemantauan laut"
        title={
          <>
            Setiap pembacaan,{" "}
            <span className="text-signal">dengan buktinya.</span>
          </>
        }
        description="Telemetri buoy, satuan fisiknya, waktu catatannya, dan asal-usulnya. Setiap pembacaan divalidasi sebelum sampai ke tampilan ini."
        right={
          <div className="flex flex-col items-start gap-2 lg:items-end">
            <SourceBadge kind="simulated" />
            <StatusPill tone={latest.data?.stale ? "warn" : "ok"}>
              {latest.data?.stale ? "Umpan usang" : "Umpan terkini"}
            </StatusPill>
            <button type="button" onClick={refreshAll} className="btn btn-ghost btn-sm">
              <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Segarkan
            </button>
          </div>
        }
      />

      <div className="space-y-6">
        {/* zone + range controls */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Zona pesisir">
            {(zones.data ?? []).map((item) => (
              <button
                key={item.zone_code}
                type="button"
                role="tab"
                aria-selected={item.zone_code === zoneCode}
                onClick={() => selectZone(item.zone_code)}
                className={cn(
                  "border-b-2 px-1 pb-2 pt-1 text-[12px] font-medium transition-colors",
                  item.zone_code === zoneCode
                    ? "border-signal text-ink"
                    : "border-transparent text-muted hover:text-ink",
                )}
              >
                {item.zone_name}
                <span className={cn("ml-2 font-mono text-[9px]", item.zone_code === zoneCode ? "text-muted" : "text-line-strong")}>
                  {item.zone_code}
                </span>
              </button>
            ))}
            {zones.loading && !zones.data ? <div className="skeleton h-9 w-40 rounded-[7px]" /> : null}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10.5px] font-medium text-muted">Jendela</span>
              <div className="flex items-center gap-2">
            {RANGES.map((range) => (
              <button
                key={range.minutes}
                type="button"
                onClick={() => setRangeMinutes(range.minutes)}
                className={cn(
                  "border-b px-1.5 pb-1 text-[11px] font-medium transition-colors",
                  rangeMinutes === range.minutes
                    ? "border-signal text-ink"
                    : "border-transparent text-muted hover:text-ink",
                )}
                aria-pressed={rangeMinutes === range.minutes}
              >
                {range.label}
              </button>
            ))}
          </div>
          </div>
        </div>

        {/* freshness strip */}
        <div className="card flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[11.5px]">
            <span className="flex items-center gap-1.5 font-semibold text-ink">
              <span className="h-1.5 w-1.5 rounded-full bg-signal" aria-hidden />
              {zone?.zone_name ?? zoneCode}
            </span>
            <span className="text-muted">
              Observasi terakhir <strong className="font-semibold text-ink">{formatUtc(observation?.observed_at)}</strong>
            </span>
            <span className="text-muted">
              Diterima <strong className="font-semibold text-ink">{formatUtc(observation?.received_at)}</strong>
            </span>
            <span className="text-muted">
              Usia <strong className="font-semibold text-ink">{formatAge(observation?.data_age_seconds)}</strong>
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="chip border-line-strong">Skenario · {enumLabel(observation?.scenario ?? "—")}</span>
            <span className="chip border-line-strong">v{observation?.generator_version ?? "—"}</span>
            {observation && observation.data_age_seconds > (latest.data?.stale_after_seconds ?? 300) ? (
              <StatusPill tone="warn">Usang &gt; {Math.round((latest.data?.stale_after_seconds ?? 300) / 60)} min</StatusPill>
            ) : (
              <StatusPill tone="ok">Dalam jendela kesegaran</StatusPill>
            )}
          </div>
        </div>

        {zone?.boundary_note ? (
          <p className="text-[10.5px] leading-relaxed text-muted">{zone.boundary_note}</p>
        ) : null}

        {/* metric grid */}
        <div className="card grid grid-cols-2 divide-x divide-y divide-line overflow-hidden lg:grid-cols-4">
          <MetricCard
            label="Tinggi gelombang signifikan"
            value={fixed(parameters?.wave_height_m, 2)}
            unit="m"
            hint="Telemetri · pembacaan valid terakhir"
          />
          <MetricCard
            label="Periode gelombang dominan"
            value={fixed(parameters?.wave_period_s, 1)}
            unit="s"
            hint="Terikat pada tinggi gelombang oleh generator"
          />
          <MetricCard
            label="Arah gelombang"
            value={parameters ? `${compass(parameters.wave_direction_deg)} ${fixed(parameters.wave_direction_deg, 0)}` : "—"}
            unit="°"
            hint="Arah datang gelombang"
          />
          <MetricCard
            label="Kecepatan angin"
            value={fixed(parameters?.wind_speed_mps, 1)}
            unit="m/s"
            hint={parameters ? `Dari ${compass(parameters.wind_direction_deg)} ${fixed(parameters.wind_direction_deg, 0)}°` : "—"}
          />
          <MetricCard
            label="Tekanan udara"
            value={fixed(parameters?.air_pressure_hpa, 1)}
            unit="hPa"
            hint="Tekanan rata-rata permukaan laut"
          />
          <MetricCard
            label="Suhu permukaan laut"
            value={fixed(parameters?.sea_temperature_c, 1)}
            unit="°C"
            hint="Diukur pada kedalaman buoy"
          />
          <MetricCard
            label="Pembacaan valid di jendela"
            value={String(quality.count)}
            unit="baris"
            hint={`${quality.invalid} tidak valid / dikarantina dikecualikan`}
          />
          <MetricCard
            label="Median jeda sampel"
            value={quality.medianGap ? fixed(quality.medianGap, 0) : "—"}
            unit="min"
            hint="Dihitung dari waktu catatan tersimpan"
          />
        </div>

        {history.error ? (
          <div className="card border-signal/25 bg-signal-soft/50 p-5 text-[13px] text-signal-dark">
            {history.error}
          </div>
        ) : history.data ? (
          <ObservationCharts items={history.data.items} />
        ) : (
          <div className="grid gap-5 xl:grid-cols-[1.35fr_1fr]">
            <div className="skeleton h-[340px] rounded-[14px]" />
            <div className="skeleton h-[340px] rounded-[14px]" />
          </div>
        )}

        {/* table + provenance */}
        <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
          <div className="card overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
              <div>
                <h2 className="text-[15px] font-semibold tracking-[-0.02em]">Pembacaan terbaru</h2>
                <p className="mt-0.5 text-[11px] text-muted">
                  {history.data?.total ?? 0} baris di jendela terpilih · terbaru lebih dulu
                </p>
              </div>
              <SourceBadge kind="simulated" />
            </div>
            <div className="max-h-[430px] overflow-auto">
              <table className="w-full min-w-[580px] border-collapse text-left">
                <thead className="sticky top-0 z-10 bg-paper/95 backdrop-blur">
                  <tr className="text-[10px] font-medium text-muted">
                    <th className="px-5 py-2.5">Teramati (UTC)</th>
                    <th className="px-3 py-2.5">Tinggi (m)</th>
                    <th className="px-3 py-2.5">Periode (s)</th>
                    <th className="px-3 py-2.5">Angin</th>
                    <th className="px-3 py-2.5">Tekanan</th>
                    <th className="px-5 py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(history.data?.items ?? []).slice(0, 14).map((item) => (
                    <tr key={item.id} className="table-row text-[12px]">
                      <td className="px-5 py-3 font-mono text-[11px] text-ink-soft">{formatShortUtc(item.observed_at)}</td>
                      <td className="metric px-3 py-3 font-semibold">{fixed(item.parameters.wave_height_m, 2)}</td>
                      <td className="metric px-3 py-3">{fixed(item.parameters.wave_period_s, 1)}</td>
                      <td className="metric px-3 py-3">{fixed(item.parameters.wind_speed_mps, 1)} m/s</td>
                      <td className="metric px-3 py-3">{fixed(item.parameters.air_pressure_hpa, 1)} hPa</td>
                      <td className="px-5 py-3">
                        <StatusPill tone={item.validation_status === "valid" ? "ok" : "bad"}>
                          {enumLabel(item.validation_status)}
                        </StatusPill>
                      </td>
                    </tr>
                  ))}
                  {history.data && history.data.items.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-10 text-center text-[12px] text-muted">
                        Belum ada pembacaan di jendela ini. Buat skenario di bawah.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card p-5">
            <h2 className="text-[15px] font-semibold tracking-[-0.02em]">Asal-usul pembacaan</h2>
            <p className="mt-1 text-[11px] leading-relaxed text-muted">
              Waktu teramati, diterima, dan diproses disimpan terpisah agar waktu ingest tidak
              tertukar dengan waktu pengukuran.
            </p>
            <dl className="mt-4 divide-y divide-line">
              <KeyValue label="ID observasi" value={<span className="font-mono text-[10px]">{observation?.id.slice(0, 8) ?? "—"}</span>} />
              <KeyValue label="Waktu teramati" value={formatUtc(observation?.observed_at)} />
              <KeyValue label="Waktu diterima" value={formatUtc(observation?.received_at)} />
              <KeyValue label="Waktu diproses" value={formatUtc(observation?.processed_at)} />
              <KeyValue label="Jenis sumber" value={observation?.source_type ?? "—"} />
              <KeyValue label="Sesi" value={<span className="font-mono text-[10px]">{observation?.simulation_id?.slice(0, 8) ?? "—"}</span>} />
              <KeyValue label="Validasi" value={observation?.validation_status ?? "—"} />
              <KeyValue label="Buoy" value={observation?.buoy_code ?? "—"} />
              <KeyValue
                label="Posisi"
                value={
                  observation
                    ? `${fixed(observation.latitude, 3)}, ${fixed(observation.longitude, 3)}`
                    : "—"
                }
              />
            </dl>

            {observation?.validation_errors?.length ? (
              <div className="mt-4 rounded-[10px] border border-signal/20 bg-signal-soft/60 p-3 text-[11px] text-signal-dark">
                <p className="font-semibold">Masalah validasi</p>
                <ul className="mt-1 list-inside list-disc space-y-1">
                  {observation.validation_errors.map((error) => (
                    <li key={error.code}>{error.message}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="mt-4 rounded-[10px] bg-paper p-3 text-[10.5px] leading-relaxed text-muted">
              <strong className="text-ink">Catatan satuan.</strong> Arah gelombang dan arah angin adalah
              sudut meteorologis “dari arah” dalam derajat sejati. Tekanan disimpan dalam hPa dan tidak
              pernah dikonversi di basis data.
            </div>
          </div>
        </div>

        {/* simulator */}
        <section id="simulator" className="scroll-mt-24 pt-4">
          <SimulatorPanel
            zones={zones.data ?? []}
            zoneCode={zoneCode}
            onZoneChange={selectZone}
            onCompleted={refreshAll}
          />
        </section>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-line bg-white px-5 py-4">
          <p className="text-[11.5px] text-muted">
            Langkah berikutnya: saring jendela ini dengan model anomali dan rubrik risiko yang transparan.
          </p>
          <Link href="/ai" className="btn btn-dark btn-sm">
            Buka analisis AI <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>
      </div>
    </>
  );
}

function MetricCard({
  label,
  value,
  unit,
  hint,
}: {
  label: string;
  value: string;
  unit: string;
  hint: string;
}) {
  return (
    <div className="px-5 py-4">
      <p className="text-[10px] text-muted">{label}</p>
      <p className="mt-2 flex items-baseline gap-1.5">
        <span className="metric text-[23px] font-medium leading-none">{value}</span>
        <span className="text-[10px] text-muted">{unit}</span>
      </p>
      <p className="mt-1.5 text-[9.5px] leading-snug text-muted">{hint}</p>
    </div>
  );
}
