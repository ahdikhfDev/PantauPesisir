"use client";

import {
  Anchor,
  ArrowRight,
  CheckCircle2,
  Clock,
  LifeBuoy,
  MapPin,
  Ship,
  Sun,
  TriangleAlert,
  Waves,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { cn, fixed, formatAge } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import type { AlertList, LatestResponse, Prediction, Zone } from "@/lib/types";

type ActivityKey = "boat" | "beach" | "port";
type Level = "tenang" | "hati" | "tunda";

const ACTIVITIES: Array<{
  key: ActivityKey;
  label: string;
  note: string;
  icon: typeof Anchor;
}> = [
  {
    key: "boat",
    label: "Perahu kecil / nelayan",
    note: "Melaut, mencari ikan, atau menyeberang jarak dekat.",
    icon: Anchor,
  },
  {
    key: "beach",
    label: "Wisata pantai",
    note: "Berenang, bermain air, atau duduk di tepi pantai.",
    icon: Sun,
  },
  {
    key: "port",
    label: "Kapal & pelabuhan",
    note: "Bongkar muat, sandar, dan manuver kapal.",
    icon: Ship,
  },
];

const LIMITS: Record<ActivityKey, { waveWarn: number; waveBad: number; windWarn: number; windBad: number }> = {
  boat: { waveWarn: 1.25, waveBad: 2.0, windWarn: 8, windBad: 12 },
  beach: { waveWarn: 1.5, waveBad: 2.5, windWarn: 10, windBad: 15 },
  port: { waveWarn: 2.0, waveBad: 3.0, windWarn: 12, windBad: 18 },
};

const LEVEL_META: Record<
  Level,
  {
    label: string;
    badge: string;
    panel: string;
    icon: typeof CheckCircle2;
    scale: string;
  }
> = {
  tenang: {
    label: "Aman untuk aktivitas ringan",
    badge: "text-ok",
    panel: "border-ok/30 bg-ok-soft/60",
    icon: CheckCircle2,
    scale: "bg-ok",
  },
  hati: {
    label: "Hati-hati, pantau terus",
    badge: "text-amber",
    panel: "border-amber/35 bg-amber-soft/70",
    icon: TriangleAlert,
    scale: "bg-amber",
  },
  tunda: {
    label: "Sebaiknya tunda dulu",
    badge: "text-signal-dark",
    panel: "border-signal/30 bg-signal-soft/70",
    icon: XCircle,
    scale: "bg-signal",
  },
};

const ADVICE: Record<ActivityKey, Record<Level, string>> = {
  boat: {
    tenang: "Kondisi laut relatif tenang. Perahu kecil masih nyaman untuk beraktivitas.",
    hati: "Boleh berangkat, tapi pantau ombak dan angin. Bawa pelampung dan beri tahu keluarga.",
    tunda: "Ombak atau angin terlalu tinggi untuk perahu kecil. Tunda keberangkatan.",
  },
  beach: {
    tenang: "Nyaman untuk bermain air di pantai. Tetap awasi anak-anak di dekat ombak.",
    hati: "Hati-hati di air. Ombak bisa lebih kuat dari kelihatannya; jangan berenang jauh.",
    tunda: "Sebaiknya tidak berenang. Ombak tinggi dan angin kencang berbahaya di pantai.",
  },
  port: {
    tenang: "Kondisi mendukung kegiatan pelabuhan dan manuver kapal.",
    hati: "Perhatikan gelombang dan angin saat sandar. Gunakan alat keselamatan kerja.",
    tunda: "Tunda operasi kapal kecil. Gelombang dan angin di atas batas aman pelabuhan.",
  },
};

function waveWords(metres: number | null): string {
  if (metres === null) return "belum ada data";
  if (metres < 1) return "tenang";
  if (metres < 2) return "setinggi pinggang";
  if (metres < 3) return "setinggi dada";
  return "sangat tinggi";
}

function windWords(speed: number | null): string {
  if (speed === null) return "belum ada data";
  if (speed < 6) return "sepoi-sepoi";
  if (speed < 10) return "cukup kencang";
  if (speed < 15) return "kencang";
  return "sangat kencang";
}

function isRecent(iso: string | null | undefined, hours: number): boolean {
  if (!iso) return false;
  const value = new Date(iso).getTime();
  if (Number.isNaN(value)) return false;
  return Date.now() - value <= hours * 3600 * 1000;
}

const FALLBACK_ZONES = [
  { zone_code: "JKT-BAY", zone_name: "Teluk Jakarta" },
  { zone_code: "SMR-UTC", zone_name: "Pantai Semarang" },
  { zone_code: "MKS-STR", zone_name: "Selat Makassar" },
];

export default function CekPage() {
  const zones = useApi<Zone[]>("/coastal/zones", 120000);
  const latest = useApi<LatestResponse>("/buoy/latest", 30000);
  const predictions = useApi<Prediction[]>("/analytics/history?limit=20", 30000);
  const alerts = useApi<AlertList>("/alerts?status=open&limit=30", 30000);

  const zoneOptions = zones.data?.length ? zones.data : FALLBACK_ZONES;
  const [zoneCode, setZoneCode] = useState<string>("JKT-BAY");
  const [activity, setActivity] = useState<ActivityKey>("boat");

  const zone = zoneOptions.find((item) => item.zone_code === zoneCode) ?? zoneOptions[0];

  const reading = useMemo(
    () => (latest.data?.items ?? []).find((item) => item.zone_code === zone.zone_code) ?? null,
    [latest.data, zone.zone_code],
  );
  const prediction = useMemo(
    () => (predictions.data ?? []).find((item) => item.zone_code === zone.zone_code && item.risk_level) ?? null,
    [predictions.data, zone.zone_code],
  );
  const zoneAlerts = useMemo(
    () => (alerts.data?.items ?? []).filter((item) => item.zone_code === zone.zone_code),
    [alerts.data, zone.zone_code],
  );

  const wave = reading?.parameters.wave_height_m ?? null;
  const wind = reading?.parameters.wind_speed_mps ?? null;
  const age = reading?.data_age_seconds ?? null;
  const limit = LIMITS[activity];

  const waveBad = wave !== null && wave >= limit.waveBad;
  const windBad = wind !== null && wind >= limit.windBad;
  const waveWarn = wave !== null && wave >= limit.waveWarn;
  const windWarn = wind !== null && wind >= limit.windWarn;
  const risk = isRecent(prediction?.analysis_ended_at, 2) ? prediction?.risk_level ?? null : null;
  const recentHighAlert = zoneAlerts.some((item) => item.severity === "high" && isRecent(item.created_at, 2));

  let level: Level = "tenang";
  if (waveBad || windBad || recentHighAlert) level = "tunda";
  else if (waveWarn || windWarn || risk === "moderate" || zoneAlerts.length > 0) level = "hati";
  if (age !== null && age > 1800 && level === "tenang") level = "hati";

  const advice =
    level === "tunda"
      ? recentHighAlert && !waveBad && !windBad
        ? "Ada peringatan risiko tinggi yang masih aktif. Tunda aktivitas sampai kondisi diperbarui."
        : waveBad && windBad
          ? "Ombak dan angin sama-sama di atas batas aman. Tunda dulu."
          : waveBad
            ? "Ombak terlalu tinggi untuk aktivitas ini. Tunda dulu."
            : "Angin terlalu kencang untuk aktivitas ini. Tunda dulu."
      : ADVICE[activity][level];

  const reasons = [
    `Ombak ${fixed(wave, 1)} m (${waveWords(wave)})`,
    `Angin ${fixed(wind, 0)} m/s (${windWords(wind)})`,
    zoneAlerts.length ? `${zoneAlerts.length} peringatan aktif` : "tidak ada peringatan aktif",
  ];

  const meta = LEVEL_META[level];
  const LevelIcon = meta.icon;
  const loading = latest.loading || zones.loading;
  const activeActivity = ACTIVITIES.find((item) => item.key === activity)!;

  return (
    <>
      <section className="mb-6 flex flex-col gap-4 border-b border-line pb-5">
        <div className="max-w-3xl">
          <span className="eyebrow">Untuk semua orang</span>
          <h1 className="font-display mt-2 text-[26px] font-semibold leading-[1.06] tracking-[-0.04em] sm:text-[32px]">
            Mau ke laut? <span className="text-sea">Cek dulu.</span>
          </h1>
          <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-muted">
            Pilih lokasi dan rencana aktivitas. Dalam hitungan detik, konsol ini merangkum kondisi laut
            terkini menjadi jawaban sederhana: aman, hati-hati, atau sebaiknya tunda.
          </p>
        </div>
      </section>

      <section className="card p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <span className="grid h-6 w-6 place-items-center rounded-full bg-sea-deep text-[11px] font-semibold text-white">
            1
          </span>
          <h2 className="text-[14px] font-semibold">Pilih lokasi</h2>
          <span className="ml-auto flex items-center gap-1 text-[10px] text-muted">
            <MapPin className="h-3 w-3" aria-hidden /> {zoneOptions.length} zona terpantau
          </span>
        </div>

        <div className="mt-4 grid gap-2.5 sm:grid-cols-3">
          {zoneOptions.map((item) => {
            const active = item.zone_code === zone.zone_code;
            const itemReading = (latest.data?.items ?? []).find((row) => row.zone_code === item.zone_code);
            return (
              <button
                key={item.zone_code}
                type="button"
                onClick={() => setZoneCode(item.zone_code)}
                className={cn(
                  "rounded-[12px] border px-4 py-3 text-left transition-colors",
                  active
                    ? "border-sea bg-sea-soft/70"
                    : "border-line bg-surface hover:border-line-strong hover:bg-paper",
                )}
                aria-pressed={active}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-semibold text-ink">{item.zone_name}</span>
                  <span className={cn("h-2 w-2 rounded-full", active ? "bg-sea" : "bg-line-strong")} aria-hidden />
                </span>
                <span className="mt-1 flex items-center gap-3 text-[10.5px] text-muted">
                  <span className="inline-flex items-center gap-1">
                    <Waves className="h-3 w-3" aria-hidden />
                    {itemReading ? `${fixed(itemReading.parameters.wave_height_m, 1)} m` : "—"}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" aria-hidden />
                    {itemReading ? formatAge(itemReading.data_age_seconds) : "—"}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-6 flex items-center gap-2">
          <span className="grid h-6 w-6 place-items-center rounded-full bg-sea-deep text-[11px] font-semibold text-white">
            2
          </span>
          <h2 className="text-[14px] font-semibold">Rencana aktivitas</h2>
        </div>

        <div className="mt-4 grid gap-2.5 sm:grid-cols-3">
          {ACTIVITIES.map((item) => {
            const Icon = item.icon;
            const active = activity === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setActivity(item.key)}
                className={cn(
                  "flex items-start gap-3 rounded-[12px] border px-4 py-3 text-left transition-colors",
                  active
                    ? "border-sea bg-sea-soft/70"
                    : "border-line bg-surface hover:border-line-strong hover:bg-paper",
                )}
                aria-pressed={active}
              >
                <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", active ? "text-sea" : "text-muted")} aria-hidden />
                <span>
                  <span className="block text-[12.5px] font-semibold text-ink">{item.label}</span>
                  <span className="mt-0.5 block text-[10.5px] leading-relaxed text-muted">{item.note}</span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className={cn("card mt-5 overflow-hidden border", meta.panel)} aria-live="polite">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
          <div className="flex items-start gap-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[14px] bg-white/80">
              <LevelIcon className={cn("h-6 w-6", meta.badge)} aria-hidden />
            </span>
            <div>
              <p className="text-[10px] font-semibold tracking-[0.14em] text-muted">
                HASIL UNTUK {zone.zone_name.toUpperCase()}
              </p>
              <h2 className={cn("mt-1 text-[22px] font-semibold leading-tight tracking-[-0.03em]", meta.badge)}>
                {loading ? "Membaca kondisi…" : meta.label}
              </h2>
              <p className="mt-1.5 max-w-xl text-[12.5px] leading-relaxed text-ink-soft">
                {loading ? "Sebentar, mengambil pembacaan terbaru dari buoy." : advice}
              </p>
            </div>
          </div>
          <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-white/70 px-3 py-1.5 text-[10.5px] font-medium text-muted">
            <Clock className="h-3 w-3" aria-hidden />
            {age !== null ? `Diperbarui ${formatAge(age)}` : "Menunggu data"}
          </span>
        </div>

        <div className="grid gap-0 border-t border-white/60 bg-white/45 sm:grid-cols-3">
          <div className="border-b border-white/70 px-5 py-3.5 sm:border-b-0 sm:border-r">
            <p className="text-[9.5px] font-semibold tracking-[0.1em] text-muted">OMBAK</p>
            <p className="metric mt-1 text-[17px] font-medium text-ink">{fixed(wave, 1)} m</p>
            <p className="text-[10.5px] text-muted">{waveWords(wave)}</p>
          </div>
          <div className="border-b border-white/70 px-5 py-3.5 sm:border-b-0 sm:border-r">
            <p className="text-[9.5px] font-semibold tracking-[0.1em] text-muted">ANGIN</p>
            <p className="metric mt-1 text-[17px] font-medium text-ink">{fixed(wind, 0)} m/s</p>
            <p className="text-[10.5px] text-muted">{windWords(wind)}</p>
          </div>
          <div className="px-5 py-3.5">
            <p className="text-[9.5px] font-semibold tracking-[0.1em] text-muted">PERINGATAN AKTIF</p>
            <p className="metric mt-1 text-[17px] font-medium text-ink">{zoneAlerts.length}</p>
            <p className="text-[10.5px] text-muted">{zoneAlerts.length ? zoneAlerts[0].title : "tidak ada"}</p>
          </div>
        </div>

        <div className="border-t border-white/60 bg-white/60 px-5 py-3">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-muted">
            <span className="font-semibold text-ink-soft">Kenapa?</span>
            {reasons.map((reason) => (
              <span key={reason} className="rounded-full bg-white/80 px-2 py-0.5">
                {reason}
              </span>
            ))}
          </p>
          <div className="mt-3 flex items-center gap-1.5 text-[10px] font-medium text-muted">
            <span>TENANG</span>
            <span className="mx-1 flex-1 overflow-hidden rounded-full bg-line">
              <span
                className={cn("block h-1.5 rounded-full transition-all", meta.scale)}
                style={{ width: level === "tenang" ? "33%" : level === "hati" ? "66%" : "100%" }}
              />
            </span>
            <span>TUNDA</span>
          </div>
          <p className="mt-2 text-[9.5px] leading-relaxed text-muted">
            Penilaian memakai ombak, angin, riwayat analisis, dan peringatan aktif untuk{" "}
            {activeActivity.label.toLowerCase()}. Untuk prakiraan resmi, cek juga BMKG sebelum berangkat.
          </p>
        </div>
      </section>

      <section className="mt-5 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="card p-5">
          <h2 className="text-[14px] font-semibold">Cara membaca hasilnya</h2>
          <ul className="mt-3 space-y-2.5">
            {[
              ["Aman", "Ombak dan angin masih nyaman untuk aktivitas yang dipilih.", "bg-ok"],
              ["Hati-hati", "Ada satu kondisi yang mendekati batas. Tetap pantau dan siapkan pelampung.", "bg-amber"],
              ["Tunda", "Ombak, angin, atau peringatan sudah melewati batas aman aktivitas tersebut.", "bg-signal"],
            ].map(([title, copy, dot]) => (
              <li key={title} className="flex gap-2.5">
                <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", dot)} aria-hidden />
                <span className="text-[11.5px] leading-relaxed text-ink-soft">
                  <span className="font-semibold text-ink">{title}. </span>
                  {copy}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="card flex flex-col justify-between gap-4 p-5">
          <div>
            <p className="flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.12em] text-muted">
              <LifeBuoy className="h-3.5 w-3.5" aria-hidden /> BUTUH ANGKA LENGKAP?
            </p>
            <p className="mt-2 text-[12px] leading-relaxed text-muted">
              Halaman ini adalah ringkasan untuk pengguna umum. Grafik, riwayat, dan detail teknis ada di
              konsol pemantauan.
            </p>
          </div>
          <Link href="/konsol" className="btn btn-ghost btn-sm self-start">
            Lihat detail teknis <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>
      </section>
    </>
  );
}
