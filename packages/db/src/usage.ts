import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "./client";
import { utcDay } from "./dates";

type DbClient = PrismaClient | Prisma.TransactionClient;

/** Record a successful magic-link sign-in: last login, lifetime count, UTC day bucket. */
export async function recordUserLogin(
  userId: string,
  at: Date = new Date(),
  db: DbClient = prisma
): Promise<void> {
  const day = utcDay(at);
  await db.user.update({
    where: { id: userId },
    data: {
      lastLoginAt: at,
      loginCount: { increment: 1 },
    },
  });
  await db.userLoginDay.upsert({
    where: { userId_day: { userId, day } },
    create: { userId, day, count: 1 },
    update: { count: { increment: 1 } },
  });
}

/** Count a dealt hand. Stores a number only — never cards. */
export async function incrementHandsPlayed(
  gameId: string,
  at: Date = new Date(),
  db: DbClient = prisma
): Promise<void> {
  const day = utcDay(at);
  await db.game.update({
    where: { id: gameId },
    data: { handsPlayed: { increment: 1 } },
  });
  await db.siteDayStat.upsert({
    where: { day },
    create: { day, hands: 1 },
    update: { hands: { increment: 1 } },
  });
}
