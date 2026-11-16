/** Seat hand-participation visuals on the felt (not Away connectivity). */

export type SeatVisualKind = "out" | "folded" | "away" | "live";

export function seatVisualKind(seat: {
  folded: boolean;
  skipped: boolean;
  away?: boolean;
  eliminated?: boolean;
}): SeatVisualKind {
  if (seat.eliminated) return "out";
  if (seat.folded) return "folded";
  if (seat.skipped || seat.away) return "away";
  return "live";
}

/** Hole-card backs only for seats still in the hand. */
export function showSeatHoleCards(seat: {
  folded: boolean;
  eliminated?: boolean;
}): boolean {
  return !seat.folded && seat.eliminated !== true;
}

/**
 * How opponent hole cards appear on a seat (hero uses the full hole-card row).
 * Mid-hand always keeps the avatar as the seat face — backs tuck behind it,
 * never replace it (QA F3). Fan only at showdown when cards are revealed.
 * Face-down / undefined until reveal — never leak opponent ranks/suits.
 */
export type OpponentHolePresentation = "hidden" | "tucked-backs" | "fan-reveal";

export function opponentHolePresentation(opts: {
  folded: boolean;
  eliminated?: boolean;
  revealHoleCards: boolean;
  showCards: boolean;
}): OpponentHolePresentation {
  if (!showSeatHoleCards(opts)) return "hidden";
  if (opts.revealHoleCards && opts.showCards) return "fan-reveal";
  return "tucked-backs";
}
