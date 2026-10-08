import type { Card } from "@poker/protocol";
import { Hand } from "pokersolver";
import { cardToPokersolver } from "./handEval";

/** Per-table fun-fact counters (seat-keyed). Snapshot-safe; no private hole cards. */
export type TableFunStats = {
  handsWonBySeat: Record<number, number>;
  knockoutsBySeat: Record<number, number>;
  largestPot: {
    amountChips: number;
    winnerSeatIds: number[];
    handNumber: number;
  } | null;
  bestHand: {
    seatId: number;
    handName: string;
    /** Five-card showdown hand (public at showdown). */
    cards: Card[];
    handNumber: number;
  } | null;
};

export function emptyTableFunStats(): TableFunStats {
  return {
    handsWonBySeat: {},
    knockoutsBySeat: {},
    largestPot: null,
    bestHand: null,
  };
}

export function cloneTableFunStats(stats: TableFunStats): TableFunStats {
  return {
    handsWonBySeat: { ...stats.handsWonBySeat },
    knockoutsBySeat: { ...stats.knockoutsBySeat },
    largestPot: stats.largestPot
      ? {
          amountChips: stats.largestPot.amountChips,
          winnerSeatIds: [...stats.largestPot.winnerSeatIds],
          handNumber: stats.largestPot.handNumber,
        }
      : null,
    bestHand: stats.bestHand
      ? {
          seatId: stats.bestHand.seatId,
          handName: stats.bestHand.handName,
          cards: [...stats.bestHand.cards],
          handNumber: stats.bestHand.handNumber,
        }
      : null,
  };
}

/**
 * Compare two five-card poker hands.
 * Returns positive if `a` beats `b`, negative if `b` beats `a`, 0 if tie.
 */
export function compareFiveCardHands(a: Card[], b: Card[]): number {
  if (a.length !== 5 || b.length !== 5) {
    throw new Error("compareFiveCardHands expects five-card hands");
  }
  const ha = Hand.solve(a.map(cardToPokersolver));
  const hb = Hand.solve(b.map(cardToPokersolver));
  const winners = Hand.winners([ha, hb]);
  if (winners.length === 2) return 0;
  return winners[0] === ha ? 1 : -1;
}
