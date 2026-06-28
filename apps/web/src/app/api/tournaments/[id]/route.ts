import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@poker/db";
import { computePayoutsFromPercents, computeNightLedger, normalizeGamePayouts } from "@poker/protocol";
import { defaultTournamentName } from "@/lib/tournament";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tournament = await prisma.tournament.findUnique({
    where: { id },
    include: {
      host: { select: { id: true, displayName: true, avatarUrl: true } },
      players: {
        include: {
          user: { select: { id: true, displayName: true, avatarUrl: true } },
        },
      },
      games: {
        orderBy: { gameNumber: "desc" },
        include: {
          results: {
            include: {
              user: { select: { id: true, displayName: true, avatarUrl: true } },
            },
            orderBy: { finishPosition: "asc" },
          },
        },
      },
    },
  });

  if (!tournament) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const isMember = tournament.players.some(
    (p) => p.userId === session.user!.id
  );
  const isHost = tournament.hostUserId === session.user!.id;

  if (!isMember && !isHost) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const runningGame = tournament.games.find((g) => g.status === "RUNNING") ?? null;
  const payoutPercents = tournament.payoutPercents as number[];
  const playerCount = tournament.players.length;

  const payouts =
    tournament.status === "LOBBY"
      ? computePayoutsFromPercents(
          tournament.buyInCents * playerCount,
          payoutPercents,
          playerCount
        )
      : null;

  const roster = tournament.players.map((p) => ({
    userId: p.userId,
    displayName: p.user.displayName,
  }));
  const rosterUserIds = roster.map((p) => p.userId);

  const ledger = computeNightLedger(
    tournament.buyInCents,
    roster,
    tournament.games
      .filter((g) => g.status === "FINISHED")
      .map((g) =>
        normalizeGamePayouts(
          g.prizePoolCents,
          g.results.map((r) => ({
            userId: r.userId,
            finishPosition: r.finishPosition,
            payoutCents: r.payoutCents,
          })),
          rosterUserIds
        )
      )
  );

  return NextResponse.json({
    tournament,
    runningGame,
    payouts,
    ledger,
    payoutPercents,
  });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tournament = await prisma.tournament.findUnique({
    where: { id },
    include: { players: true, games: { where: { status: "RUNNING" } } },
  });

  if (!tournament) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const { action } = body;

  if (action === "join") {
    return NextResponse.json(
      { error: "Use POST /api/tournaments/join with a join code" },
      { status: 400 }
    );
  }

  if (action === "start") {
    if (tournament.hostUserId !== session.user.id) {
      return NextResponse.json({ error: "Only host can start" }, { status: 403 });
    }
    if (tournament.status === "FINISHED") {
      return NextResponse.json({ error: "Tournament is closed" }, { status: 400 });
    }
    if (tournament.players.length < 2) {
      return NextResponse.json(
        { error: "Need at least 2 players" },
        { status: 400 }
      );
    }
    if (tournament.games.some((g) => g.status === "RUNNING")) {
      return NextResponse.json({ error: "A game is already running" }, { status: 400 });
    }

    const lastGame = await prisma.game.findFirst({
      where: { tournamentId: id },
      orderBy: { gameNumber: "desc" },
    });
    const gameNumber = (lastGame?.gameNumber ?? 0) + 1;

    const game = await prisma.game.create({
      data: {
        tournamentId: id,
        gameNumber,
        status: "RUNNING",
      },
    });

    await prisma.tournament.update({
      where: { id },
      data: { status: "RUNNING" },
    });

    const gameServerUrl =
      process.env.GAME_SERVER_URL ?? "http://localhost:3001";
    try {
      const beginRes = await fetch(`${gameServerUrl}/tournaments/${id}/begin`, {
        method: "POST",
      });
      if (!beginRes.ok) {
        await prisma.game.delete({ where: { id: game.id } });
        if (gameNumber === 1) {
          await prisma.tournament.update({
            where: { id },
            data: { status: "LOBBY" },
          });
        }
        console.error("Game server failed to begin game:", await beginRes.text());
        return NextResponse.json(
          { error: "Could not start game on server" },
          { status: 500 }
        );
      }
    } catch (err) {
      await prisma.game.delete({ where: { id: game.id } });
      if (gameNumber === 1) {
        await prisma.tournament.update({
          where: { id },
          data: { status: "LOBBY" },
        });
      }
      console.error("Could not reach game server:", err);
      return NextResponse.json(
        { error: "Game server unreachable" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, gameId: game.id, gameNumber });
  }

  if (action === "close") {
    if (tournament.hostUserId !== session.user.id) {
      return NextResponse.json({ error: "Only host can close" }, { status: 403 });
    }
    if (tournament.games.some((g) => g.status === "RUNNING")) {
      return NextResponse.json(
        { error: "Finish the current game before closing" },
        { status: 400 }
      );
    }

    await prisma.tournament.update({
      where: { id },
      data: { status: "FINISHED", closedAt: new Date() },
    });

    return NextResponse.json({ ok: true, status: "FINISHED" });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tournament = await prisma.tournament.findUnique({ where: { id } });
  if (!tournament) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (tournament.hostUserId !== session.user.id) {
    return NextResponse.json({ error: "Only the host can delete" }, { status: 403 });
  }

  const gameServerUrl = process.env.GAME_SERVER_URL ?? "http://localhost:3001";
  try {
    await fetch(`${gameServerUrl}/tournaments/${id}`, { method: "DELETE" });
  } catch (err) {
    console.error("Could not reach game server to teardown tournament:", err);
  }

  await prisma.tournament.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
