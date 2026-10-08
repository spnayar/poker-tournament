import { NextResponse } from "next/server";
import { formatSessionHistoryName } from "@/lib/labels";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@poker/db";
import { isAllowedAvatarUrl } from "@/lib/avatars";
import {
  parseSettleUpMethods,
  parseSettleUpMethodsInput,
} from "@/lib/settleUp";

const profileUserSelect = {
  displayName: true,
  displayNameSet: true,
  email: true,
  avatarUrl: true,
  createdAt: true,
  settleUpMethods: true,
} as const;

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const stats = await prisma.userStats.findUnique({
    where: { userId: session.user.id },
  });

  const row = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: profileUserSelect,
  });

  const user = row
    ? {
        displayName: row.displayName,
        displayNameSet: row.displayNameSet,
        email: row.email,
        avatarUrl: row.avatarUrl,
        createdAt: row.createdAt,
        settleUpMethods: parseSettleUpMethods(row.settleUpMethods),
      }
    : null;

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
  const { avatarUrl, displayName, settleUpMethods } = body;

  const data: {
    avatarUrl?: string;
    displayName?: string;
    displayNameSet?: boolean;
    settleUpMethods?: ReturnType<typeof parseSettleUpMethods>;
  } = {};

  if (displayName !== undefined) {
    if (typeof displayName !== "string") {
      return NextResponse.json({ error: "Invalid display name" }, { status: 400 });
    }
    const trimmed = displayName.trim();
    if (trimmed.length < 2 || trimmed.length > 32) {
      return NextResponse.json(
        { error: "Display name must be 2–32 characters" },
        { status: 400 }
      );
    }
    data.displayName = trimmed;
    data.displayNameSet = true;
  }

  if (avatarUrl !== undefined) {
    if (typeof avatarUrl !== "string" || !avatarUrl) {
      return NextResponse.json({ error: "avatarUrl is required" }, { status: 400 });
    }
    if (!isAllowedAvatarUrl(avatarUrl)) {
      return NextResponse.json({ error: "Invalid avatar" }, { status: 400 });
    }
    data.avatarUrl = avatarUrl;
  }

  if (settleUpMethods !== undefined) {
    const parsed = parseSettleUpMethodsInput(settleUpMethods);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    data.settleUpMethods = parsed.methods;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json(
      { error: "No valid fields to update" },
      { status: 400 }
    );
  }

  const row = await prisma.user.update({
    where: { id: session.user.id },
    data,
    select: profileUserSelect,
  });

  const user = {
    displayName: row.displayName,
    displayNameSet: row.displayNameSet,
    email: row.email,
    avatarUrl: row.avatarUrl,
    createdAt: row.createdAt,
    settleUpMethods: parseSettleUpMethods(row.settleUpMethods),
  };

  return NextResponse.json({ user });
}
