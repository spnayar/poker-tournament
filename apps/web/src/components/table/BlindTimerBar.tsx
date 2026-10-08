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
    <div className="relative z-50 bg-slate-900/95 border border-slate-800/90 rounded-lg px-2.5 py-1 mb-1.5 shrink-0">
      <div className="flex flex-nowrap items-center gap-2 sm:gap-3 min-w-0">
        <div className="min-w-0 shrink">
          <p className="text-[9px] sm:text-[10px] text-slate-500 uppercase tracking-wider leading-none">
            L{timer.levelNumber}
          </p>
          <p className="text-sm sm:text-base font-semibold text-emerald-400 font-mono tabular-nums leading-tight">
            {timer.currentSb}/{timer.currentBb}
          </p>
        </div>

        <div className="text-center min-w-0 shrink">
          <p className="text-[9px] sm:text-[10px] text-slate-500 uppercase tracking-wider leading-none">
            {timerLabel}
          </p>
          <p
            className={`text-sm sm:text-base font-mono font-bold tabular-nums leading-tight ${
              timer.increasePending ? "text-amber-400" : "text-slate-100"
            }`}
          >
            {timer.increasePending ? "Ready" : formatCountdown(displayRemaining)}
          </p>
        </div>

        <div className="hidden sm:block text-right text-[11px] min-w-0 shrink text-slate-400">
          {timer.nextBb !== null ? (
            <p>
              <span className="text-slate-500">Next </span>
              <span className="font-mono text-slate-300">
                {timer.nextSb}/{timer.nextBb}
              </span>
            </p>
          ) : (
            <p className="text-slate-500">Final</p>
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
                  className="px-2 py-0.5 text-[11px] sm:text-xs bg-emerald-600 hover:bg-emerald-500 rounded-md font-medium disabled:opacity-50"
                >
                  Resume
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onPause}
                  disabled={actionLoading || timer.levelEndsAt === null}
                  className="px-2 py-0.5 text-[11px] sm:text-xs bg-slate-700 hover:bg-slate-600 rounded-md font-medium disabled:opacity-50"
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
              className="px-2 py-0.5 text-[11px] sm:text-xs bg-amber-600 hover:bg-amber-500 rounded-md font-medium disabled:opacity-50"
            >
              {timer.increasePending ? "Set" : "Advance"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
