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
  actionLoading?: boolean;
}

export function BlindTimerBar({
  timer,
  myUserId,
  onPause,
  onResume,
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
  const displayRemaining = timer.increasePending
    ? 0
    : timer.paused
      ? timer.pausedRemainingMs
      : timer.levelEndsAt !== null
        ? Math.max(0, timer.levelEndsAt - now)
        : null;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 mb-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wide">
            Blinds · Level {timer.levelNumber}
          </p>
          <p className="text-lg font-semibold text-emerald-400">
            {timer.currentSb} / {timer.currentBb}
          </p>
        </div>

        <div className="text-center">
          <p className="text-xs text-slate-500 uppercase tracking-wide">
            {timer.increasePending
              ? "Next level on next hand"
              : timer.paused
                ? "Timer paused"
                : "Next level in"}
          </p>
          <p
            className={`text-2xl font-mono font-bold ${
              timer.increasePending ? "text-amber-400" : "text-white"
            }`}
          >
            {timer.increasePending ? "Ready" : formatCountdown(displayRemaining)}
          </p>
        </div>

        <div className="text-right text-sm">
          {timer.nextBb !== null ? (
            <>
              <p className="text-slate-500">Up next</p>
              <p className="font-medium">
                {timer.nextSb} / {timer.nextBb}
              </p>
            </>
          ) : (
            <p className="text-slate-500">Final level</p>
          )}
        </div>
      </div>

      {isHost && !timer.increasePending && (
        <div className="flex justify-center gap-2 mt-3 pt-3 border-t border-slate-800">
          {timer.paused ? (
            <button
              type="button"
              onClick={onResume}
              disabled={actionLoading}
              className="px-4 py-1.5 text-sm bg-emerald-600 hover:bg-emerald-500 rounded-lg font-medium disabled:opacity-50"
            >
              Resume timer
            </button>
          ) : (
            <button
              type="button"
              onClick={onPause}
              disabled={actionLoading || timer.levelEndsAt === null}
              className="px-4 py-1.5 text-sm bg-slate-700 hover:bg-slate-600 rounded-lg font-medium disabled:opacity-50"
            >
              Pause timer
            </button>
          )}
        </div>
      )}
    </div>
  );
}
