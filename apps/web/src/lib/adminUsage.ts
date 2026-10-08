import { prisma, utcDay, utcDayKey, utcMonth, utcMonthKey } from "@poker/db";

export type UsagePoint = { key: string; label: string; count: number };

export type SiteUsage = {
  totals: {
    users: number;
    gameNights: number;
    tournaments: number;
    hands: number;
  };
  usersToday: number;
  usersThisMonth: number;
  usersYesterday: number;
  usersLastMonth: number;
  gameNightsThisMonth: number;
  tournamentsThisMonth: number;
  handsThisMonth: number;
  daily: {
    users: UsagePoint[];
    gameNights: UsagePoint[];
    tournaments: UsagePoint[];
    hands: UsagePoint[];
  };
  monthly: {
    users: UsagePoint[];
    gameNights: UsagePoint[];
    tournaments: UsagePoint[];
    hands: UsagePoint[];
  };
};

const DAY_LABEL: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
};
const MONTH_LABEL: Intl.DateTimeFormatOptions = {
  month: "short",
  year: "numeric",
  timeZone: "UTC",
};

export function lastUtcDays(n: number, end: Date = new Date()): Date[] {
  const endDay = utcDay(end);
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(endDay);
    d.setUTCDate(d.getUTCDate() - (n - 1 - i));
    return d;
  });
}

export function lastUtcMonths(n: number, end: Date = new Date()): Date[] {
  const endMonth = utcMonth(end);
  return Array.from({ length: n }, (_, i) => {
    return new Date(
      Date.UTC(
        endMonth.getUTCFullYear(),
        endMonth.getUTCMonth() - (n - 1 - i),
        1
      )
    );
  });
}

export function formatDayLabel(d: Date): string {
  return d.toLocaleDateString("en-US", DAY_LABEL);
}

export function formatMonthLabel(d: Date): string {
  return d.toLocaleDateString("en-US", MONTH_LABEL);
}

export function countByDayKey(
  dates: Date[],
  buckets: Date[]
): UsagePoint[] {
  const map = new Map<string, number>();
  for (const d of dates) {
    const key = utcDayKey(d);
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return buckets.map((d) => ({
    key: utcDayKey(d),
    label: formatDayLabel(d),
    count: map.get(utcDayKey(d)) ?? 0,
  }));
}

export function countByMonthKey(
  dates: Date[],
  buckets: Date[]
): UsagePoint[] {
  const map = new Map<string, number>();
  for (const d of dates) {
    const key = utcMonthKey(d);
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return buckets.map((d) => ({
    key: utcMonthKey(d),
    label: formatMonthLabel(d),
    count: map.get(utcMonthKey(d)) ?? 0,
  }));
}

export function uniqueUsersByDay(
  rows: { userId: string; day: Date }[],
  buckets: Date[]
): UsagePoint[] {
  const sets = new Map<string, Set<string>>();
  for (const row of rows) {
    const key = utcDayKey(row.day);
    let set = sets.get(key);
    if (!set) {
      set = new Set();
      sets.set(key, set);
    }
    set.add(row.userId);
  }
  return buckets.map((d) => {
    const key = utcDayKey(d);
    return {
      key,
      label: formatDayLabel(d),
      count: sets.get(key)?.size ?? 0,
    };
  });
}

export function uniqueUsersByMonth(
  rows: { userId: string; day: Date }[],
  buckets: Date[]
): UsagePoint[] {
  const sets = new Map<string, Set<string>>();
  for (const row of rows) {
    const key = utcMonthKey(row.day);
    let set = sets.get(key);
    if (!set) {
      set = new Set();
      sets.set(key, set);
    }
    set.add(row.userId);
  }
  return buckets.map((d) => {
    const key = utcMonthKey(d);
    return {
      key,
      label: formatMonthLabel(d),
      count: sets.get(key)?.size ?? 0,
    };
  });
}

export function sumByDayKey(
  rows: { day: Date; amount: number }[],
  buckets: Date[]
): UsagePoint[] {
  const map = new Map<string, number>();
  for (const row of rows) {
    const key = utcDayKey(row.day);
    map.set(key, (map.get(key) ?? 0) + row.amount);
  }
  return buckets.map((d) => ({
    key: utcDayKey(d),
    label: formatDayLabel(d),
    count: map.get(utcDayKey(d)) ?? 0,
  }));
}

export function sumByMonthKey(
  rows: { day: Date; amount: number }[],
  buckets: Date[]
): UsagePoint[] {
  const map = new Map<string, number>();
  for (const row of rows) {
    const key = utcMonthKey(row.day);
    map.set(key, (map.get(key) ?? 0) + row.amount);
  }
  return buckets.map((d) => ({
    key: utcMonthKey(d),
    label: formatMonthLabel(d),
    count: map.get(utcMonthKey(d)) ?? 0,
  }));
}

function pointCount(points: UsagePoint[], key: string): number {
  return points.find((p) => p.key === key)?.count ?? 0;
}

export async function loadSiteUsage(now: Date = new Date()): Promise<SiteUsage> {
  const days = lastUtcDays(14, now);
  const months = lastUtcMonths(12, now);
  const dayStart = days[0]!;
  const monthStart = months[0]!;
  const today = utcDay(now);
  const yesterday = new Date(today);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const thisMonth = utcMonth(now);
  const lastMonth = new Date(
    Date.UTC(thisMonth.getUTCFullYear(), thisMonth.getUTCMonth() - 1, 1)
  );

  const [
    userCount,
    nightCount,
    tournamentCount,
    handAgg,
    loginRows,
    nights,
    games,
    handDays,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.tournament.count(),
    prisma.game.count(),
    prisma.game.aggregate({ _sum: { handsPlayed: true } }),
    prisma.userLoginDay.findMany({
      where: { day: { gte: monthStart } },
      select: { userId: true, day: true },
    }),
    prisma.tournament.findMany({
      where: { createdAt: { gte: monthStart } },
      select: { createdAt: true },
    }),
    prisma.game.findMany({
      where: { startedAt: { gte: monthStart } },
      select: { startedAt: true },
    }),
    prisma.siteDayStat.findMany({
      where: { day: { gte: monthStart } },
      select: { day: true, hands: true },
    }),
  ]);

  const nightDates = nights.map((n) => n.createdAt);
  const gameDates = games.map((g) => g.startedAt);
  const handAmounts = handDays.map((h) => ({ day: h.day, amount: h.hands }));

  const dailyUsers = uniqueUsersByDay(loginRows, days);
  const monthlyUsers = uniqueUsersByMonth(loginRows, months);
  const dailyNights = countByDayKey(
    nightDates.filter((d) => d >= dayStart),
    days
  );
  const monthlyNights = countByMonthKey(nightDates, months);
  const dailyTournaments = countByDayKey(
    gameDates.filter((d) => d >= dayStart),
    days
  );
  const monthlyTournaments = countByMonthKey(gameDates, months);
  const dailyHands = sumByDayKey(
    handAmounts.filter((h) => h.day >= dayStart),
    days
  );
  const monthlyHands = sumByMonthKey(handAmounts, months);

  return {
    totals: {
      users: userCount,
      gameNights: nightCount,
      tournaments: tournamentCount,
      hands: handAgg._sum.handsPlayed ?? 0,
    },
    usersToday: pointCount(dailyUsers, utcDayKey(today)),
    usersYesterday: pointCount(dailyUsers, utcDayKey(yesterday)),
    usersThisMonth: pointCount(monthlyUsers, utcMonthKey(thisMonth)),
    usersLastMonth: pointCount(monthlyUsers, utcMonthKey(lastMonth)),
    gameNightsThisMonth: pointCount(monthlyNights, utcMonthKey(thisMonth)),
    tournamentsThisMonth: pointCount(
      monthlyTournaments,
      utcMonthKey(thisMonth)
    ),
    handsThisMonth: pointCount(monthlyHands, utcMonthKey(thisMonth)),
    daily: {
      users: dailyUsers,
      gameNights: dailyNights,
      tournaments: dailyTournaments,
      hands: dailyHands,
    },
    monthly: {
      users: monthlyUsers,
      gameNights: monthlyNights,
      tournaments: monthlyTournaments,
      hands: monthlyHands,
    },
  };
}
