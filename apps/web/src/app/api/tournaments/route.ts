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
import {
  BlindPaceSchema,
  BLIND_LEVEL_MINUTE_OPTIONS,
  buildBlindLevels,
} from "@poker/protocol";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [user, stats, tournaments, lastHosted] = await Promise.all([
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
      prisma.tournament.findFirst({
        where: { hostUserId: session.user.id },
        orderBy: { createdAt: "desc" },
        select: {
          buyInCents: true,
          startingChips: true,
          maxPlayers: true,
          blindPace: true,
          blindPreset: true,
          blindLevelMinutes: true,
          payoutPercents: true,
        },
      }),
    ]);

    const lastHostedDefaults = lastHosted
      ? {
          ...lastHosted,
          payoutPercents: lastHosted.payoutPercents as number[],
        }
      : null;

    return NextResponse.json({ user, stats, tournaments, lastHostedDefaults });
  } catch (err) {
    console.error("GET /api/tournaments failed:", err);
    return NextResponse.json(
      { error: "Failed to load game nights" },
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
    blindPace = "gradual",
    blindLevelMinutes = 12,
    payoutPercents: rawPayouts,
  } = body;

  const paceResult = BlindPaceSchema.safeParse(blindPace);
  const resolvedPace = paceResult.success ? paceResult.data : "gradual";
  const resolvedMinutes = BLIND_LEVEL_MINUTE_OPTIONS.includes(blindLevelMinutes)
    ? blindLevelMinutes
    : 12;
  const blindLevels = buildBlindLevels(startingChips, resolvedPace);

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
        blindPreset: resolvedPace,
        blindPace: resolvedPace,
        blindLevelMinutes: resolvedMinutes,
        blindLevels,
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
      { error: "Failed to create game night" },
      { status: 500 }
    );
  }
}
