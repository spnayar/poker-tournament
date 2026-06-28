import { describe, it, expect } from "vitest";
import { computeNightLedger, normalizeGamePayouts } from "./index";

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
