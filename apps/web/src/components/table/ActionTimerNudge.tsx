"use client";

import { useEffect, useRef, useState } from "react";
import { ACTION_TIMER_NUDGE_SECONDS } from "@poker/protocol";
import { getSoundEnabled, playActionNudgeSound } from "@/lib/sounds";

interface ActionTimerNudgeProps {
  /** Deadline for the local acting player; null when not their turn / no timer. */
  actionDeadlineAt: number | null;
  soundEnabled: boolean;
}

/**
 * Non-blocking personal reminder when ~15s remain — only the acting player
 * sees and hears this.
 */
export function ActionTimerNudge({
  actionDeadlineAt,
  soundEnabled,
}: ActionTimerNudgeProps) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [visible, setVisible] = useState(false);
  const nudgedThisTurn = useRef(false);

  useEffect(() => {
    if (!actionDeadlineAt) {
      nudgedThisTurn.current = false;
      setVisible(false);
      return;
    }
    setNowMs(Date.now());
    const id = setInterval(() => setNowMs(Date.now()), 250);
    return () => clearInterval(id);
  }, [actionDeadlineAt]);

  const actionSecondsLeft = actionDeadlineAt
    ? Math.max(0, Math.ceil((actionDeadlineAt - nowMs) / 1000))
    : null;

  useEffect(() => {
    if (actionSecondsLeft === null) {
      nudgedThisTurn.current = false;
      setVisible(false);
      return;
    }

    if (actionSecondsLeft > ACTION_TIMER_NUDGE_SECONDS) {
      nudgedThisTurn.current = false;
      setVisible(false);
      return;
    }

    if (actionSecondsLeft <= 0) {
      setVisible(false);
      return;
    }

    if (!nudgedThisTurn.current) {
      nudgedThisTurn.current = true;
      setVisible(true);
      if (soundEnabled && getSoundEnabled()) {
        playActionNudgeSound();
      }
    }
  }, [actionSecondsLeft, soundEnabled]);

  if (!visible || actionSecondsLeft === null || actionSecondsLeft <= 0) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed bottom-20 left-1/2 z-[60] -translate-x-1/2 max-w-[min(22rem,92vw)] px-3"
    >
      <div className="rounded-lg border border-amber-500/40 bg-slate-950/95 px-3 py-2 shadow-xl text-center">
        <p className="text-sm text-amber-200 font-medium">
          Friendly nudge — about {actionSecondsLeft}s left
        </p>
        <p className="text-[11px] text-slate-400 mt-0.5">
          Take your time; if the timer hits zero you&apos;ll check or fold for
          this hand only.
        </p>
      </div>
    </div>
  );
}
