import { describe, expect, it } from "vitest";
import {
  chipProportionalPayouts,
  parseLedgerAmountToCents,
  rankChopFinish,
  validateChopShares,
} from "./chop";

describe("chipProportionalPayouts", () => {
  it("splits the pool by chip count and gives leftover cents to the bigger stack", () => {
    const payouts = chipProportionalPayouts(
      [
        { userId: "a", chipCount: 100 },
        { userId: "b", chipCount: 300 },
      ],
      4000
    );
    expect(payouts).toEqual([
      { userId: "a", payoutCents: 1000 },
      { userId: "b", payoutCents: 3000 },
    ]);
  });

  it("hands a one-cent remainder to the tied player with the earlier id", () => {
    const payouts = chipProportionalPayouts(
      [
        { userId: "b", chipCount: 10 },
        { userId: "a", chipCount: 10 },
        { userId: "c", chipCount: 10 },
      ],
      100
    );
    const byId = Object.fromEntries(
      payouts.map((row) => [row.userId, row.payoutCents])
    );
    expect(byId).toEqual({ a: 34, b: 33, c: 33 });
    expect(payouts.reduce((sum, row) => sum + row.payoutCents, 0)).toBe(100);
  });
});

describe("validateChopShares", () => {
  const remaining = ["a", "b"];

  it("accepts a split that matches the buy-in pool", () => {
    expect(
      validateChopShares({
        prizePoolCents: 2000,
        remainingUserIds: remaining,
        shares: [
          { userId: "a", payoutCents: 1500 },
          { userId: "b", payoutCents: 500 },
        ],
      })
    ).toEqual({ ok: true });
  });

  it("rejects a split that does not add up to the buy-in pool", () => {
    expect(
      validateChopShares({
        prizePoolCents: 2000,
        remainingUserIds: remaining,
        shares: [
          { userId: "a", payoutCents: 1500 },
          { userId: "b", payoutCents: 400 },
        ],
      }).ok
    ).toBe(false);
  });

  it("rejects a player who is already out", () => {
    const result = validateChopShares({
      prizePoolCents: 2000,
      remainingUserIds: remaining,
      shares: [
        { userId: "a", payoutCents: 2000 },
        { userId: "out", payoutCents: 0 },
      ],
    });
    expect(result.ok).toBe(false);
  });
});

describe("rankChopFinish", () => {
  it("places the higher agreed payout first and busted players after", () => {
    expect(
      rankChopFinish({
        remaining: [
          { userId: "short", chipCount: 500, payoutCents: 400 },
          { userId: "big", chipCount: 100, payoutCents: 1600 },
        ],
        eliminated: [
          { userId: "first-out", bustIndex: 0 },
          { userId: "later-out", bustIndex: 1 },
        ],
      })
    ).toEqual([
      { userId: "big", position: 1, payoutCents: 1600 },
      { userId: "short", position: 2, payoutCents: 400 },
      { userId: "later-out", position: 3, payoutCents: 0 },
      { userId: "first-out", position: 4, payoutCents: 0 },
    ]);
  });
});

describe("parseLedgerAmountToCents", () => {
  it("reads dollars and cents", () => {
    expect(parseLedgerAmountToCents("12.50")).toBe(1250);
    expect(parseLedgerAmountToCents("$0")).toBe(0);
    expect(parseLedgerAmountToCents("1.2")).toBe(120);
    expect(parseLedgerAmountToCents("1.234")).toBeNull();
    expect(parseLedgerAmountToCents("")).toBeNull();
  });
});
