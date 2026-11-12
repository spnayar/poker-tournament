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
