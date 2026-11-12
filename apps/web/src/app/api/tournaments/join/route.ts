import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@poker/db";
import {
  decideJoinNight,
  joinCodeFormatError,
  normalizeJoinCode,
  publicJoinPreview,
} from "@/lib/joinNight";
import { gameServerControlHeaders } from "@/lib/gameServerControl";
import { joinCodeLimiter } from "@/lib/rateLimit";
import { requestIp } from "@/lib/requestIp";

async function fetchPreDealJoinOpen(tournamentId: string): Promise<boolean> {
  const control = gameServerControlHeaders();
  if (!control.ok) return false;
  const gameServerUrl =
    process.env.GAME_SERVER_URL ?? "http://localhost:3001";
  try {
    const res = await fetch(
      `${gameServerUrl}/tournaments/${tournamentId}/join-window`,
      { headers: control.headers, cache: "no-store" }
    );
    if (!res.ok) return false;
    const data = (await res.json().catch(() => null)) as {
      canJoin?: unknown;
    } | null;
    return data?.canJoin === true;
  } catch {
    return false;
  }
}

async function limitJoinAttempt(req: Request): Promise<NextResponse | null> {
  const limit = await joinCodeLimiter.consume(requestIp(req));
  if (limit.allowed) return null;
  return NextResponse.json(
    { error: "Too many join attempts. Try again later." },
    {
      status: 429,
      headers: { "Retry-After": String(limit.retryAfterSec) },
    }
  );
}

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
  const limited = await limitJoinAttempt(req);
  if (limited) return limited;

  const url = new URL(req.url);
  const joinCode = normalizeJoinCode(url.searchParams.get("code"));
  if (!joinCode) {
    return NextResponse.json(
      { error: joinCodeFormatError() },
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
  const limited = await limitJoinAttempt(req);
  if (limited) return limited;

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const joinCode = normalizeJoinCode(body.joinCode as string);

  if (!joinCode) {
    return NextResponse.json(
      { error: joinCodeFormatError() },
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

  const preDealJoinOpen =
    Boolean(runningGame) && !alreadyJoined
      ? await fetchPreDealJoinOpen(tournament.id)
      : false;

  const decision = decideJoinNight({
    status: tournament.status,
    hasRunningGame: Boolean(runningGame),
    alreadyJoined,
    isFull: tournament.players.length >= tournament.maxPlayers,
    preDealJoinOpen,
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
