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
    console.error("CEWS dashboard error", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-xl py-16">
      <div className="card p-6">
        <span className="grid h-10 w-10 place-items-center rounded-full bg-signal-soft text-signal">
          <AlertTriangle className="h-5 w-5" aria-hidden />
        </span>
        <h1 className="mt-4 text-[20px] font-extrabold tracking-[-0.03em]">
          This console view could not render
        </h1>
        <p className="mt-2 text-[12.5px] leading-relaxed text-muted">
          The rest of the application is still available. Try again, or open another workspace from the
          navigation.
        </p>
        <pre className="mt-4 overflow-auto rounded-xl bg-paper p-3 text-[10px] leading-relaxed text-ink-soft">
          {error.message}
          {error.digest ? `\n\ndigest: ${error.digest}` : ""}
        </pre>
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={reset} className="btn btn-primary btn-sm">
            <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Try again
          </button>
          <a href="/ocean" className="btn btn-ghost btn-sm">
            Open ocean console
          </a>
        </div>
      </div>
    </div>
  );
}
