import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@poker/db";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const joinCode = (body.joinCode as string)?.trim().toUpperCase();

  if (!joinCode || joinCode.length !== 4) {
    return NextResponse.json(
      { error: "Join code must be 4 characters" },
      { status: 400 }
    );
  }

  const tournament = await prisma.tournament.findUnique({
    where: { inviteCode: joinCode },
    include: { players: true },
  });

  if (!tournament) {
    return NextResponse.json({ error: "Invalid join code" }, { status: 404 });
  }

  if (tournament.status === "FINISHED") {
    return NextResponse.json(
      { error: "This game night has ended" },
      { status: 400 }
    );
  }

  const runningGame = await prisma.game.findFirst({
    where: { tournamentId: tournament.id, status: "RUNNING" },
  });
  if (runningGame) {
    return NextResponse.json(
      { error: "A tournament is in progress — join between tournaments" },
      { status: 400 }
    );
  }

  if (tournament.players.length >= tournament.maxPlayers) {
    return NextResponse.json({ error: "Game night is full" }, { status: 400 });
  }

  const alreadyJoined = tournament.players.some(
    (p) => p.userId === session.user!.id
  );

  if (alreadyJoined) {
    return NextResponse.json({
      ok: true,
      tournamentId: tournament.id,
      alreadyJoined: true,
    });
  }

  await prisma.tournamentPlayer.create({
    data: {
      tournamentId: tournament.id,
      userId: session.user.id,
    },
  });

  return NextResponse.json({
    ok: true,
    tournamentId: tournament.id,
    alreadyJoined: false,
  });
}
