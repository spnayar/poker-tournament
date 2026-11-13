"use client";

import { formatCents, getAvatarUrl, LEDGER_DISCLAIMER } from "@/lib/utils";
import type { PlayerDashboardStats } from "@/lib/playerDashboardStats";

function formatFinish(place: number): string {
  if (place === 1) return "1st";
  if (place === 2) return "2nd";
  if (place === 3) return "3rd";
  return `${place}th`;
}

function formatChips(n: number): string {
  return n.toLocaleString("en-US");
}

function ledgerSign(cents: number): string {
  const formatted = formatCents(cents);
  return cents > 0 ? `+${formatted}` : formatted;
}

type Props = {
  playStats: PlayerDashboardStats | null;
  /** True after the dashboard fetch finished. */
  ready: boolean;
};

export function PlayStatsPanel({ playStats, ready }: Props) {
  if (!ready) {
    return (
      <section className="mb-8 rounded-xl border border-slate-800 bg-slate-900/60 px-5 py-6">
        <p className="text-slate-500 text-sm">Loading your play stats…</p>
      </section>
    );
  }

  if (!playStats || playStats.career.sessionsPlayed === 0) {
    return (
      <section className="mb-8 rounded-xl border border-dashed border-slate-700 bg-slate-900/40 px-5 py-8 text-center">
        <h2 className="text-lg font-semibold text-slate-100">Your play</h2>
        <p className="mt-2 text-slate-400 text-sm max-w-md mx-auto">
          No finished nights yet. Host or join a game night — your ledger
          results, hands, and head-to-heads will show up here.
        </p>
        <p className="mt-3 text-amber-400/70 text-xs">{LEDGER_DISCLAIMER}</p>
      </section>
    );
  }

  const { career, headToHead } = playStats;
  const netColor =
    career.netLedgerCents > 0
      ? "text-emerald-400"
      : career.netLedgerCents < 0
        ? "text-red-400"
        : "text-slate-200";

  return (
    <section className="mb-8 rounded-xl border border-slate-800 bg-slate-900 px-5 py-5 sm:px-6 sm:py-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Your play</h2>
          <p className="text-slate-400 text-sm mt-0.5">
            {career.nightsPlayed} night{career.nightsPlayed === 1 ? "" : "s"} ·{" "}
            {career.wins} win{career.wins === 1 ? "" : "s"}
            {career.bestFinish != null && (
              <>
                {" "}
                · best finish{" "}
                <span className="text-amber-300 font-mono font-semibold">
                  {formatFinish(career.bestFinish)}
                </span>
              </>
            )}
          </p>
        </div>
        <div className="mt-3 sm:mt-0 sm:text-right">
          <p className={`text-2xl font-semibold font-mono tabular-nums ${netColor}`}>
            {ledgerSign(career.netLedgerCents)}
          </p>
          <p className="text-slate-400 text-xs mt-0.5">
            ledger net
            {career.ledgerRoiPercent != null && (
              <>
                {" "}
                ·{" "}
                <span className="text-amber-300/90 font-mono">
                  {career.ledgerRoiPercent > 0 ? "+" : ""}
                  {career.ledgerRoiPercent}% ROI
                </span>
              </>
            )}
          </p>
        </div>
      </div>

      <dl className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-4 border-t border-slate-800 pt-4">
        <div>
          <dt className="text-slate-500 text-xs uppercase tracking-wide">
            Hands won
          </dt>
          <dd className="mt-1 font-mono text-slate-100 tabular-nums">
            {career.handsWon}
            {career.handsDealt > 0 && (
              <span className="text-slate-500 text-sm">
                {" "}
                / {career.handsDealt}
              </span>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500 text-xs uppercase tracking-wide">
            Flops seen
          </dt>
          <dd className="mt-1 font-mono text-slate-100 tabular-nums">
            {career.flopsSeenPercent != null
              ? `${career.flopsSeenPercent}%`
              : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500 text-xs uppercase tracking-wide">
            Biggest pot
          </dt>
          <dd className="mt-1 font-mono text-amber-300 tabular-nums">
            {career.biggestPotChips != null
              ? `${formatChips(career.biggestPotChips)}`
              : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500 text-xs uppercase tracking-wide">
            Buy-ins in
          </dt>
          <dd className="mt-1 font-mono text-slate-100 tabular-nums">
            {formatCents(career.totalBuyInCents)}
          </dd>
        </div>
      </dl>

      <p className="mt-3 text-amber-400/70 text-xs">{LEDGER_DISCLAIMER}</p>

      {headToHead.length > 0 && (
        <div className="mt-6 border-t border-slate-800 pt-5">
          <h3 className="text-sm font-semibold text-slate-200">
            Head-to-head
          </h3>
          <p className="text-slate-500 text-xs mt-0.5 mb-3">
            Who finished ahead more often across nights you shared — ledger
            edge is tracking only.
          </p>
          <ul className="divide-y divide-slate-800/80">
            {headToHead.slice(0, 8).map((row) => {
              const edgeColor =
                row.netLedgerEdgeCents > 0
                  ? "text-emerald-400"
                  : row.netLedgerEdgeCents < 0
                    ? "text-red-400"
                    : "text-slate-400";
              const aheadLabel =
                row.finishesAhead === row.finishesBehind
                  ? "even finishes"
                  : row.finishesAhead > row.finishesBehind
                    ? `ahead ${row.finishesAhead}–${row.finishesBehind}`
                    : `behind ${row.finishesBehind}–${row.finishesAhead}`;

              return (
                <li
                  key={row.opponentUserId}
                  className="flex items-center gap-3 py-3 first:pt-0"
                >
                  <img
                    src={getAvatarUrl(row.displayName, row.avatarUrl)}
                    alt=""
                    className="w-9 h-9 rounded-full bg-slate-800 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-100 truncate">
                      {row.displayName}
                    </p>
                    <p className="text-slate-500 text-xs truncate">
                      {row.nightsTogether} night
                      {row.nightsTogether === 1 ? "" : "s"} · {aheadLabel}
                      {row.myHandsWon + row.theirHandsWon > 0 && (
                        <>
                          {" "}
                          · hands {row.myHandsWon}–{row.theirHandsWon}
                        </>
                      )}
                    </p>
                  </div>
                  <p
                    className={`shrink-0 font-mono text-sm tabular-nums ${edgeColor}`}
                    title="Your ledger net minus theirs across shared sessions"
                  >
                    {ledgerSign(row.netLedgerEdgeCents)}
                  </p>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
