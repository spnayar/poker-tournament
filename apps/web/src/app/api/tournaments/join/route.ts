import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@poker/db";
import {
  decideJoinNight,
  normalizeJoinCode,
  publicJoinPreview,
} from "@/lib/joinNight";

async function loadJoinTournament(joinCode: string) {
  return prisma.tournament.findUnique({
    where: { inviteCode: joinCode },
    include: {
      host: { select: { displayName: true } },
      players: { select: { userId: true } },
    },
  });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const joinCode = normalizeJoinCode(url.searchParams.get("code"));
  if (!joinCode) {
    return NextResponse.json(
      { error: "Join code must be 4 characters" },
      { status: 400 }
    );
  }

  const tournament = await loadJoinTournament(joinCode);
  if (!tournament) {
    return NextResponse.json({ error: "Invalid join code" }, { status: 404 });
  }

  return NextResponse.json(
    publicJoinPreview({
      name: tournament.name,
      hostDisplayName: tournament.host.displayName,
      buyInCents: tournament.buyInCents,
      status: tournament.status,
      joinCode: tournament.inviteCode,
      playerCount: tournament.players.length,
      maxPlayers: tournament.maxPlayers,
    })
  );
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const joinCode = normalizeJoinCode(body.joinCode as string);

  if (!joinCode) {
    return NextResponse.json(
      { error: "Join code must be 4 characters" },
      { status: 400 }
    );
  }

  const tournament = await loadJoinTournament(joinCode);

  if (!tournament) {
    return NextResponse.json({ error: "Invalid join code" }, { status: 404 });
  }

  const runningGame = await prisma.game.findFirst({
    where: { tournamentId: tournament.id, status: "RUNNING" },
  });

  const alreadyJoined = tournament.players.some(
    (p) => p.userId === session.user!.id
  );

  const decision = decideJoinNight({
    status: tournament.status,
    hasRunningGame: Boolean(runningGame),
    alreadyJoined,
    isFull: tournament.players.length >= tournament.maxPlayers,
  });

  if (!decision.ok) {
    return NextResponse.json(
      { error: decision.error },
      { status: decision.status }
    );
  }

  if (!alreadyJoined) {
    await prisma.tournamentPlayer.create({
      data: {
        tournamentId: tournament.id,
        userId: session.user.id,
      },
    });
  }

  return NextResponse.json({
    ok: true,
    tournamentId: tournament.id,
    alreadyJoined,
    destination: decision.destination,
  });
}
