export type ActivityKey = "boat" | "beach" | "port";
export type Level = "tenang" | "hati" | "tunda";

export const ACTIVITIES: Array<{ key: ActivityKey; label: string; note: string }> = [
  { key: "boat", label: "Perahu kecil / nelayan", note: "Melaut, mencari ikan, atau menyeberang jarak dekat." },
  { key: "beach", label: "Wisata pantai", note: "Berenang, bermain air, atau duduk di tepi pantai." },
  { key: "port", label: "Kapal & pelabuhan", note: "Bongkar muat, sandar, dan manuver kapal." },
];

export const LIMITS: Record<
  ActivityKey,
  { waveWarn: number; waveBad: number; windWarn: number; windBad: number }
> = {
  boat: { waveWarn: 1.25, waveBad: 2.0, windWarn: 8, windBad: 12 },
  beach: { waveWarn: 1.5, waveBad: 2.5, windWarn: 10, windBad: 15 },
  port: { waveWarn: 2.0, waveBad: 3.0, windWarn: 12, windBad: 18 },
};

export const LEVEL_LABEL: Record<Level, string> = {
  tenang: "Aman untuk aktivitas ringan",
  hati: "Hati-hati, pantau terus",
  tunda: "Sebaiknya tunda dulu",
};

export const ADVICE: Record<ActivityKey, Record<Level, string>> = {
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

export function waveWords(metres: number | null): string {
  if (metres === null) return "belum ada data";
  if (metres < 1) return "tenang";
  if (metres < 2) return "setinggi pinggang";
  if (metres < 3) return "setinggi dada";
  return "sangat tinggi";
}

export function windWords(speed: number | null): string {
  if (speed === null) return "belum ada data";
  if (speed < 6) return "sepoi-sepoi";
  if (speed < 10) return "cukup kencang";
  if (speed < 15) return "kencang";
  return "sangat kencang";
}

export function isRecent(iso: string | null | undefined, hours: number, now = Date.now()): boolean {
  if (!iso) return false;
  const value = new Date(iso).getTime();
  if (Number.isNaN(value)) return false;
  return now - value <= hours * 3600 * 1000;
}

export interface AlertLike {
  severity: string;
  created_at: string;
  title?: string;
}

export interface Assessment {
  level: Level;
  wave: number | null;
  wind: number | null;
  ageSeconds: number | null;
  alertCount: number;
  recentHighAlert: boolean;
  risk: string | null;
  waveBad: boolean;
  windBad: boolean;
  reasons: string[];
  advice: string;
}

export function assessConditions(input: {
  activity: ActivityKey;
  wave: number | null;
  wind: number | null;
  ageSeconds: number | null;
  alerts: AlertLike[];
  riskLevel: string | null;
  riskAt: string | null | undefined;
  now?: number;
}): Assessment {
  const { activity, wave, wind, ageSeconds, alerts, riskLevel, riskAt } = input;
  const now = input.now ?? Date.now();
  const limit = LIMITS[activity];

  const waveBad = wave !== null && wave >= limit.waveBad;
  const windBad = wind !== null && wind >= limit.windBad;
  const waveWarn = wave !== null && wave >= limit.waveWarn;
  const windWarn = wind !== null && wind >= limit.windWarn;
  const risk = isRecent(riskAt, 2, now) ? riskLevel : null;
  const recentHighAlert = alerts.some(
    (item) => item.severity === "high" && isRecent(item.created_at, 2, now),
  );

  let level: Level = "tenang";
  if (waveBad || windBad || recentHighAlert) level = "tunda";
  else if (waveWarn || windWarn || risk === "moderate" || alerts.length > 0) level = "hati";
  if (ageSeconds !== null && ageSeconds > 1800 && level === "tenang") level = "hati";

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

  return {
    level,
    wave,
    wind,
    ageSeconds,
    alertCount: alerts.length,
    recentHighAlert,
    risk,
    waveBad,
    windBad,
    reasons: [
      `Ombak ${wave === null ? "—" : wave.toFixed(1)} m (${waveWords(wave)})`,
      `Angin ${wind === null ? "—" : Math.round(wind)} m/s (${windWords(wind)})`,
      alerts.length ? `${alerts.length} peringatan aktif` : "tidak ada peringatan aktif",
    ],
    advice,
  };
}

export function fallbackSummary(zoneName: string, assessment: Assessment): string {
  const wave = assessment.wave === null ? "belum tersedia" : `${assessment.wave.toFixed(1)} meter`;
  const wind = assessment.wind === null ? "belum tersedia" : `${Math.round(assessment.wind)} meter per detik`;
  const alerts = assessment.alertCount
    ? `Ada ${assessment.alertCount} peringatan aktif yang perlu diperhatikan.`
    : "Tidak ada peringatan aktif saat ini.";
  return `Kondisi ${zoneName} tercatat dengan ombak sekitar ${wave} dan angin ${wind}. ${alerts} ${assessment.advice}`;
}
