import { prisma, recomputeUserStats } from "@poker/db";
import { canDeleteAccount } from "./adminAccess";

export type AdminAccountRow = {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
  lastLoginAt: string | null;
  loginCount: number;
  role: "PLAYER" | "ADMIN";
  accountStatus: "FREE" | "PAID";
  gameNights: number;
  tournamentsPlayed: number;
  totalBuyInCents: number;
  totalPayoutCents: number;
  canDelete: boolean;
};

export async function listAdminAccounts(
  actorId: string
): Promise<AdminAccountRow[]> {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      displayName: true,
      createdAt: true,
      lastLoginAt: true,
      loginCount: true,
      role: true,
      accountStatus: true,
      stats: {
        select: {
          tournamentsPlayed: true,
          totalBuyInCents: true,
          totalPayoutCents: true,
        },
      },
      _count: { select: { tournamentPlayers: true } },
    },
  });

  return users.map((user) => ({
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    createdAt: user.createdAt.toISOString(),
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    loginCount: user.loginCount,
    role: user.role,
    accountStatus: user.accountStatus,
    gameNights: user._count.tournamentPlayers,
    tournamentsPlayed: user.stats?.tournamentsPlayed ?? 0,
    totalBuyInCents: user.stats?.totalBuyInCents ?? 0,
    totalPayoutCents: user.stats?.totalPayoutCents ?? 0,
    canDelete: canDeleteAccount({
      actorId,
      target: user,
    }).ok,
  }));
}

export async function deletePlayerAccount(opts: {
  actorId: string;
  targetId: string;
}): Promise<{ ok: true } | { ok: false; reason: string; status: number }> {
  const target = await prisma.user.findUnique({
    where: { id: opts.targetId },
    select: { id: true, email: true, role: true },
  });
  if (!target) {
    return { ok: false, reason: "Not found", status: 404 };
  }

  const allowed = canDeleteAccount({ actorId: opts.actorId, target });
  if (!allowed.ok) {
    return { ok: false, reason: allowed.reason, status: 400 };
  }

  const hosted = await prisma.tournament.findMany({
    where: { hostUserId: target.id },
    select: { id: true },
  });
  const hostedIds = hosted.map((t) => t.id);
  const gameServerUrl =
    process.env.GAME_SERVER_URL ?? "http://localhost:3001";

  for (const tournament of hosted) {
    try {
      await fetch(`${gameServerUrl}/tournaments/${tournament.id}`, {
        method: "DELETE",
      });
    } catch (err) {
      console.error("Could not teardown hosted game night before delete:", err);
    }
  }

  const affectedFromHosted =
    hostedIds.length === 0
      ? []
      : await prisma.gameResult.findMany({
          where: {
            game: { tournamentId: { in: hostedIds } },
            userId: { not: target.id },
          },
          select: { userId: true },
          distinct: ["userId"],
        });

  await prisma.$transaction(async (tx) => {
    if (hostedIds.length > 0) {
      await tx.tournament.deleteMany({ where: { id: { in: hostedIds } } });
    }
    await tx.gameResult.deleteMany({ where: { userId: target.id } });
    await tx.tournamentPlayer.deleteMany({ where: { userId: target.id } });
    await tx.user.delete({ where: { id: target.id } });
    for (const { userId } of affectedFromHosted) {
      await recomputeUserStats(userId, tx);
    }
  });

  return { ok: true };
}
