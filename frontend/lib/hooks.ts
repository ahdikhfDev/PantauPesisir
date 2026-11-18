"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { apiGet, ApiError } from "@/lib/api";

export interface ApiState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  refresh: () => void;
  setData: (value: T | null) => void;
}

export function useApi<T>(path: string | null, pollMs?: number, timeoutMs?: number): ApiState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(Boolean(path));
  const [tick, setTick] = useState(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!path) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    const run = async (showSpinner: boolean) => {
      if (showSpinner) setLoading(true);
      try {
        const result = await apiGet<T>(path, timeoutMs);
        if (!cancelled && mounted.current) {
          setData(result);
          setError(null);
        }
      } catch (err) {
        if (!cancelled && mounted.current) {
          const raw =
            err instanceof ApiError
              ? err.detail
              : err instanceof Error
                ? err.message
                : "Tidak dapat menjangkau API PantauPesisir";
          setError(
            /timed out|aborted|timeout/i.test(raw)
              ? "Server belum merespons. Coba lagi dalam beberapa detik."
              : raw,
          );
        }
      } finally {
        if (!cancelled && mounted.current) setLoading(false);
      }
    };
    void run(true);
    if (pollMs) {
      const interval = window.setInterval(() => void run(false), pollMs);
      return () => {
        cancelled = true;
        window.clearInterval(interval);
      };
    }
    return () => {
      cancelled = true;
    };
  }, [path, pollMs, tick]);

  const refresh = useCallback(() => setTick((value) => value + 1), []);

  return { data, error, loading, refresh, setData };
}
