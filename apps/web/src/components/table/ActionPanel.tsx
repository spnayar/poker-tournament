"use client";

import { useState, useEffect, useMemo } from "react";
import type { LegalActions } from "@poker/protocol";
import {
  clamp,
  potWagerTarget,
  wagerTargetForMultiplier,
} from "./actionPanelMath";

interface ActionPanelProps {
  legal: LegalActions | null;
  onAction: (action: unknown) => void;
  disabled?: boolean;
  waitingLabel?: string;
  awayBanner?: string | null;
  /** Action timer deadline (ms); warned while confirming all-in. */
  actionDeadlineAt?: number | null;
  /** Live pot for Pot preset sizing. */
  totalPot?: number;
}

const primaryBtn =
  "inline-flex items-center justify-center gap-0.5 sm:gap-1 h-8 px-2 sm:px-3 rounded-full text-[11px] sm:text-xs font-semibold disabled:opacity-45 whitespace-nowrap shrink-0 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400/70";

const presetBtn =
  "inline-flex items-center justify-center h-7 min-w-[1.85rem] px-1.5 sm:px-2 rounded-full text-[10px] sm:text-[11px] font-semibold disabled:opacity-45 whitespace-nowrap shrink-0 border transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400/70";

const stepBtn =
  "inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold shrink-0 border border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700 disabled:opacity-45 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400/70";

function IconFold({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      width="12"
      height="12"
      viewBox="0 0 12 12"
      aria-hidden
    >
      <path
        d="M3 3l6 6M9 3L3 9"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconCheck({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      width="12"
      height="12"
      viewBox="0 0 12 12"
      aria-hidden
    >
      <path
        d="M2.5 6.5l2.5 2.5 4.5-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconRaise({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      width="12"
      height="12"
      viewBox="0 0 12 12"
      aria-hidden
    >
      <path
        d="M6 9V3M3.5 5.5L6 3l2.5 2.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ActionPanel({
  legal,
  onAction,
  disabled,
  waitingLabel = "Waiting for other players...",
  awayBanner = null,
  actionDeadlineAt = null,
  totalPot = 0,
}: ActionPanelProps) {
  const canWager = legal?.canBet || legal?.canRaise;
  const wagerMin = legal?.canBet ? legal.minBet : (legal?.minRaiseTo ?? 0);
  const wagerMax = legal?.canBet
    ? legal.allInAmount
    : (legal?.maxRaise ?? 0);
  const wagerLabel = legal?.canBet ? "Bet" : "Raise";

  const raise2x = legal ? wagerTargetForMultiplier(legal, 2) : null;
  const raise3x = legal ? wagerTargetForMultiplier(legal, 3) : null;
  const potTarget = legal ? potWagerTarget(legal, totalPot) : null;
  const showPresets = Boolean(legal && canWager);

  const [amountInput, setAmountInput] = useState("");
  const [showAllIn, setShowAllIn] = useState(false);
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
  }, [canWager, wagerMin, wagerMax, legal?.canBet, legal?.canRaise]);

  const parsedAmount = useMemo(() => {
    const n = parseInt(amountInput, 10);
    return Number.isNaN(n) ? null : n;
  }, [amountInput]);

  const clampedAmount =
    parsedAmount !== null ? clamp(parsedAmount, wagerMin, wagerMax) : null;

  const isValidAmount =
    clampedAmount !== null && clampedAmount >= wagerMin && clampedAmount <= wagerMax;

  function submitWager(amount?: number) {
    if (!legal) return;
    const value = amount ?? clampedAmount;
    if (value === null) return;
    const next = clamp(value, wagerMin, wagerMax);
    if (next < wagerMin || next > wagerMax) return;
    if (legal.canBet) {
      onAction({ type: "bet", amount: next });
    } else if (legal.canRaise) {
      onAction({ type: "raise", amount: next });
    }
  }

  function setWagerAmount(amount: number) {
    setAmountInput(String(clamp(amount, wagerMin, wagerMax)));
  }

  function nudgeWager(delta: number) {
    const base = clampedAmount ?? wagerMin;
    const step = Math.max(1, Math.round((wagerMax - wagerMin) / 40));
    setWagerAmount(base + delta * step);
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
      <div className="flex flex-nowrap items-center justify-center gap-2 py-0.5 text-xs min-h-8 overflow-x-auto scrollbar-none">
        {awayBanner ? (
          <span className="text-amber-300 font-medium truncate">{awayBanner}</span>
        ) : null}
        {showWaiting ? (
          <span className="text-slate-400 truncate">{waitingLabel}</span>
        ) : null}
      </div>
    );
  }

  const allInTitle =
    actionSecondsLeft !== null
      ? `Timer still running — ${actionSecondsLeft}s left. If it hits zero you check or fold for this hand only.`
      : undefined;

  const middleLabel = legal.canCheck
    ? "Check"
    : legal.canCall
      ? `Call ${legal.callAmount.toLocaleString()}`
      : null;

  return (
    <div
      className="flex flex-nowrap items-center gap-1 sm:gap-1.5 py-0.5 px-0.5 max-w-full"
      role="toolbar"
      aria-label="Betting actions"
    >
      {/* Primary actions stay pinned; sizing/presets may scroll on narrow phones */}
      <div className="flex flex-nowrap items-center gap-1 shrink-0">
        {legal.canFold ? (
          <button
            type="button"
            onClick={() => onAction({ type: "fold" })}
            disabled={disabled}
            className={`${primaryBtn} bg-red-700/90 text-white hover:bg-red-600`}
          >
            <IconFold className="text-red-200 max-sm:hidden" />
            Fold
          </button>
        ) : null}

        {middleLabel && legal.canCheck ? (
          <button
            type="button"
            onClick={() => onAction({ type: "check" })}
            disabled={disabled}
            className={`${primaryBtn} bg-emerald-700 text-white hover:bg-emerald-600`}
          >
            <IconCheck className="text-emerald-200 max-sm:hidden" />
            Check
          </button>
        ) : null}

        {middleLabel && legal.canCall ? (
          <button
            type="button"
            onClick={() => onAction({ type: "call" })}
            disabled={disabled}
            className={`${primaryBtn} bg-emerald-700 text-white hover:bg-emerald-600`}
          >
            <IconCheck className="text-emerald-200 max-sm:hidden" />
            <span className="sm:hidden">Call</span>
            <span className="hidden sm:inline">{middleLabel}</span>
          </button>
        ) : null}

        {canWager ? (
          <button
            type="button"
            onClick={() => submitWager()}
            disabled={disabled || !isValidAmount}
            className={`${primaryBtn} bg-amber-500 text-slate-950 hover:bg-amber-400`}
          >
            <IconRaise className="text-slate-900 max-sm:hidden" />
            {wagerLabel}
            {clampedAmount !== null ? (
              <span className="font-mono tabular-nums max-sm:hidden">
                {clampedAmount.toLocaleString()}
              </span>
            ) : null}
          </button>
        ) : null}
      </div>

      {(canWager || showPresets) ? (
        <div className="flex flex-nowrap items-center gap-1 min-w-0 flex-1 overflow-x-auto scrollbar-none">
          {canWager ? (
            <div className="flex flex-nowrap items-center gap-1 shrink-0 pl-0.5 sm:pl-1 border-l border-slate-700/80">
              <button
                type="button"
                aria-label={`Decrease ${wagerLabel.toLowerCase()}`}
                onClick={() => nudgeWager(-1)}
                disabled={disabled}
                className={`${stepBtn} max-sm:hidden`}
              >
                −
              </button>
              <input
                type="range"
                aria-label={`${wagerLabel} slider`}
                min={wagerMin}
                max={wagerMax}
                value={clampedAmount ?? wagerMin}
                onChange={(e) => setAmountInput(e.target.value)}
                disabled={disabled}
                className="action-bet-slider w-14 sm:w-28 h-8 accent-amber-400 shrink min-w-[3rem] max-w-[7rem]"
              />
              <button
                type="button"
                aria-label={`Increase ${wagerLabel.toLowerCase()}`}
                onClick={() => nudgeWager(1)}
                disabled={disabled}
                className={`${stepBtn} max-sm:hidden`}
              >
                +
              </button>
              <input
                type="number"
                inputMode="numeric"
                aria-label={`${wagerLabel} amount`}
                min={wagerMin}
                max={wagerMax}
                value={amountInput}
                onChange={(e) =>
                  setAmountInput(e.target.value.replace(/[^0-9]/g, ""))
                }
                onKeyDown={handleInputKeyDown}
                disabled={disabled}
                className="w-12 sm:w-16 h-7 px-1 rounded-md bg-slate-900 border border-slate-600 focus:border-amber-400 focus:outline-none font-mono text-[11px] sm:text-xs tabular-nums text-amber-200 disabled:opacity-50 shrink-0"
              />
            </div>
          ) : null}

          {showPresets ? (
            <div className="flex flex-nowrap items-center gap-1 shrink-0 pl-0.5 sm:pl-1 border-l border-slate-700/80">
              {raise2x !== null ? (
                <button
                  type="button"
                  onClick={() => submitWager(raise2x)}
                  disabled={disabled}
                  title={`2× → ${raise2x.toLocaleString()}`}
                  className={`${presetBtn} border-emerald-700/60 bg-emerald-950/50 text-emerald-200 hover:bg-emerald-900/60`}
                >
                  2×
                </button>
              ) : null}
              {raise3x !== null ? (
                <button
                  type="button"
                  onClick={() => submitWager(raise3x)}
                  disabled={disabled}
                  title={`3× → ${raise3x.toLocaleString()}`}
                  className={`${presetBtn} border-emerald-700/60 bg-emerald-950/50 text-emerald-200 hover:bg-emerald-900/60`}
                >
                  3×
                </button>
              ) : null}
              {potTarget !== null ? (
                <button
                  type="button"
                  onClick={() => submitWager(potTarget)}
                  disabled={disabled}
                  title={`Pot → ${potTarget.toLocaleString()}`}
                  className={`${presetBtn} border-amber-700/50 bg-amber-950/40 text-amber-200 hover:bg-amber-900/50`}
                >
                  Pot
                </button>
              ) : null}
              {legal.canAllIn && !showAllIn ? (
                <button
                  type="button"
                  onClick={() => setShowAllIn(true)}
                  disabled={disabled}
                  className={`${presetBtn} border-amber-500/55 bg-amber-950/45 text-amber-300 hover:bg-amber-900/55`}
                >
                  All-in
                </button>
              ) : null}
              {legal.canAllIn && showAllIn ? (
                <button
                  type="button"
                  onClick={() => onAction({ type: "all-in" })}
                  disabled={disabled}
                  title={allInTitle}
                  className={`${presetBtn} border-amber-400/70 bg-amber-500/20 text-amber-200 hover:bg-amber-500/30 px-2`}
                >
                  OK {legal.allInAmount.toLocaleString()}
                  {actionSecondsLeft !== null ? (
                    <span
                      className={`ml-1 text-[10px] ${
                        actionSecondsLeft <= 10
                          ? "text-red-300"
                          : "text-amber-200/80"
                      }`}
                    >
                      {actionSecondsLeft}s
                    </span>
                  ) : null}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
