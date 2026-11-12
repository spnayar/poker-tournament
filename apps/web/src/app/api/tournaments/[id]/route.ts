import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma, recomputeUserStats } from "@poker/db";
import {
  computePayoutsFromPercents,
  computeNightLedger,
  computeSettleTransfers,
  normalizeGamePayouts,
  parseSettleUpMethods,
} from "@poker/protocol";
import { sendNightRecapEmail } from "@/lib/nightRecap";
import { gameServerControlHeaders } from "@/lib/gameServerControl";

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
          user: {
            select: {
              id: true,
              displayName: true,
              avatarUrl: true,
              settleUpMethods: true,
            },
          },
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

  const settleTransfers = computeSettleTransfers(ledger);
  const settleUpByUserId: Record<
    string,
    ReturnType<typeof parseSettleUpMethods>
  > = {};
  for (const p of tournament.players) {
    settleUpByUserId[p.userId] = parseSettleUpMethods(p.user.settleUpMethods);
  }

  const tournamentJson = {
    ...tournament,
    players: tournament.players.map((p) => ({
      ...p,
      user: {
        id: p.user.id,
        displayName: p.user.displayName,
        avatarUrl: p.user.avatarUrl,
        settleUpMethods: settleUpByUserId[p.userId] ?? [],
      },
    })),
  };

  return NextResponse.json({
    tournament: tournamentJson,
    runningGame,
    payouts,
    ledger,
    settleTransfers,
    settleUpByUserId,
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

  if (action === "open" || action === "start") {
    if (tournament.hostUserId !== session.user.id) {
      return NextResponse.json({ error: "Only host can start" }, { status: 403 });
    }
    if (tournament.status === "FINISHED") {
      return NextResponse.json({ error: "Game night is closed" }, { status: 400 });
    }

    const running = tournament.games.find((g) => g.status === "RUNNING");
    const randomizeSeats = action === "start";

    if (randomizeSeats && tournament.players.length < 2 && !running) {
      return NextResponse.json(
        { error: "Need at least 2 players to randomize seats" },
        { status: 400 }
      );
    }
    if (!randomizeSeats && tournament.players.length < 1) {
      return NextResponse.json(
        { error: "Need at least one player" },
        { status: 400 }
      );
    }

    const control = gameServerControlHeaders();
    if (!control.ok) {
      return NextResponse.json({ error: control.error }, { status: 500 });
    }

    const gameServerUrl =
      process.env.GAME_SERVER_URL ?? "http://localhost:3001";

    // Table already open: host Start only randomizes seats + dealer (no deal).
    if (running) {
      if (!randomizeSeats) {
        return NextResponse.json({
          ok: true,
          gameId: running.id,
          gameNumber: running.gameNumber,
          alreadyOpen: true,
        });
      }
      if (tournament.players.length < 2) {
        return NextResponse.json(
          { error: "Need at least 2 players to randomize seats" },
          { status: 400 }
        );
      }
      try {
        const readyRes = await fetch(
          `${gameServerUrl}/tournaments/${id}/ready`,
          { method: "POST", headers: control.headers }
        );
        if (!readyRes.ok) {
          const text = await readyRes.text();
          console.error("Game server failed to ready seating:", text);
          return NextResponse.json(
            { error: "Could not randomize seats on server" },
            { status: 500 }
          );
        }
      } catch (err) {
        console.error("Could not reach game server:", err);
        return NextResponse.json(
          { error: "Game server unreachable" },
          { status: 500 }
        );
      }
      return NextResponse.json({
        ok: true,
        gameId: running.id,
        gameNumber: running.gameNumber,
        seatingReady: true,
      });
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

    try {
      // open = sit (even alone). start = open + randomize when 2+.
      const path = randomizeSeats ? "begin" : "open";
      const beginRes = await fetch(`${gameServerUrl}/tournaments/${id}/${path}`, {
        method: "POST",
        headers: control.headers,
      });
      if (!beginRes.ok) {
        await prisma.game.delete({ where: { id: game.id } });
        if (gameNumber === 1) {
          await prisma.tournament.update({
            where: { id },
            data: { status: "LOBBY" },
          });
        }
        console.error("Game server failed to open/start:", await beginRes.text());
        return NextResponse.json(
          { error: "Could not start tournament on server" },
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

    return NextResponse.json({
      ok: true,
      gameId: game.id,
      gameNumber,
      seatingReady: randomizeSeats && tournament.players.length >= 2,
    });
  }

  if (action === "close") {
    if (tournament.hostUserId !== session.user.id) {
      return NextResponse.json({ error: "Only host can close" }, { status: 403 });
    }
    if (tournament.games.some((g) => g.status === "RUNNING")) {
      return NextResponse.json(
        { error: "Finish the current tournament before closing" },
        { status: 400 }
      );
    }

    await prisma.tournament.update({
      where: { id },
      data: { status: "FINISHED", closedAt: new Date() },
    });

    // End-of-night recap: settlement-first email to participants + host.
    let recap: Awaited<ReturnType<typeof sendNightRecapEmail>> = null;
    try {
      recap = await sendNightRecapEmail(id);
    } catch (err) {
      console.error("[night-recap] Failed to send after close", err);
    }

    return NextResponse.json({
      ok: true,
      status: "FINISHED",
      recap: recap
        ? {
            recipients: recap.recipients,
            results: recap.results,
            previewHtml: recap.previewHtml,
          }
        : null,
    });
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

  const control = gameServerControlHeaders();
  if (!control.ok) {
    return NextResponse.json({ error: control.error }, { status: 500 });
  }

  const gameServerUrl = process.env.GAME_SERVER_URL ?? "http://localhost:3001";
  try {
    await fetch(`${gameServerUrl}/tournaments/${id}`, {
      method: "DELETE",
      headers: control.headers,
    });
  } catch (err) {
    console.error("Could not reach game server to teardown tournament:", err);
  }

  const affectedUsers = await prisma.gameResult.findMany({
    where: { game: { tournamentId: id } },
    select: { userId: true },
    distinct: ["userId"],
  });
  const userIds = affectedUsers.map((u) => u.userId);

  await prisma.$transaction(async (tx) => {
    await tx.tournament.delete({ where: { id } });
    for (const userId of userIds) {
      await recomputeUserStats(userId, tx);
    }
  });

  return NextResponse.json({ ok: true });
}
