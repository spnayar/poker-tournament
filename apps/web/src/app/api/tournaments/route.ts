import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@poker/db";
import { generateUniqueJoinCode } from "@/lib/joinCode";
import {
  defaultTournamentName,
  defaultPayoutPercents,
  parsePayoutPercents,
  validatePayoutPercents,
} from "@/lib/tournament";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [user, stats, tournaments] = await Promise.all([
      prisma.user.findUnique({ where: { id: session.user.id } }),
      prisma.userStats.findUnique({ where: { userId: session.user.id } }),
      prisma.tournament.findMany({
        where: {
          OR: [
            { hostUserId: session.user.id },
            { players: { some: { userId: session.user.id } } },
          ],
        },
        include: {
          host: { select: { displayName: true } },
          players: {
            include: {
              user: { select: { displayName: true, avatarUrl: true } },
            },
          },
          games: {
            where: { status: "FINISHED" },
            select: { id: true },
          },
          _count: { select: { players: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
    ]);

    return NextResponse.json({ user, stats, tournaments });
  } catch (err) {
    console.error("GET /api/tournaments failed:", err);
    return NextResponse.json(
      { error: "Failed to load tournaments" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const {
    name,
    buyInCents = 2000,
    startingChips = 5000,
    maxPlayers = 9,
    blindPreset = "standard",
    payoutPercents: rawPayouts,
  } = body;

  if (Array.isArray(rawPayouts)) {
    const payoutError = validatePayoutPercents(rawPayouts);
    if (payoutError) {
      return NextResponse.json({ error: payoutError }, { status: 400 });
    }
  }

  const payoutPercents = parsePayoutPercents(
    Array.isArray(rawPayouts) ? rawPayouts : defaultPayoutPercents()
  )!;

  try {
    const joinCode = await generateUniqueJoinCode(async (code) => {
      const existing = await prisma.tournament.findUnique({
        where: { inviteCode: code },
      });
      return !!existing;
    });

    const tournament = await prisma.tournament.create({
      data: {
        name: name?.trim() || defaultTournamentName(),
        hostUserId: session.user.id,
        buyInCents,
        startingChips,
        maxPlayers,
        blindPreset,
        payoutPercents,
        inviteCode: joinCode,
        players: {
          create: {
            userId: session.user.id,
          },
        },
      },
      include: {
        players: { include: { user: true } },
      },
    });

    return NextResponse.json(tournament);
  } catch (err) {
    console.error("POST /api/tournaments failed:", err);
    return NextResponse.json(
      { error: "Failed to create tournament" },
      { status: 500 }
    );
  }
}
