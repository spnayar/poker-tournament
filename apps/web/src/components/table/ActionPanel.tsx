"use client";

import { useState, useEffect, useMemo } from "react";
import type { LegalActions } from "@poker/protocol";

interface ActionPanelProps {
  legal: LegalActions | null;
  onAction: (action: unknown) => void;
  disabled?: boolean;
  waitingLabel?: string;
  awayBanner?: string | null;
  /** Action timer deadline (ms); warned while confirming all-in. */
  actionDeadlineAt?: number | null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Derive table current bet and this player's contribution from legal actions. */
function getBetContext(legal: LegalActions): {
  currentBet: number;
  betThisRound: number;
} {
  const betThisRound = legal.maxRaise - legal.allInAmount;
  const currentBet = legal.canCall
    ? legal.callAmount + betThisRound
    : legal.canBet
      ? legal.minBet
      : Math.max(betThisRound, legal.minRaiseTo - legal.minRaise);
  return { currentBet, betThisRound };
}

function wagerTargetForMultiplier(
  legal: LegalActions,
  multiplier: number
): number | null {
  const { currentBet } = getBetContext(legal);

  if (legal.canBet) {
    const amount = clamp(currentBet * multiplier, legal.minBet, legal.allInAmount);
    return amount >= legal.minBet ? amount : null;
  }

  if (!legal.canRaise) return null;

  const raiseTo = clamp(
    currentBet * multiplier,
    legal.minRaiseTo,
    legal.maxRaise
  );
  return raiseTo >= legal.minRaiseTo ? raiseTo : null;
}

const btnBase =
  "px-2.5 py-1 sm:px-3 sm:py-1 text-xs sm:text-sm rounded-md font-medium disabled:opacity-50 whitespace-nowrap shrink-0";

export function ActionPanel({
  legal,
  onAction,
  disabled,
  waitingLabel = "Waiting for other players...",
  awayBanner = null,
  actionDeadlineAt = null,
}: ActionPanelProps) {
  const canWager = legal?.canBet || legal?.canRaise;
  const wagerMin = legal?.canBet ? legal.minBet : (legal?.minRaiseTo ?? 0);
  const wagerMax = legal?.canBet
    ? legal.allInAmount
    : (legal?.maxRaise ?? 0);
  const wagerLabel = legal?.canBet ? "Bet" : "Raise";

  const raise2x = legal ? wagerTargetForMultiplier(legal, 2) : null;
  const raise3x = legal ? wagerTargetForMultiplier(legal, 3) : null;
  const showQuickRaises =
    legal && (legal.canRaise || legal.canBet) && (raise2x !== null || raise3x !== null);

  const [amountInput, setAmountInput] = useState("");
  const [showAllIn, setShowAllIn] = useState(false);
  const [showCustomBet, setShowCustomBet] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!actionDeadlineAt || !showAllIn) return;
    setNowMs(Date.now());
    const id = setInterval(() => setNowMs(Date.now()), 250);
    return () => clearInterval(id);
  }, [actionDeadlineAt, showAllIn]);

  const actionSecondsLeft =
    actionDeadlineAt && showAllIn
      ? Math.max(0, Math.ceil((actionDeadlineAt - nowMs) / 1000))
      : null;

  useEffect(() => {
    if (canWager) {
      setAmountInput(String(wagerMin));
    }
    setShowAllIn(false);
    setShowCustomBet(false);
  }, [canWager, wagerMin, wagerMax, legal?.canBet, legal?.canRaise]);

  const parsedAmount = useMemo(() => {
    const n = parseInt(amountInput, 10);
    return Number.isNaN(n) ? null : n;
  }, [amountInput]);

  const clampedAmount =
    parsedAmount !== null ? clamp(parsedAmount, wagerMin, wagerMax) : null;

  const isValidAmount =
    clampedAmount !== null && clampedAmount >= wagerMin && clampedAmount <= wagerMax;

  function submitWager() {
    if (!legal || clampedAmount === null || !isValidAmount) return;
    if (legal.canBet) {
      onAction({ type: "bet", amount: clampedAmount });
    } else if (legal.canRaise) {
      onAction({ type: "raise", amount: clampedAmount });
    }
  }

  function submitQuickRaise(amount: number) {
    if (!legal || disabled) return;
    if (legal.canBet) {
      onAction({ type: "bet", amount });
    } else {
      onAction({ type: "raise", amount });
    }
  }

  function handleInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      submitWager();
    }
  }

  if (!legal) {
    const showWaiting = waitingLabel && waitingLabel !== awayBanner;
    return (
      <div className="text-center py-0.5 text-xs space-y-0.5">
        {awayBanner ? (
          <p className="text-amber-300 font-medium">{awayBanner}</p>
        ) : null}
        {showWaiting ? (
          <p className="text-slate-400">{waitingLabel}</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-stretch gap-1 p-0.5">
      <div className="flex flex-nowrap items-center justify-center gap-1 overflow-x-auto max-w-full scrollbar-none">
        {legal.canFold && (
          <button
            onClick={() => onAction({ type: "fold" })}
            disabled={disabled}
            className={`${btnBase} bg-red-600/80 hover:bg-red-500`}
          >
            Fold
          </button>
        )}
        {legal.canCheck && (
          <button
            onClick={() => onAction({ type: "check" })}
            disabled={disabled}
            className={`${btnBase} bg-slate-600 hover:bg-slate-500`}
          >
            Check
          </button>
        )}
        {legal.canCall && (
          <button
            onClick={() => onAction({ type: "call" })}
            disabled={disabled}
            className={`${btnBase} bg-sky-700 hover:bg-sky-600`}
          >
            Call {legal.callAmount.toLocaleString()}
          </button>
        )}
        {showQuickRaises && raise2x !== null && (
          <button
            onClick={() => submitQuickRaise(raise2x)}
            disabled={disabled}
            className={`${btnBase} bg-emerald-700 hover:bg-emerald-600`}
          >
            2×
            <span className="text-emerald-200/80 text-[10px] sm:text-xs ml-0.5">
              {raise2x.toLocaleString()}
            </span>
          </button>
        )}
        {showQuickRaises && raise3x !== null && (
          <button
            onClick={() => submitQuickRaise(raise3x)}
            disabled={disabled}
            className={`${btnBase} bg-emerald-600 hover:bg-emerald-500`}
          >
            3×
            <span className="text-emerald-200/80 text-[10px] sm:text-xs ml-0.5">
              {raise3x.toLocaleString()}
            </span>
          </button>
        )}
        {canWager && !showCustomBet ? (
          <button
            type="button"
            onClick={() => setShowCustomBet(true)}
            className={`${btnBase} bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300`}
          >
            Custom
          </button>
        ) : null}
        {legal.canAllIn && !showAllIn ? (
          <button
            type="button"
            onClick={() => setShowAllIn(true)}
            disabled={disabled}
            className={`${btnBase} text-amber-400/90 border border-amber-600/40 hover:bg-amber-950/40`}
          >
            All-in
          </button>
        ) : null}
        {legal.canAllIn && showAllIn ? (
          <button
            type="button"
            onClick={() => onAction({ type: "all-in" })}
            disabled={disabled}
            className={`${btnBase} text-amber-300 border border-amber-500/60 bg-amber-950/50 hover:bg-amber-900/50`}
          >
            Confirm {legal.allInAmount.toLocaleString()}
          </button>
        ) : null}
      </div>

      {legal.canAllIn && showAllIn && actionSecondsLeft !== null ? (
        <p
          className={`text-center text-[10px] sm:text-[11px] ${
            actionSecondsLeft <= 10
              ? "text-red-400 font-medium"
              : "text-amber-300/90"
          }`}
        >
          Timer still running — {actionSecondsLeft}s left. If it hits zero you
          fold and sit out.
        </p>
      ) : null}

      {canWager && showCustomBet && (
        <div className="w-full max-w-md mx-auto flex items-center gap-1.5">
          <label className="text-[10px] text-slate-500 shrink-0">
            {wagerLabel}
          </label>
          <input
            type="number"
            inputMode="numeric"
            min={wagerMin}
            max={wagerMax}
            value={amountInput}
            onChange={(e) => setAmountInput(e.target.value.replace(/[^0-9]/g, ""))}
            onKeyDown={handleInputKeyDown}
            disabled={disabled}
            className="w-20 sm:w-24 px-2 py-1 rounded-md bg-slate-800 border border-slate-700 focus:border-emerald-500 focus:outline-none font-mono text-sm disabled:opacity-50"
          />
          <input
            type="range"
            min={wagerMin}
            max={wagerMax}
            value={clampedAmount ?? wagerMin}
            onChange={(e) => setAmountInput(e.target.value)}
            disabled={disabled}
            className="flex-1 h-1.5 min-w-0"
          />
          <button
            onClick={submitWager}
            disabled={disabled || !isValidAmount}
            className={`${btnBase} bg-slate-700 hover:bg-slate-600`}
          >
            {wagerLabel}
          </button>
        </div>
      )}
    </div>
  );
}
