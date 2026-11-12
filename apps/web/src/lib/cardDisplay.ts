/**
 * Protocol/engine ranks use a single char (`T` for ten). UI labels use `10`.
 * Keep encoding as-is; only call this at render / email-format boundaries.
 */
export function formatRankDisplay(rank: string): string {
  return rank === "T" ? "10" : rank;
}
