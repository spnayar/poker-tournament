"use client";

import { useEffect, useState } from "react";

interface ActionTimerControlsProps {
  actionTimerSeconds: number;
  actionTimerPaused: boolean;
  actionDeadlineAt: number | null;
  actionTimerPausedRemainingMs: number | null;
  onPause: () => void;
  onResume: () => void;
  onReset: () => void;
  onDisable: () => void;
  actionLoading?: boolean;
}

export function ActionTimerControls({
  actionTimerSeconds,
  actionTimerPaused,
  actionDeadlineAt,
  actionTimerPausedRemainingMs,
  onPause,
  onResume,
  onReset,
  onDisable,
  actionLoading = false,
}: ActionTimerControlsProps) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (!actionDeadlineAt || actionTimerPaused) return;
    setNowMs(Date.now());
    const id = setInterval(() => setNowMs(Date.now()), 250);
    return () => clearInterval(id);
  }, [actionDeadlineAt, actionTimerPaused]);

  const actionSecondsLeft = actionTimerPaused
    ? actionTimerPausedRemainingMs != null
      ? Math.max(0, Math.ceil(actionTimerPausedRemainingMs / 1000))
      : null
    : actionDeadlineAt
      ? Math.max(0, Math.ceil((actionDeadlineAt - nowMs) / 1000))
      : null;

  const enabled = actionTimerSeconds > 0;
  const timerLabel = !enabled
    ? "Off"
    : actionTimerPaused
      ? `Paused ${actionSecondsLeft ?? ""}s`.trim()
      : actionSecondsLeft !== null
        ? `${actionSecondsLeft}s`
        : `${actionTimerSeconds}s`;

  return (
    <div className="table-chrome rounded-md px-2 py-1 mb-1.5 shrink-0">
      <div className="flex flex-nowrap items-center gap-2 min-w-0">
        <div className="min-w-0 shrink flex items-baseline gap-1.5">
          <span className="text-[10px] text-slate-500 tracking-wide">
            Action
          </span>
          <span
            className={`text-sm font-mono font-semibold tabular-nums leading-none ${
              !enabled
                ? "text-slate-500"
                : actionTimerPaused ||
                    (actionSecondsLeft !== null && actionSecondsLeft <= 15)
                  ? "text-amber-300"
                  : "text-slate-100"
            }`}
          >
            {timerLabel}
          </span>
        </div>

        <div className="flex flex-nowrap items-center gap-1 ml-auto shrink-0">
          {enabled ? (
            <>
              {actionTimerPaused ? (
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
                  disabled={actionLoading || actionSecondsLeft === null}
                  className="h-6 px-2 text-[11px] bg-slate-700 hover:bg-slate-600 rounded-md font-medium disabled:opacity-50"
                >
                  Pause
                </button>
              )}
              <button
                type="button"
                onClick={onReset}
                disabled={actionLoading}
                className="h-6 px-2 text-[11px] bg-slate-700 hover:bg-slate-600 rounded-md font-medium disabled:opacity-50"
                title="Restart the current player's timer"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={onDisable}
                disabled={actionLoading}
                className="h-6 px-2 text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-md font-medium disabled:opacity-50"
                title="Turn off action timers for this night"
              >
                Off
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onReset}
              disabled={actionLoading}
              className="h-6 px-2 text-[11px] bg-emerald-600 hover:bg-emerald-500 rounded-md font-medium disabled:opacity-50"
              title="Turn action timers back on"
            >
              Turn on
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
