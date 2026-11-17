"use client";

import { useCallback, useEffect, useState } from "react";

import { activeApiKey, saveApiKey } from "@/lib/api";

/** Demo/operator API key kept in sessionStorage (never localStorage). */
export function useApiKey(): [string, (value: string) => void] {
  const [key, setKey] = useState("");

  useEffect(() => {
    setKey(activeApiKey());
  }, []);

  const update = useCallback((value: string) => {
    saveApiKey(value.trim());
    setKey(value.trim() || activeApiKey());
  }, []);

  return [key, update];
}
