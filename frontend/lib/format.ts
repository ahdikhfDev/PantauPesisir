export function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}

export function formatUtc(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const formatted = new Intl.DateTimeFormat("en-GB", {
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
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(date);
}

export function formatAge(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) return "unknown";
  if (seconds < 60) return `${Math.round(seconds)}s ago`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`;
  if (seconds < 86400) return `${(seconds / 3600).toFixed(1)}h ago`;
  return `${(seconds / 86400).toFixed(1)}d ago`;
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
  low: { label: "Low", tone: "low" },
  moderate: { label: "Moderate", tone: "moderate" },
  high: { label: "High", tone: "high" },
};

export function statusTone(value: string): "ok" | "warn" | "bad" | "neutral" {
  const normalised = value.toLowerCase();
  if (["ok", "online", "completed", "valid", "active", "archived"].includes(normalised)) return "ok";
  if (["degraded", "stale_cache", "not_synced", "queued", "running", "unknown", "metadata_only"].includes(normalised))
    return "warn";
  if (["failed", "unavailable", "invalid", "completed_with_fallback", "error"].includes(normalised)) return "bad";
  return "neutral";
}
