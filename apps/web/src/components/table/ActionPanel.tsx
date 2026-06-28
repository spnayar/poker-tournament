"use client";

import { useState, useEffect, useMemo } from "react";
import type { LegalActions } from "@poker/protocol";

interface ActionPanelProps {
  legal: LegalActions | null;
  onAction: (action: unknown) => void;
  disabled?: boolean;
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

export function ActionPanel({ legal, onAction, disabled }: ActionPanelProps) {
  const canWager = legal?.canBet || legal?.canRaise;
  const wagerMin = legal?.canBet ? legal.minBet : (legal?.minRaiseTo ?? 0);
  const wagerMax = legal?.canBet
    ? legal.allInAmount
    : (legal?.maxRaise ?? 0);
  const wagerLabel = legal?.canBet ? "Bet amount" : "Raise to";

  const raise2x = legal ? wagerTargetForMultiplier(legal, 2) : null;
  const raise3x = legal ? wagerTargetForMultiplier(legal, 3) : null;
  const showQuickRaises =
    legal && (legal.canRaise || legal.canBet) && (raise2x !== null || raise3x !== null);

  const [amountInput, setAmountInput] = useState("");
  const [showAllIn, setShowAllIn] = useState(false);

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
    return (
      <div className="text-center text-slate-400 py-4">
        Waiting for other players...
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 p-4">
      <div className="flex flex-wrap gap-2 justify-center">
        {legal.canFold && (
          <button
            onClick={() => onAction({ type: "fold" })}
            disabled={disabled}
            className="px-6 py-2 bg-red-600/80 hover:bg-red-500 rounded-lg font-medium disabled:opacity-50"
          >
            Fold
          </button>
        )}
        {legal.canCheck && (
          <button
            onClick={() => onAction({ type: "check" })}
            disabled={disabled}
            className="px-6 py-2 bg-slate-600 hover:bg-slate-500 rounded-lg font-medium disabled:opacity-50"
          >
            Check
          </button>
        )}
        {legal.canCall && (
          <button
            onClick={() => onAction({ type: "call" })}
            disabled={disabled}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium disabled:opacity-50"
          >
            Call {legal.callAmount}
          </button>
        )}
        {showQuickRaises && raise2x !== null && (
          <button
            onClick={() => submitQuickRaise(raise2x)}
            disabled={disabled}
            className="px-5 py-2 bg-emerald-700 hover:bg-emerald-600 rounded-lg font-medium disabled:opacity-50"
          >
            Raise 2×
            <span className="text-emerald-200/80 text-xs ml-1">
              ({raise2x.toLocaleString()})
            </span>
          </button>
        )}
        {showQuickRaises && raise3x !== null && (
          <button
            onClick={() => submitQuickRaise(raise3x)}
            disabled={disabled}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg font-medium disabled:opacity-50"
          >
            Raise 3×
            <span className="text-emerald-200/80 text-xs ml-1">
              ({raise3x.toLocaleString()})
            </span>
          </button>
        )}
      </div>

      {canWager && (
        <div className="w-full max-w-sm flex flex-col gap-2">
          <label className="text-sm text-slate-400">{wagerLabel}</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              inputMode="numeric"
              min={wagerMin}
              max={wagerMax}
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value.replace(/[^0-9]/g, ""))}
              onKeyDown={handleInputKeyDown}
              disabled={disabled}
              className="flex-1 px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 focus:border-emerald-500 focus:outline-none font-mono text-lg disabled:opacity-50"
            />
            <button
              onClick={submitWager}
              disabled={disabled || !isValidAmount}
              className="px-5 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg font-medium disabled:opacity-50 whitespace-nowrap"
            >
              {legal.canBet ? "Bet" : "Raise"}
            </button>
          </div>
          <p className="text-xs text-slate-500">
            Min {wagerMin.toLocaleString()} · Max {wagerMax.toLocaleString()}
            {parsedAmount !== null && !isValidAmount && (
              <span className="text-amber-400 ml-2">Enter a valid amount</span>
            )}
          </p>
          <input
            type="range"
            min={wagerMin}
            max={wagerMax}
            value={clampedAmount ?? wagerMin}
            onChange={(e) => setAmountInput(e.target.value)}
            disabled={disabled}
            className="w-full"
          />
        </div>
      )}

      {legal.canAllIn && (
        <div className="text-center">
          {!showAllIn ? (
            <button
              type="button"
              onClick={() => setShowAllIn(true)}
              disabled={disabled}
              className="text-xs text-slate-500 hover:text-slate-400 underline-offset-2 hover:underline disabled:opacity-50"
            >
              All-in ({legal.allInAmount.toLocaleString()})
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onAction({ type: "all-in" })}
              disabled={disabled}
              className="text-sm px-4 py-1.5 text-amber-400/90 border border-amber-600/40 rounded-lg hover:bg-amber-950/40 disabled:opacity-50"
            >
              Confirm all-in ({legal.allInAmount.toLocaleString()})
            </button>
          )}
        </div>
      )}
    </div>
  );
}
