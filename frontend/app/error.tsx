"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import { useEffect } from "react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("PantauPesisir dashboard error", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-xl py-16">
      <div className="card border-l-[3px] border-l-signal p-6">
        <p className="flex items-center gap-1.5 text-[14px] font-medium text-signal">
          <AlertTriangle className="h-3 w-3" aria-hidden /> Kesalahan konsol
        </p>
        <h1 className="mt-3 text-[20px] font-semibold">Tampilan konsol ini gagal dirender</h1>
        <p className="mt-2 text-[14px] leading-relaxed text-muted">
          Bagian lain aplikasi masih bisa dipakai. Coba lagi, atau buka ruang kerja lain dari
          navigasi.
        </p>
        <pre className="mt-4 overflow-auto bg-paper p-3 text-[14px] leading-relaxed text-ink-soft">
          {error.message}
          {error.digest ? `\n\ndigest: ${error.digest}` : ""}
        </pre>
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={reset} className="btn btn-primary btn-sm">
            <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Coba lagi
          </button>
          <a href="/ocean" className="btn btn-ghost btn-sm">
            Buka konsol laut
          </a>
        </div>
      </div>
    </div>
  );
}
