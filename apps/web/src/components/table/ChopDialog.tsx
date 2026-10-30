"use client";

import { useEffect, useMemo, useState } from "react";
import {
  chipProportionalPayouts,
  parseLedgerAmountToCents,
  type SeatPublic,
} from "@poker/protocol";
import { formatCents, LEDGER_DISCLAIMER } from "@/lib/utils";

interface ChopDialogProps {
  open: boolean;
  tournamentId: string;
  seats: SeatPublic[];
  submitting: boolean;
  serverError: string;
  onClose: () => void;
  onConfirm: (shares: { userId: string; payoutCents: number }[]) => void;
}

function centsToField(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function ChopDialog({
  open,
  tournamentId,
  seats,
  submitting,
  serverError,
  onClose,
  onConfirm,
}: ChopDialogProps) {
  const [prizePoolCents, setPrizePoolCents] = useState<number | null>(null);
  const [loadError, setLoadError] = useState("");
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [step, setStep] = useState<"edit" | "confirm">("edit");

  const remaining = useMemo(
    () =>
      seats
        .filter((seat) => seat.chipCount > 0)
        .sort(
          (a, b) =>
            b.chipCount - a.chipCount ||
            a.displayName.localeCompare(b.displayName)
        ),
    [seats]
  );

  const suggested = useMemo(() => {
    if (prizePoolCents === null) return [];
    return chipProportionalPayouts(
      remaining.map((seat) => ({
        userId: seat.userId,
        chipCount: seat.chipCount,
      })),
      prizePoolCents
    );
  }, [prizePoolCents, remaining]);

  const suggestedByUser = useMemo(
    () => new Map(suggested.map((row) => [row.userId, row.payoutCents])),
    [suggested]
  );

  useEffect(() => {
    if (!open) {
      setStep("edit");
      setLoadError("");
      setPrizePoolCents(null);
      setAmounts({});
      return;
    }
    let cancelled = false;
    setLoadError("");
    fetch(`/api/tournaments/${tournamentId}`)
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data.error || "Could not load the buy-in");
        }
        const buyIn = data.tournament?.buyInCents;
        const playerCount = data.tournament?.players?.length;
        if (
          typeof buyIn !== "number" ||
          typeof playerCount !== "number" ||
          playerCount < 1
        ) {
          throw new Error("Could not load the buy-in");
        }
        if (!cancelled) setPrizePoolCents(buyIn * playerCount);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setLoadError(
            err instanceof Error ? err.message : "Could not load the buy-in"
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open, tournamentId]);

  useEffect(() => {
    if (!open || prizePoolCents === null || suggested.length === 0) return;
    setAmounts((current) => {
      if (Object.keys(current).length > 0) return current;
      return Object.fromEntries(
        suggested.map((row) => [row.userId, centsToField(row.payoutCents)])
      );
    });
  }, [open, prizePoolCents, suggested]);

  const parsed = remaining.map((seat) => ({
    userId: seat.userId,
    displayName: seat.displayName,
    payoutCents: parseLedgerAmountToCents(amounts[seat.userId] ?? ""),
  }));
  const allParsed = parsed.every((row) => row.payoutCents !== null);
  const total = allParsed
    ? parsed.reduce((sum, row) => sum + (row.payoutCents ?? 0), 0)
    : null;
  const difference =
    total !== null && prizePoolCents !== null ? total - prizePoolCents : null;
  const canReview =
    allParsed && difference === 0 && prizePoolCents !== null && !loadError;

  if (!open) return null;

  function fillFromChips() {
    setAmounts(
      Object.fromEntries(
        suggested.map((row) => [row.userId, centsToField(row.payoutCents)])
      )
    );
    setStep("edit");
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-3 bg-slate-950/75">
      <div
        role="dialog"
        aria-labelledby="chop-title"
        className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-xl"
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <h2 id="chop-title" className="text-lg font-semibold">
              {step === "edit" ? "Chop this tournament" : "End this tournament now?"}
            </h2>
            <p className="text-xs text-slate-400 mt-1 text-balance">
              {LEDGER_DISCLAIMER}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-slate-400 hover:text-slate-200"
          >
            Close
          </button>
        </div>

        {loadError && (
          <p className="text-sm text-red-400 mb-3" role="alert">
            {loadError}
          </p>
        )}

        {prizePoolCents !== null && (
          <p className="text-sm text-slate-300 mb-4">
            Buy-in pool{" "}
            <span className="font-mono text-amber-300">
              {formatCents(prizePoolCents)}
            </span>
            . Eliminated players get $0.00. The amounts below have to add up to
            that pool.
          </p>
        )}

        {step === "edit" ? (
          <>
            <div className="flex justify-end mb-2">
              <button
                type="button"
                onClick={fillFromChips}
                disabled={suggested.length === 0}
                className="text-xs text-emerald-400 hover:underline disabled:opacity-50"
              >
                Use chip split
              </button>
            </div>
            <div className="space-y-3">
              {remaining.map((seat) => (
                <div
                  key={seat.userId}
                  className="grid grid-cols-[1fr_auto] gap-2 items-center"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {seat.displayName}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {seat.chipCount.toLocaleString()} chips · chip split{" "}
                      {formatCents(suggestedByUser.get(seat.userId) ?? 0)}
                    </p>
                  </div>
                  <label className="text-right">
                    <span className="sr-only">Amount for {seat.displayName}</span>
                    <span className="text-slate-500 text-sm mr-1">$</span>
                    <input
                      inputMode="decimal"
                      value={amounts[seat.userId] ?? ""}
                      onChange={(event) =>
                        setAmounts((current) => ({
                          ...current,
                          [seat.userId]: event.target.value,
                        }))
                      }
                      className="w-24 px-2 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-right font-mono text-sm focus:border-emerald-500 focus:outline-none"
                    />
                  </label>
                </div>
              ))}
            </div>
            <p
              className={`text-sm mt-4 ${
                difference === 0 ? "text-emerald-400" : "text-amber-300"
              }`}
            >
              {total === null || prizePoolCents === null
                ? "Enter a dollar amount for each player."
                : difference === 0
                  ? `Total ${formatCents(total)} matches the pool.`
                  : difference > 0
                    ? `Over by ${formatCents(difference)}.`
                    : `Short by ${formatCents(-difference)}.`}
            </p>
            {serverError && (
              <p className="text-sm text-red-400 mt-2" role="alert">
                {serverError}
              </p>
            )}
            <button
              type="button"
              disabled={!canReview}
              onClick={() => setStep("confirm")}
              className="mt-4 w-full py-2.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm font-semibold disabled:opacity-50"
            >
              Review chop
            </button>
          </>
        ) : (
          <>
            <p className="text-sm text-slate-300 mb-3 text-balance">
              This ends the tournament now and replaces the planned payouts.
              The rest of the tournament will not be played out.
            </p>
            <ul className="space-y-2 mb-4">
              {parsed.map((row) => (
                <li
                  key={row.userId}
                  className="flex justify-between gap-3 text-sm border-b border-slate-800 pb-2"
                >
                  <span className="truncate">{row.displayName}</span>
                  <span className="font-mono text-amber-300 shrink-0">
                    {formatCents(row.payoutCents ?? 0)}
                  </span>
                </li>
              ))}
            </ul>
            {serverError && (
              <p className="text-sm text-red-400 mb-3" role="alert">
                {serverError}
              </p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStep("edit")}
                disabled={submitting}
                className="flex-1 py-2.5 rounded-lg border border-slate-700 text-sm"
              >
                Back
              </button>
              <button
                type="button"
                disabled={submitting || !canReview}
                onClick={() =>
                  onConfirm(
                    parsed.map((row) => ({
                      userId: row.userId,
                      payoutCents: row.payoutCents ?? 0,
                    }))
                  )
                }
                className="flex-1 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-sm font-semibold disabled:opacity-50"
              >
                {submitting ? "Ending…" : "End tournament and chop"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
