import type { NightRecapStats } from "@/lib/nightRecap";
import { formatRankDisplay } from "@/lib/cardDisplay";
import { formatCents } from "@/lib/utils";
import { formatSessionLabelShort } from "@/lib/labels";
import type { Card } from "@poker/protocol";

function formatChipCount(n: number): string {
  return n.toLocaleString("en-US");
}

const SUIT_SYMBOLS: Record<string, string> = {
  c: "♣",
  d: "♦",
  h: "♥",
  s: "♠",
};

function formatCardsPlain(cards: Card[]): string {
  return cards
    .map((card) => {
      const rawRank = card.length === 2 ? card[0]! : card.slice(0, -1);
      const rank = formatRankDisplay(rawRank);
      const suit = card[card.length - 1]!;
      return `${rank}${SUIT_SYMBOLS[suit] ?? suit}`;
    })
    .join(" ");
}

function namedCountLine(
  rows: { displayName: string; count: number }[]
): string {
  return rows.map((r) => `${r.displayName} ${r.count}`).join(" · ");
}

/** True when the night has anything worth showing beyond empty shells. */
export function hasNightHighlights(
  stats: NightRecapStats | null | undefined
): boolean {
  if (!stats) return false;
  return (
    stats.totalHands > 0 ||
    stats.winners.length > 0 ||
    stats.handsWon.length > 0 ||
    stats.flopsSeen.length > 0 ||
    stats.knockouts.length > 0 ||
    stats.bestHand != null ||
    stats.largestPot != null ||
    stats.itm.length > 0
  );
}

interface NightHighlightsPanelProps {
  stats: NightRecapStats;
}

/**
 * Same night-highlight figures as the recap email (hands won, flop %,
 * best hand, largest pot, knockouts) — for the results page so players
 * who never open email still see them.
 */
export function NightHighlightsPanel({ stats }: NightHighlightsPanelProps) {
  const wonTotal = stats.handsWon.reduce((sum, r) => sum + r.count, 0);
  const chopNote =
    stats.totalHands > 0 && wonTotal > stats.totalHands
      ? "Primary pot winners; equal chops can exceed hands dealt"
      : null;

  return (
    <div className="bg-slate-900 rounded-xl p-4 border border-slate-800 mb-6">
      <h2 className="text-sm font-semibold text-slate-400 mb-2">
        Night highlights
      </h2>
      <p className="text-sm text-slate-300 mb-3">
        <span className="font-semibold text-slate-100">
          {stats.tournamentCount}
        </span>{" "}
        tournament{stats.tournamentCount === 1 ? "" : "s"}
        {" · "}
        <span className="font-semibold text-slate-100">{stats.totalHands}</span>{" "}
        hand{stats.totalHands === 1 ? "" : "s"} dealt
      </p>

      {stats.winners.length > 0 && (
        <ul className="space-y-1 text-sm text-slate-300 mb-3">
          {stats.winners.map((w) => {
            if (w.chopped) {
              const shares = (w.chopShares ?? [])
                .map((s) => {
                  const netSign = s.netCents >= 0 ? "+" : "";
                  return `${s.displayName} ${netSign}${formatCents(s.netCents)} (${formatCents(s.payoutCents)})`;
                })
                .join(" · ");
              return (
                <li key={`chop-${w.gameNumber}`}>
                  <span className="text-amber-400 font-medium">
                    {formatSessionLabelShort(w.gameNumber)}
                  </span>{" "}
                  chopped{shares ? ` — ${shares}` : ""}
                </li>
              );
            }
            const netSign = w.netCents >= 0 ? "+" : "";
            return (
              <li key={`win-${w.gameNumber}-${w.displayName}`}>
                <span className="font-medium text-slate-100">
                  {w.displayName}
                </span>{" "}
                won{" "}
                <span className="text-amber-400 font-medium">
                  {formatSessionLabelShort(w.gameNumber)}
                </span>
                ,{" "}
                <span
                  className={`font-mono font-semibold ${
                    w.netCents >= 0 ? "text-emerald-400" : "text-red-400"
                  }`}
                >
                  {netSign}
                  {formatCents(w.netCents)}
                </span>{" "}
                <span className="text-slate-500">
                  ({formatCents(w.payoutCents)} payout on a{" "}
                  {formatCents(w.buyInCents)} buy-in)
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {stats.itm.length > 0 && (
        <p className="text-xs text-slate-500 mb-3">
          In the money:{" "}
          {stats.itm
            .map(
              (r) =>
                `${r.displayName}${r.count > 1 ? ` (×${r.count})` : ""}`
            )
            .join(", ")}
        </p>
      )}

      {(stats.bestHand ||
        stats.largestPot ||
        stats.handsWon.length > 0 ||
        stats.flopsSeen.length > 0 ||
        stats.knockouts.length > 0) && (
        <div className="pt-3 border-t border-slate-800 space-y-3">
          <p className="text-xs font-semibold text-slate-500">Fun facts</p>
          <ul className="space-y-3 text-sm text-slate-300">
            {stats.bestHand && (
              <li>
                <p className="text-xs text-slate-500 mb-0.5">
                  Best hand of the night
                </p>
                <p>
                  <span className="font-medium text-slate-100">
                    {stats.bestHand.displayName}
                  </span>{" "}
                  — {stats.bestHand.handName}{" "}
                  <span className="font-mono text-amber-400">
                    {formatCardsPlain(stats.bestHand.cards)}
                  </span>
                </p>
              </li>
            )}
            {stats.largestPot && (
              <li>
                <p className="text-xs text-slate-500 mb-0.5">Largest pot</p>
                <p>
                  <span className="font-mono font-semibold text-amber-400">
                    {formatChipCount(stats.largestPot.amountChips)}
                  </span>{" "}
                  chips — {stats.largestPot.winnerNames.join(" & ")}
                </p>
              </li>
            )}
            {stats.handsWon.length > 0 && (
              <li>
                <p className="text-xs text-slate-500 mb-0.5">Hands won</p>
                <p className="text-slate-100">{namedCountLine(stats.handsWon)}</p>
                {chopNote && (
                  <p className="text-xs text-slate-600 mt-0.5">{chopNote}</p>
                )}
              </li>
            )}
            {stats.flopsSeen.length > 0 && (
              <li>
                <p className="text-xs text-slate-500 mb-0.5">Flops seen</p>
                <p>
                  {stats.flopsSeen.map((r, i) => (
                    <span key={r.displayName}>
                      {i > 0 ? " · " : ""}
                      <span className="font-medium text-slate-100">
                        {r.displayName}
                      </span>{" "}
                      {r.percent}%
                    </span>
                  ))}
                </p>
              </li>
            )}
            {stats.knockouts.length > 0 && (
              <li>
                <p className="text-xs text-slate-500 mb-0.5">Knockout kings</p>
                <p className="text-slate-100">
                  {namedCountLine(stats.knockouts)}
                </p>
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
