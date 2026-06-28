import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@poker/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const stats = await prisma.userStats.findUnique({
    where: { userId: session.user.id },
  });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { displayName: true, email: true, avatarUrl: true, createdAt: true },
  });

  const gameResults = await prisma.gameResult.findMany({
    where: { userId: session.user.id },
    include: {
      game: {
        include: {
          tournament: { select: { name: true, closedAt: true, buyInCents: true } },
        },
      },
    },
    orderBy: { game: { finishedAt: "desc" } },
    take: 50,
  });

  const history = gameResults.map((r) => ({
    finishPosition: r.finishPosition,
    payoutCents: r.payoutCents,
    tournament: {
      name: `${r.game.tournament.name} — Game ${r.game.gameNumber}`,
      buyInCents: r.game.tournament.buyInCents,
      finishedAt: r.game.finishedAt,
    },
  }));

  return NextResponse.json({ user, stats, history });
}
