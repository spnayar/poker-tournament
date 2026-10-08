"use client";

import { useEffect, useState } from "react";
import type { BlindTimerState } from "@poker/protocol";

function formatCountdown(ms: number | null): string {
  if (ms === null) return "—";
  const totalSec = Math.ceil(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

interface BlindTimerBarProps {
  timer: BlindTimerState & { hostUserId?: string };
  myUserId: string;
  onPause: () => void;
  onResume: () => void;
  onAdvance: () => void;
  actionLoading?: boolean;
}

export function BlindTimerBar({
  timer,
  myUserId,
  onPause,
  onResume,
  onAdvance,
  actionLoading = false,
}: BlindTimerBarProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (timer.paused || timer.increasePending || timer.levelEndsAt === null) {
      return;
    }
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [timer]);

  const isHost = timer.hostUserId === myUserId;
  const canAdvance = timer.nextBb !== null && !timer.increasePending;
  const displayRemaining = timer.increasePending
    ? 0
    : timer.paused
      ? timer.pausedRemainingMs
      : timer.levelEndsAt !== null
        ? Math.max(0, timer.levelEndsAt - now)
        : null;

  const timerLabel = timer.increasePending
    ? "Next hand"
    : timer.paused
      ? "Paused"
      : "Next";

  return (
    <div className="table-chrome relative z-50 rounded-md px-2 py-1 mb-1.5 shrink-0">
      <div className="flex flex-nowrap items-center gap-2 sm:gap-3 min-w-0">
        <div className="min-w-0 shrink flex items-baseline gap-1.5">
          <span className="text-[10px] text-slate-500 tracking-wide">
            L{timer.levelNumber}
          </span>
          <span className="text-sm font-semibold text-emerald-400 font-mono tabular-nums leading-none">
            {timer.currentSb}/{timer.currentBb}
          </span>
        </div>

        <div className="min-w-0 shrink flex items-baseline gap-1.5">
          <span className="text-[10px] text-slate-500 tracking-wide">
            {timerLabel}
          </span>
          <span
            className={`text-sm font-mono font-semibold tabular-nums leading-none ${
              timer.increasePending ? "text-amber-400" : "text-slate-100"
            }`}
          >
            {timer.increasePending ? "Ready" : formatCountdown(displayRemaining)}
          </span>
        </div>

        <div className="hidden sm:flex items-baseline gap-1 text-[11px] min-w-0 shrink text-slate-400">
          {timer.nextBb !== null ? (
            <>
              <span className="text-slate-500">Next</span>
              <span className="font-mono text-slate-300 tabular-nums">
                {timer.nextSb}/{timer.nextBb}
              </span>
            </>
          ) : (
            <span className="text-slate-500">Final</span>
          )}
        </div>

        {isHost && (
          <div className="flex flex-nowrap items-center gap-1 ml-auto shrink-0">
            {!timer.increasePending &&
              (timer.paused ? (
                <button
                  type="button"
                  onClick={onResume}
                  disabled={actionLoading}
                  className="h-6 px-2 text-[11px] bg-emerald-600 hover:bg-emerald-500 rounded-md font-medium disabled:opacity-50"
                >
                  Resume
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onPause}
                  disabled={actionLoading || timer.levelEndsAt === null}
                  className="h-6 px-2 text-[11px] bg-slate-700 hover:bg-slate-600 rounded-md font-medium disabled:opacity-50"
                >
                  Pause
                </button>
              ))}
            <button
              type="button"
              onClick={onAdvance}
              disabled={actionLoading || !canAdvance}
              title={
                timer.increasePending
                  ? "Next blinds already scheduled"
                  : timer.nextBb === null
                    ? "Already at the final level"
                    : `Move to ${timer.nextSb} / ${timer.nextBb} on the next hand`
              }
              className="h-6 px-2 text-[11px] bg-amber-600 hover:bg-amber-500 rounded-md font-medium disabled:opacity-50"
            >
              {timer.increasePending ? "Set" : "Advance"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
