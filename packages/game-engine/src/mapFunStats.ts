import type { GameFunStats } from "@poker/protocol";
import { emptyGameFunStats } from "@poker/protocol";
import type { TableFunStats } from "./funStats";

function addSeatCounts(
  target: Record<string, number>,
  bySeat: Record<number, number>,
  lookup: (seat: number) => string | undefined
): void {
  for (const [seatKey, count] of Object.entries(bySeat)) {
    const userId = lookup(Number(seatKey));
    if (!userId || count <= 0) continue;
    target[userId] = (target[userId] ?? 0) + count;
  }
}

/** Map seat-keyed table fun stats to user-keyed persisted GameFunStats. */
export function mapTableFunStatsToGame(
  stats: TableFunStats,
  userIdBySeat: Map<number, string> | Record<number, string>
): GameFunStats {
  const lookup =
    userIdBySeat instanceof Map
      ? (seat: number) => userIdBySeat.get(seat)
      : (seat: number) => userIdBySeat[seat];

  const out = emptyGameFunStats();

  addSeatCounts(out.handsWonByUserId, stats.handsWonBySeat, lookup);
  addSeatCounts(out.knockoutsByUserId, stats.knockoutsBySeat, lookup);
  addSeatCounts(out.handsDealtByUserId, stats.handsDealtBySeat, lookup);
  addSeatCounts(out.flopsSeenByUserId, stats.flopsSeenBySeat, lookup);

  if (stats.largestPot) {
    const winnerUserIds = stats.largestPot.winnerSeatIds
      .map((seat) => lookup(seat))
      .filter((id): id is string => Boolean(id));
    out.largestPot = {
      amountChips: stats.largestPot.amountChips,
      winnerUserIds,
      handNumber: stats.largestPot.handNumber,
    };
  }

  if (stats.bestHand) {
    const userId = lookup(stats.bestHand.seatId);
    if (userId) {
      out.bestHand = {
        userId,
        handName: stats.bestHand.handName,
        cards: [...stats.bestHand.cards],
        handNumber: stats.bestHand.handNumber,
      };
    }
  }

  return out;
}
