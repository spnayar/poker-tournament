import { NextResponse } from "next/server";
import { formatSessionHistoryName } from "@/lib/labels";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@poker/db";
import { isAllowedAvatarUrl } from "@/lib/avatars";

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
      name: formatSessionHistoryName(
        r.game.tournament.name,
        r.game.gameNumber
      ),
      buyInCents: r.game.tournament.buyInCents,
      finishedAt: r.game.finishedAt,
    },
  }));

  return NextResponse.json({ user, stats, history });
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { avatarUrl } = body;

  if (typeof avatarUrl !== "string" || !avatarUrl) {
    return NextResponse.json({ error: "avatarUrl is required" }, { status: 400 });
  }

  if (!isAllowedAvatarUrl(avatarUrl)) {
    return NextResponse.json({ error: "Invalid avatar" }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data: { avatarUrl },
    select: { displayName: true, email: true, avatarUrl: true },
  });

  return NextResponse.json({ user });
}
