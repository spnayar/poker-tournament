"use client";

import { useEffect, useState } from "react";
import type { BlindsUp } from "@poker/protocol";

const TOAST_MS = 4500;

/**
 * Non-blocking toast for every seat when blinds are scheduled to rise
 * on the next hand (auto timer or host advance).
 */
export function BlindsUpToast({ event }: { event: BlindsUp | null }) {
  const [visible, setVisible] = useState(false);
  const [payload, setPayload] = useState<BlindsUp | null>(null);

  useEffect(() => {
    if (!event) return;
    setPayload(event);
    setVisible(true);
    const hide = window.setTimeout(() => setVisible(false), TOAST_MS);
    return () => window.clearTimeout(hide);
  }, [event]);

  if (!visible || !payload) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed top-14 left-1/2 z-[70] -translate-x-1/2 max-w-[min(22rem,92vw)] px-3"
    >
      <div className="rounded-lg border border-amber-500/45 bg-slate-950/95 px-3.5 py-2.5 shadow-xl text-center animate-[fadeIn_200ms_ease-out]">
        <p className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">
          Next hand
        </p>
        <p className="text-sm text-amber-200 font-medium mt-0.5">
          Blinds go up to{" "}
          <span className="font-mono tabular-nums text-amber-300">
            {payload.sb}/{payload.bb}
          </span>
        </p>
        <p className="text-[11px] text-slate-500 mt-0.5">
          Level {payload.levelNumber}
        </p>
      </div>
    </div>
  );
}
