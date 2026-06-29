import type { Prisma, PrismaClient } from "@prisma/client";

type DbClient = PrismaClient | Prisma.TransactionClient;

/** Rebuild cached stats from remaining finished tournament results. */
export async function recomputeUserStats(
  userId: string,
  db: DbClient
): Promise<void> {
  const results = await db.gameResult.findMany({
    where: { userId },
    include: {
      game: {
        select: { tournament: { select: { buyInCents: true } } },
      },
    },
  });

  const tournamentsPlayed = results.length;
  const wins = results.filter((r) => r.finishPosition === 1).length;
  const itmCount = results.filter((r) => r.payoutCents > 0).length;
  const totalBuyInCents = results.reduce(
    (sum, r) => sum + r.game.tournament.buyInCents,
    0
  );
  const totalPayoutCents = results.reduce((sum, r) => sum + r.payoutCents, 0);

  await db.userStats.upsert({
    where: { userId },
    create: {
      userId,
      tournamentsPlayed,
      wins,
      itmCount,
      totalBuyInCents,
      totalPayoutCents,
    },
    update: {
      tournamentsPlayed,
      wins,
      itmCount,
      totalBuyInCents,
      totalPayoutCents,
    },
  });
}
