import { prisma } from "@poker/db";
import {
  aggregatePlayerDashboardStats,
  type DashboardGameInput,
  type PlayerDashboardStats,
} from "./playerDashboardStats";

/**
 * Load finished sessions the user played and aggregate career + H2H stats.
 * Sources: GameResult (finish/payout), Tournament.buyInCents, Game.funStats, Game.chopped.
 */
export async function loadPlayerDashboardStats(
  userId: string
): Promise<PlayerDashboardStats> {
  const myResults = await prisma.gameResult.findMany({
    where: { userId },
    select: {
      gameId: true,
      game: {
        select: {
          id: true,
          tournamentId: true,
          chopped: true,
          funStats: true,
          tournament: { select: { buyInCents: true } },
          results: {
            select: {
              userId: true,
              finishPosition: true,
              payoutCents: true,
              user: {
                select: {
                  displayName: true,
                  avatarUrl: true,
                },
              },
            },
          },
        },
      },
    },
  });

  const games: DashboardGameInput[] = myResults.map((row) => ({
    gameId: row.game.id,
    tournamentId: row.game.tournamentId,
    chopped: row.game.chopped,
    buyInCents: row.game.tournament.buyInCents,
    funStats: row.game.funStats,
    results: row.game.results.map((r) => ({
      userId: r.userId,
      displayName: r.user.displayName,
      avatarUrl: r.user.avatarUrl,
      finishPosition: r.finishPosition,
      payoutCents: r.payoutCents,
    })),
  }));

  return aggregatePlayerDashboardStats(userId, games);
}
