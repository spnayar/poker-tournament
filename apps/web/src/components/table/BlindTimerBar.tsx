"use client";

import { useEffect, useRef, useState } from "react";
import type { BlindLevel, BlindTimerState } from "@poker/protocol";

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
  /** Host chose a structure level (0-based index) to schedule for next hand. */
  onAdvanceToLevel: (targetLevelIndex: number) => void;
  actionLoading?: boolean;
}

export function BlindTimerBar({
  timer,
  myUserId,
  onPause,
  onResume,
  onAdvanceToLevel,
  actionLoading = false,
}: BlindTimerBarProps) {
  const [now, setNow] = useState(() => Date.now());
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (timer.paused || timer.increasePending || timer.levelEndsAt === null) {
      return;
    }
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [timer]);

  useEffect(() => {
    if (!pickerOpen) return;
    function onDoc(e: MouseEvent) {
      if (!pickerRef.current?.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setPickerOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [pickerOpen]);

  useEffect(() => {
    if (timer.increasePending) setPickerOpen(false);
  }, [timer.increasePending]);

  const isHost = timer.hostUserId === myUserId;
  const advanceOptions: BlindLevel[] = timer.advanceOptions ?? [];
  const canAdvance = advanceOptions.length > 0 && !timer.increasePending;
  const displayRemaining = timer.increasePending
    ? 0
    : timer.paused
      ? timer.pausedRemainingMs
      : timer.levelEndsAt !== null
        ? Math.max(0, timer.levelEndsAt - now)
        : null;

  const pendingSb = timer.pendingSb ?? timer.nextSb;
  const pendingBb = timer.pendingBb ?? timer.nextBb;

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
          {pendingBb !== null ? (
            <>
              <span className="text-slate-500">
                {timer.increasePending ? "To" : "Next"}
              </span>
              <span className="font-mono text-slate-300 tabular-nums">
                {pendingSb}/{pendingBb}
              </span>
            </>
          ) : (
            <span className="text-slate-500">Final</span>
          )}
        </div>

        {isHost && (
          <div className="relative flex flex-nowrap items-center gap-1 ml-auto shrink-0" ref={pickerRef}>
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
            {timer.increasePending ? (
              <button
                type="button"
                disabled
                className="h-6 px-2 text-[11px] bg-amber-600/70 rounded-md font-medium disabled:opacity-70"
                title="Next blinds already scheduled"
              >
                Set
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setPickerOpen((o) => !o)}
                  disabled={actionLoading || !canAdvance}
                  aria-haspopup="listbox"
                  aria-expanded={pickerOpen}
                  title={
                    !canAdvance
                      ? "Already at the final level"
                      : "Choose which blind level to move to next hand"
                  }
                  className="h-6 px-2 text-[11px] bg-amber-600 hover:bg-amber-500 rounded-md font-medium disabled:opacity-50"
                >
                  Advance
                </button>
                {pickerOpen && canAdvance ? (
                  <div
                    role="listbox"
                    aria-label="Blind levels"
                    className="absolute right-0 top-full z-[80] mt-1 max-h-56 w-44 overflow-y-auto rounded-lg border border-slate-600 bg-slate-950 py-1 shadow-2xl"
                  >
                    <p className="px-3 py-1.5 text-[10px] uppercase tracking-wide text-slate-500">
                      Next hand →
                    </p>
                    {advanceOptions.map((level) => {
                      const index = level.level - 1;
                      return (
                        <button
                          key={level.level}
                          type="button"
                          role="option"
                          className="flex w-full items-baseline justify-between gap-2 px-3 py-1.5 text-left text-sm text-slate-100 hover:bg-slate-800"
                          onClick={() => {
                            setPickerOpen(false);
                            onAdvanceToLevel(index);
                          }}
                        >
                          <span className="text-slate-400 text-xs">
                            L{level.level}
                          </span>
                          <span className="font-mono tabular-nums text-amber-300">
                            {level.sb}/{level.bb}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
