import { prisma, utcDay, utcDayKey, utcMonth, utcMonthKey } from "@poker/db";

export type UsagePoint = { key: string; label: string; count: number };

export type UsageRangeId = "7d" | "14d" | "30d" | "this_month" | "12m";

export type UsageGranularity = "day" | "month";

export type UsageRangeMeta = {
  id: UsageRangeId;
  label: string;
  granularity: UsageGranularity;
};

export const USAGE_RANGE_OPTIONS: UsageRangeMeta[] = [
  { id: "7d", label: "Last 7 days", granularity: "day" },
  { id: "14d", label: "Last 14 days", granularity: "day" },
  { id: "30d", label: "Last 30 days", granularity: "day" },
  { id: "this_month", label: "This month", granularity: "day" },
  { id: "12m", label: "Last 12 months", granularity: "month" },
];

export function parseUsageRangeId(value: unknown): UsageRangeId {
  if (
    value === "7d" ||
    value === "14d" ||
    value === "30d" ||
    value === "this_month" ||
    value === "12m"
  ) {
    return value;
  }
  return "14d";
}

export function usageRangeMeta(id: UsageRangeId): UsageRangeMeta {
  return USAGE_RANGE_OPTIONS.find((r) => r.id === id) ?? USAGE_RANGE_OPTIONS[1]!;
}

export type SiteUsage = {
  range: UsageRangeMeta;
  totals: {
    users: number;
    gameNights: number;
    tournaments: number;
    hands: number;
  };
  period: {
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
  series: {
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

/** UTC days from the 1st of the month through today (inclusive). */
export function daysThisUtcMonth(end: Date = new Date()): Date[] {
  const endDay = utcDay(end);
  const start = utcMonth(end);
  const days: Date[] = [];
  for (let d = new Date(start); d <= endDay; d.setUTCDate(d.getUTCDate() + 1)) {
    days.push(new Date(d));
  }
  return days;
}

export function bucketsForRange(
  rangeId: UsageRangeId,
  now: Date = new Date()
): { buckets: Date[]; granularity: UsageGranularity; rangeStart: Date } {
  switch (rangeId) {
    case "7d": {
      const buckets = lastUtcDays(7, now);
      return { buckets, granularity: "day", rangeStart: buckets[0]! };
    }
    case "14d": {
      const buckets = lastUtcDays(14, now);
      return { buckets, granularity: "day", rangeStart: buckets[0]! };
    }
    case "30d": {
      const buckets = lastUtcDays(30, now);
      return { buckets, granularity: "day", rangeStart: buckets[0]! };
    }
    case "this_month": {
      const buckets = daysThisUtcMonth(now);
      return { buckets, granularity: "day", rangeStart: buckets[0]! };
    }
    case "12m": {
      const buckets = lastUtcMonths(12, now);
      return { buckets, granularity: "month", rangeStart: buckets[0]! };
    }
  }
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

function uniqueUsersInPeriod(rows: { userId: string }[]): number {
  return new Set(rows.map((r) => r.userId)).size;
}

export async function loadSiteUsage(
  now: Date = new Date(),
  rangeId: UsageRangeId = "14d"
): Promise<SiteUsage> {
  const range = usageRangeMeta(rangeId);
  const { buckets, granularity, rangeStart } = bucketsForRange(rangeId, now);

  // Also load enough history for "this month / last month" snapshot cards.
  const monthsForSnapshots = lastUtcMonths(2, now);
  const snapshotStart = monthsForSnapshots[0]!;
  const queryStart =
    rangeStart < snapshotStart ? rangeStart : snapshotStart;

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
      where: { day: { gte: queryStart } },
      select: { userId: true, day: true },
    }),
    prisma.tournament.findMany({
      where: { createdAt: { gte: queryStart } },
      select: { createdAt: true },
    }),
    prisma.game.findMany({
      where: { startedAt: { gte: queryStart } },
      select: { startedAt: true },
    }),
    prisma.siteDayStat.findMany({
      where: { day: { gte: queryStart } },
      select: { day: true, hands: true },
    }),
  ]);

  const nightDates = nights.map((n) => n.createdAt);
  const gameDates = games.map((g) => g.startedAt);
  const handAmounts = handDays.map((h) => ({ day: h.day, amount: h.hands }));

  const periodLogins = loginRows.filter((r) => r.day >= rangeStart);
  const periodNights = nightDates.filter((d) => d >= rangeStart);
  const periodGames = gameDates.filter((d) => d >= rangeStart);
  const periodHands = handAmounts.filter((h) => h.day >= rangeStart);

  const seriesUsers =
    granularity === "day"
      ? uniqueUsersByDay(periodLogins, buckets)
      : uniqueUsersByMonth(periodLogins, buckets);
  const seriesNights =
    granularity === "day"
      ? countByDayKey(periodNights, buckets)
      : countByMonthKey(periodNights, buckets);
  const seriesTournaments =
    granularity === "day"
      ? countByDayKey(periodGames, buckets)
      : countByMonthKey(periodGames, buckets);
  const seriesHands =
    granularity === "day"
      ? sumByDayKey(periodHands, buckets)
      : sumByMonthKey(periodHands, buckets);

  const monthlyUsers = uniqueUsersByMonth(loginRows, monthsForSnapshots);
  const monthlyNights = countByMonthKey(nightDates, monthsForSnapshots);
  const monthlyTournaments = countByMonthKey(gameDates, monthsForSnapshots);
  const monthlyHands = sumByMonthKey(handAmounts, monthsForSnapshots);

  const dailyUsersForSnapshots = uniqueUsersByDay(
    loginRows,
    lastUtcDays(2, now)
  );

  return {
    range,
    totals: {
      users: userCount,
      gameNights: nightCount,
      tournaments: tournamentCount,
      hands: handAgg._sum.handsPlayed ?? 0,
    },
    period: {
      users: uniqueUsersInPeriod(periodLogins),
      gameNights: periodNights.length,
      tournaments: periodGames.length,
      hands: periodHands.reduce((sum, h) => sum + h.amount, 0),
    },
    usersToday: pointCount(dailyUsersForSnapshots, utcDayKey(today)),
    usersYesterday: pointCount(dailyUsersForSnapshots, utcDayKey(yesterday)),
    usersThisMonth: pointCount(monthlyUsers, utcMonthKey(thisMonth)),
    usersLastMonth: pointCount(monthlyUsers, utcMonthKey(lastMonth)),
    gameNightsThisMonth: pointCount(monthlyNights, utcMonthKey(thisMonth)),
    tournamentsThisMonth: pointCount(
      monthlyTournaments,
      utcMonthKey(thisMonth)
    ),
    handsThisMonth: pointCount(monthlyHands, utcMonthKey(thisMonth)),
    series: {
      users: seriesUsers,
      gameNights: seriesNights,
      tournaments: seriesTournaments,
      hands: seriesHands,
    },
  };
}
