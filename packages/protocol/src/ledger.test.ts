import { describe, it, expect } from "vitest";
import {
  computeNightLedger,
  computeSettleTransfers,
  normalizeGamePayouts,
  parseSettleUpMethods,
} from "./index";

describe("computeNightLedger", () => {
  it("includes all roster players even with zero payout", () => {
    const ledger = computeNightLedger(
      2000,
      [
        { userId: "alice", displayName: "Alice" },
        { userId: "bob", displayName: "Bob" },
      ],
      [[{ userId: "alice", payoutCents: 3800 }]]
    );

    expect(ledger).toHaveLength(2);
    const bob = ledger.find((r) => r.userId === "bob");
    expect(bob?.totalBuyInCents).toBe(2000);
    expect(bob?.totalPayoutCents).toBe(0);
    expect(bob?.netCents).toBe(-2000);

    const alice = ledger.find((r) => r.userId === "alice");
    expect(alice?.netCents).toBe(1800);
  });
});

describe("normalizeGamePayouts", () => {
  it("distributes undistributed pool remainder to non-winners", () => {
    const payouts = normalizeGamePayouts(
      4000,
      [
        { userId: "alice", finishPosition: 1, payoutCents: 3800 },
        { userId: "bob", finishPosition: 2, payoutCents: 0 },
      ],
      ["alice", "bob"]
    );

    const bob = payouts.find((r) => r.userId === "bob");
    expect(bob?.payoutCents).toBe(200);

    const ledger = computeNightLedger(
      2000,
      [
        { userId: "alice", displayName: "Alice" },
        { userId: "bob", displayName: "Bob" },
      ],
      [payouts]
    );

    expect(ledger.find((r) => r.userId === "alice")?.netCents).toBe(1800);
    expect(ledger.find((r) => r.userId === "bob")?.netCents).toBe(-1800);
  });
});

describe("computeSettleTransfers", () => {
  it("pairs debtors to creditors from net ledger", () => {
    const ledger = computeNightLedger(
      1000,
      [
        { userId: "alice", displayName: "Alice" },
        { userId: "bob", displayName: "Bob" },
        { userId: "carol", displayName: "Carol" },
      ],
      [[{ userId: "alice", payoutCents: 3000 }]]
    );
    const transfers = computeSettleTransfers(ledger);
    expect(transfers).toEqual([
      {
        fromUserId: "bob",
        fromDisplayName: "Bob",
        toUserId: "alice",
        toDisplayName: "Alice",
        amountCents: 1000,
      },
      {
        fromUserId: "carol",
        fromDisplayName: "Carol",
        toUserId: "alice",
        toDisplayName: "Alice",
        amountCents: 1000,
      },
    ]);
  });

  it("returns empty when nets are flat", () => {
    expect(
      computeSettleTransfers([
        {
          userId: "a",
          displayName: "A",
          gamesPlayed: 1,
          totalBuyInCents: 1000,
          totalPayoutCents: 1000,
          netCents: 0,
        },
      ])
    ).toEqual([]);
  });
});

describe("parseSettleUpMethods", () => {
  it("accepts valid methods and rejects junk", () => {
    expect(
      parseSettleUpMethods([
        { provider: "VENMO", contact: "@alice" },
        { provider: "ZELLE", contact: "555-0100" },
      ])
    ).toHaveLength(2);
    expect(parseSettleUpMethods([{ provider: "VENMO" }])).toEqual([]);
    expect(parseSettleUpMethods(null)).toEqual([]);
  });
});
