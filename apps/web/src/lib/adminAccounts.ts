import { prisma, recomputeUserStats } from "@poker/db";
import {
  canDeleteAccount,
  isLegacyPasswordEraCandidate,
  LEGACY_PURGE_CONFIRM_PHRASE,
} from "./adminAccess";

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

export type LegacyPurgeCandidate = {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
};

export type LegacyPurgePreview = {
  confirmPhrase: typeof LEGACY_PURGE_CONFIRM_PHRASE;
  count: number;
  candidates: LegacyPurgeCandidate[];
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

/** Dry-run list of password-era accounts eligible for purge (admins excluded). */
export async function listLegacyPasswordEraCandidates(): Promise<LegacyPurgePreview> {
  const users = await prisma.user.findMany({
    where: {
      passwordHash: { not: null },
      lastLoginAt: null,
      loginCount: 0,
      role: { not: "ADMIN" },
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      email: true,
      displayName: true,
      createdAt: true,
      role: true,
      passwordHash: true,
      lastLoginAt: true,
      loginCount: true,
    },
  });

  const candidates = users
    .filter((user) => isLegacyPasswordEraCandidate(user))
    .map((user) => ({
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      createdAt: user.createdAt.toISOString(),
    }));

  return {
    confirmPhrase: LEGACY_PURGE_CONFIRM_PHRASE,
    count: candidates.length,
    candidates,
  };
}

/**
 * Deletes every legacy password-era candidate with the same cascade as a
 * single admin Remove (hosted night teardown, roster/results, no hole cards).
 */
export async function purgeLegacyPasswordEraAccounts(opts: {
  actorId: string;
  confirm: string;
}): Promise<
  | { ok: true; deleted: number; emails: string[] }
  | { ok: false; reason: string; status: number }
> {
  if (opts.confirm.trim() !== LEGACY_PURGE_CONFIRM_PHRASE) {
    return {
      ok: false,
      reason: `Type ${LEGACY_PURGE_CONFIRM_PHRASE} to confirm`,
      status: 400,
    };
  }

  const preview = await listLegacyPasswordEraCandidates();
  const emails: string[] = [];

  for (const candidate of preview.candidates) {
    if (candidate.id === opts.actorId) continue;
    const result = await deletePlayerAccount({
      actorId: opts.actorId,
      targetId: candidate.id,
    });
    if (result.ok) {
      emails.push(candidate.email);
    }
  }

  return { ok: true, deleted: emails.length, emails };
}
