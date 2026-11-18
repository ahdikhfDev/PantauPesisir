import { NextResponse } from "next/server";

import {
  ACTIVITIES,
  assessConditions,
  fallbackSummary,
  LEVEL_LABEL,
  type ActivityKey,
} from "@/lib/coastal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const API_BASE = (
  process.env.API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://localhost:8000/api/v1"
).replace(/\/$/, "");
const AI_BASE = (process.env.AI_BASE_URL ?? "https://api.thirtystore.com/v1").replace(/\/$/, "");
const AI_MODEL = process.env.AI_MODEL ?? "thirty/deepseek-v4.1-flash-1017";
const AI_KEY = process.env.AI_API_KEY ?? "";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const CACHE_TTL_MS = 10 * 60 * 1000;
const FORCE_COOLDOWN_MS = 60 * 1000;
const cache = new Map<string, { at: number; payload: RingkasanPayload }>();
const forcedAt = new Map<string, number>();

interface RingkasanPayload {
  zone_code: string;
  zone_name: string;
  activity: ActivityKey;
  level: string;
  level_label: string;
  summary: string;
  advice: string;
  reasons: string[];
  metrics: {
    wave_m: number | null;
    wind_mps: number | null;
    age_seconds: number | null;
    alert_count: number;
  };
  source: "ai" | "template";
  model: string | null;
  generated_at: string;
}

async function getJson<T>(path: string, timeoutMs = 12000): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`${path} -> ${response.status}`);
  return (await response.json()) as T;
}

function parseModelContent(text: string): { summary: string; advice: string } | null {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  try {
    const parsed = JSON.parse(cleaned) as { ringkasan?: unknown; saran?: unknown };
    if (typeof parsed.ringkasan === "string" && parsed.ringkasan.trim()) {
      return {
        summary: parsed.ringkasan.trim().slice(0, 420),
        advice: typeof parsed.saran === "string" ? parsed.saran.trim().slice(0, 240) : "",
      };
    }
  } catch {
    // fall through to plain-text handling
  }
  if (!cleaned) return null;
  return { summary: cleaned.replace(/\s+/g, " ").slice(0, 420), advice: "" };
}

async function generateSummary(input: {
  zoneName: string;
  activity: ActivityKey;
  level: string;
  wave: number | null;
  wind: number | null;
  ageSeconds: number | null;
  alertCount: number;
  highAlert: boolean;
}): Promise<{ summary: string; advice: string } | null> {
  if (!AI_KEY) return null;
  const activityLabel = ACTIVITIES.find((item) => item.key === input.activity)?.label ?? input.activity;
  const body = {
    model: AI_MODEL,
    temperature: 0.35,
    max_tokens: 260,
    messages: [
      {
        role: "system",
        content:
          "Anda penulis ringkasan kondisi laut untuk warga Indonesia. Tulis 2 kalimat (maksimal 45 kata) " +
          "dalam bahasa sehari-hari, tenang, tanpa istilah teknis. Gunakan HANYA data yang diberikan; " +
          "jangan menambah fakta baru. Jangan mengulang semua angka, sebut yang paling penting saja. " +
          "Jangan menjamin keselamatan. Jangan menyebut AI atau model. " +
          'Balas HANYA JSON valid: {"ringkasan":"2 kalimat"}',
      },
      {
        role: "user",
        content: JSON.stringify({
          zona: input.zoneName,
          aktivitas: activityLabel,
          status_sistem: LEVEL_LABEL[input.level as keyof typeof LEVEL_LABEL] ?? input.level,
          ombak_meter: input.wave,
          angin_meter_per_detik: input.wind,
          peringatan_aktif: input.alertCount,
          ada_peringatan_tinggi: input.highAlert,
          data_menit_lalu: input.ageSeconds === null ? null : Math.round(input.ageSeconds / 60),
        }),
      },
    ],
  };

  const response = await fetch(`${AI_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${AI_KEY}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": USER_AGENT,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`AI provider -> ${response.status}`);
  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = payload.choices?.[0]?.message?.content ?? "";
  return parseModelContent(content);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const zone = (url.searchParams.get("zone") ?? "JKT-BAY").toUpperCase().slice(0, 32);
  const activityParam = url.searchParams.get("activity") ?? "boat";
  const activity: ActivityKey = ["boat", "beach", "port"].includes(activityParam)
    ? (activityParam as ActivityKey)
    : "boat";
  const force = url.searchParams.get("refresh") === "1";

  try {
    const [zones, latest, alerts, prediction] = await Promise.all([
      getJson<Array<{ zone_code: string; zone_name: string }>>("/coastal/zones"),
      getJson<{
        items: Array<{
          observed_at: string;
          data_age_seconds: number;
          parameters: { wave_height_m: number; wind_speed_mps: number };
        }>;
      }>(`/buoy/latest?zone_code=${encodeURIComponent(zone)}`),
      getJson<{ items: Array<{ severity: string; created_at: string }> }>(
        `/alerts?status=open&zone_code=${encodeURIComponent(zone)}&limit=20`,
      ),
      getJson<{ risk_level: string | null; analysis_ended_at: string | null }>(
        `/analytics/latest?zone_code=${encodeURIComponent(zone)}`,
      ).catch(() => null),
    ]);

    const zoneName = zones.find((item) => item.zone_code === zone)?.zone_name ?? zone;
    const reading = latest.items[0] ?? null;
    const assessment = assessConditions({
      activity,
      wave: reading?.parameters.wave_height_m ?? null,
      wind: reading?.parameters.wind_speed_mps ?? null,
      ageSeconds: reading?.data_age_seconds ?? null,
      alerts: alerts.items ?? [],
      riskLevel: prediction?.risk_level ?? null,
      riskAt: prediction?.analysis_ended_at ?? null,
      observedAt: reading?.observed_at ?? null,
    });

    const cacheKey = [
      zone,
      activity,
      reading?.observed_at ?? "none",
      assessment.level,
      alerts.items?.length ?? 0,
      prediction?.analysis_ended_at ?? "none",
    ].join("|");

    const cached = cache.get(cacheKey);
    const forcedRecently = Date.now() - (forcedAt.get(cacheKey) ?? 0) < FORCE_COOLDOWN_MS;
    if (cached && Date.now() - cached.at < CACHE_TTL_MS && (!force || forcedRecently)) {
      // Cache hanya di server: respons tidak boleh di-cache CDN, karena data buoy
      // bisa berubah kapan saja dan kunci cache sudah memuat waktu observasi.
      return NextResponse.json(cached.payload, { headers: { "Cache-Control": "no-store" } });
    }
    if (force) forcedAt.set(cacheKey, Date.now());

    let generated: { summary: string; advice: string } | null = null;
    try {
      generated = await generateSummary({
        zoneName,
        activity,
        level: assessment.level,
        wave: assessment.wave,
        wind: assessment.wind,
        ageSeconds: assessment.ageSeconds,
        alertCount: assessment.alertCount,
        highAlert: assessment.recentHighAlert,
      });
    } catch (error) {
      console.warn("Ringkasan AI gagal, memakai template:", (error as Error).message);
    }

    const payload: RingkasanPayload = {
      zone_code: zone,
      zone_name: zoneName,
      activity,
      level: assessment.level,
      level_label: LEVEL_LABEL[assessment.level],
      summary: generated?.summary || fallbackSummary(zoneName, assessment),
      advice: assessment.advice,
      reasons: assessment.reasons,
      metrics: {
        wave_m: assessment.wave,
        wind_mps: assessment.wind,
        age_seconds: assessment.ageSeconds,
        alert_count: assessment.alertCount,
      },
      source: generated ? "ai" : "template",
      model: generated ? AI_MODEL : null,
      generated_at: new Date().toISOString(),
    };

    cache.set(cacheKey, { at: Date.now(), payload });
    if (cache.size > 60) {
      const oldest = [...cache.entries()].sort((a, b) => a[1].at - b[1].at).slice(0, 20);
      for (const [key] of oldest) cache.delete(key);
    }

    return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json(
      { error: "ringkasan_unavailable", detail: (error as Error).message },
      { status: 503 },
    );
  }
}
