import { describe, it, expect } from "vitest";
import {
  bucketsForRange,
  countByDayKey,
  countByMonthKey,
  daysThisUtcMonth,
  lastUtcDays,
  lastUtcMonths,
  parseUsageRangeId,
  uniqueUsersByDay,
  uniqueUsersByMonth,
} from "./adminUsage";

describe("usage buckets", () => {
  it("fills 14 UTC days including today", () => {
    const end = new Date("2026-10-08T15:00:00.000Z");
    const days = lastUtcDays(14, end);
    expect(days).toHaveLength(14);
    expect(days[0]!.toISOString().slice(0, 10)).toBe("2026-09-25");
    expect(days[13]!.toISOString().slice(0, 10)).toBe("2026-10-08");
  });

  it("fills 12 UTC months", () => {
    const end = new Date("2026-10-08T15:00:00.000Z");
    const months = lastUtcMonths(12, end);
    expect(months[0]!.toISOString().slice(0, 7)).toBe("2025-11");
    expect(months[11]!.toISOString().slice(0, 7)).toBe("2026-10");
  });

  it("fills this UTC month through today", () => {
    const end = new Date("2026-10-08T15:00:00.000Z");
    const days = daysThisUtcMonth(end);
    expect(days[0]!.toISOString().slice(0, 10)).toBe("2026-10-01");
    expect(days[days.length - 1]!.toISOString().slice(0, 10)).toBe(
      "2026-10-08"
    );
    expect(days).toHaveLength(8);
  });

  it("resolves range presets to day or month buckets", () => {
    const end = new Date("2026-10-08T15:00:00.000Z");
    expect(bucketsForRange("7d", end).buckets).toHaveLength(7);
    expect(bucketsForRange("30d", end).buckets).toHaveLength(30);
    expect(bucketsForRange("this_month", end).granularity).toBe("day");
    expect(bucketsForRange("12m", end).granularity).toBe("month");
    expect(bucketsForRange("12m", end).buckets).toHaveLength(12);
  });

  it("parses range ids with a 14d default", () => {
    expect(parseUsageRangeId("7d")).toBe("7d");
    expect(parseUsageRangeId("this_month")).toBe("this_month");
    expect(parseUsageRangeId("nope")).toBe("14d");
    expect(parseUsageRangeId(null)).toBe("14d");
  });

  it("counts events by day and month", () => {
    const days = lastUtcDays(3, new Date("2026-10-08T12:00:00.000Z"));
    const counts = countByDayKey(
      [
        new Date("2026-10-08T01:00:00.000Z"),
        new Date("2026-10-08T23:00:00.000Z"),
        new Date("2026-10-07T00:00:00.000Z"),
      ],
      days
    );
    expect(counts.map((c) => c.count)).toEqual([0, 1, 2]);

    const months = lastUtcMonths(2, new Date("2026-10-08T12:00:00.000Z"));
    const monthly = countByMonthKey(
      [new Date("2026-09-30T12:00:00.000Z"), new Date("2026-10-01T12:00:00.000Z")],
      months
    );
    expect(monthly.map((c) => c.count)).toEqual([1, 1]);
  });

  it("counts unique users per day and month from login rows", () => {
    const days = lastUtcDays(2, new Date("2026-10-08T12:00:00.000Z"));
    const rows = [
      { userId: "a", day: new Date("2026-10-08T00:00:00.000Z") },
      { userId: "a", day: new Date("2026-10-08T00:00:00.000Z") },
      { userId: "b", day: new Date("2026-10-08T00:00:00.000Z") },
      { userId: "a", day: new Date("2026-10-07T00:00:00.000Z") },
    ];
    expect(uniqueUsersByDay(rows, days).map((p) => p.count)).toEqual([1, 2]);

    const months = lastUtcMonths(2, new Date("2026-10-08T12:00:00.000Z"));
    expect(
      uniqueUsersByMonth(
        [
          { userId: "a", day: new Date("2026-09-01T00:00:00.000Z") },
          { userId: "a", day: new Date("2026-10-01T00:00:00.000Z") },
          { userId: "b", day: new Date("2026-10-08T00:00:00.000Z") },
        ],
        months
      ).map((p) => p.count)
    ).toEqual([1, 2]);
  });
});
