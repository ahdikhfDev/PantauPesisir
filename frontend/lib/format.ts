export function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}

export function formatUtc(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const formatted = new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(date);
  return `${formatted} UTC`;
}

export function formatShortUtc(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(date);
}

export function formatAge(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) return "tidak diketahui";
  if (seconds < 60) return `${Math.round(seconds)} dtk lalu`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} mnt lalu`;
  if (seconds < 86400) return `${(seconds / 3600).toFixed(1)} jam lalu`;
  return `${(seconds / 86400).toFixed(1)} hari lalu`;
}

export function compass(degrees: number): string {
  const points = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  return points[Math.round(((degrees % 360) / 22.5)) % 16];
}

export function fixed(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return value.toFixed(digits);
}

export function percent(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  const scaled = value * 100;
  return `${scaled > 0 && scaled < 1 ? scaled.toFixed(2) : scaled.toFixed(0)}%`;
}

export const riskCopy: Record<string, { label: string; tone: "low" | "moderate" | "high" }> = {
  low: { label: "Rendah", tone: "low" },
  moderate: { label: "Sedang", tone: "moderate" },
  high: { label: "Tinggi", tone: "high" },
};

const ENUM_LABELS: Record<string, string> = {
  open: "Terbuka",
  acknowledged: "Diakui",
  resolved: "Selesai",
  valid: "Valid",
  invalid: "Tidak valid",
  simulated: "Telemetri buoy",
  satellite: "Satelit",
  observed: "Teramati",
  historical: "Historis",
  historical_dataset: "Dataset historis",
  model: "Model",
  completed: "Selesai",
  completed_with_fallback: "Selesai (cadangan)",
  running: "Berjalan",
  queued: "Antrean",
  pending: "Menunggu",
  failed: "Gagal",
  metadata_only: "Hanya metadata",
  thumbnail_cached: "Pratinjau tersimpan",
  normal: "Normal",
  warning: "Waspada",
  extreme: "Ekstrem",
  storm: "Badai",
  tsunami_watch: "Siaga tsunami",
  ok: "Normal",
  online: "Daring",
  offline: "Luring",
  degraded: "Menurun",
  unavailable: "Tidak tersedia",
  stale_cache: "Cache usang",
  not_synced: "Belum tersinkron",
  unknown: "Tidak diketahui",
  idle: "Menganggur",
  active: "Aktif",
  archived: "Diarsipkan",
};

/** Translate a backend enum value for display without touching the raw value. */
export function enumLabel(value: string | null | undefined): string {
  if (!value) return "—";
  return ENUM_LABELS[value.toLowerCase()] ?? value;
}

export function statusTone(value: string): "ok" | "warn" | "bad" | "neutral" {
  const normalised = value.toLowerCase();
  if (["ok", "online", "completed", "valid", "active", "archived"].includes(normalised)) return "ok";
  if (["degraded", "stale_cache", "not_synced", "queued", "running", "unknown", "metadata_only"].includes(normalised))
    return "warn";
  if (["failed", "unavailable", "invalid", "completed_with_fallback", "error"].includes(normalised)) return "bad";
  return "neutral";
}
