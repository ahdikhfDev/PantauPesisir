const API_BASE = (
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1"
).replace(/\/$/, "");

export const API_BASE_URL = API_BASE;
export const DEMO_API_KEY = process.env.NEXT_PUBLIC_DEMO_API_KEY ?? "";

export class ApiError extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string) {
    super(detail);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

export function apiUrl(path: string): string {
  if (path.startsWith("http")) return path;
  if (path.startsWith("/api/")) {
    const origin = API_BASE.replace(/\/api\/v1$/, "");
    return `${origin}${path}`;
  }
  return `${API_BASE}${path}`;
}

async function parse<T>(response: Response): Promise<T> {
  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }
  if (!response.ok) {
    const body = payload as
      | { detail?: string; issues?: Array<{ location: string; message: string }> }
      | null;
    const detail =
      body?.issues?.map((issue) => `${issue.location}: ${issue.message}`).join("; ") ||
      body?.detail ||
      (typeof payload === "string" ? payload : `Permintaan gagal (${response.status})`);
    throw new ApiError(response.status, detail);
  }
  return payload as T;
}

export async function apiGet<T>(path: string, timeoutMs = 15000): Promise<T> {
  const response = await fetch(apiUrl(path), {
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs),
  });
  return parse<T>(response);
}

export async function apiSend<T>(
  path: string,
  method: "POST" | "PATCH",
  body: unknown,
  apiKey?: string,
  timeoutMs = 30000,
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  if (apiKey) headers["X-API-Key"] = apiKey;
  const response = await fetch(apiUrl(path), {
    method,
    headers,
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs),
  });
  return parse<T>(response);
}

/**
 * The demo API key is intentionally public: it only unlocks the documented
 * simulator/analysis controls and is disclosed in the proposal. Never ship a
 * production secret in NEXT_PUBLIC_* variables.
 */
export function storedApiKey(): string {
  if (typeof window === "undefined") return "";
  return window.sessionStorage.getItem("pantaupesisir_api_key") ?? "";
}

export function saveApiKey(value: string): void {
  if (typeof window === "undefined") return;
  if (value) window.sessionStorage.setItem("pantaupesisir_api_key", value);
  else window.sessionStorage.removeItem("pantaupesisir_api_key");
}

export function activeApiKey(): string {
  return storedApiKey() || DEMO_API_KEY;
}

export const API_ORIGIN = API_BASE.replace(/\/api\/v1$/, "");
