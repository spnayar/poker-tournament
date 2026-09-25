import { describe, it, expect } from "vitest";
import { buildSidePots, splitLivePots, totalPotAmount } from "./sidePots";

describe("buildSidePots", () => {
  it("creates main + side pot for short all-in", () => {
    const pots = buildSidePots([
      { seatId: 0, contribution: 1200, folded: false },
      { seatId: 1, contribution: 500, folded: false },
      { seatId: 2, contribution: 1200, folded: false },
    ]);

    expect(pots).toHaveLength(2);
    expect(pots[0]).toEqual({
      amount: 1500,
      eligibleSeatIds: [0, 1, 2],
      contributorCount: 3,
    });
    expect(pots[1]).toEqual({
      amount: 1400,
      eligibleSeatIds: [0, 2],
      contributorCount: 2,
    });
  });

  it("creates three pots for two different short all-ins", () => {
    const pots = buildSidePots([
      { seatId: 0, contribution: 1000, folded: false },
      { seatId: 1, contribution: 300, folded: false },
      { seatId: 2, contribution: 600, folded: false },
    ]);

    expect(pots).toHaveLength(3);
    expect(pots[0]!.amount).toBe(900);
    expect(pots[0]!.eligibleSeatIds).toEqual([0, 1, 2]);
    expect(pots[1]!.amount).toBe(600);
    expect(pots[1]!.eligibleSeatIds).toEqual([0, 2]);
    expect(pots[2]!.amount).toBe(400);
    expect(pots[2]!.eligibleSeatIds).toEqual([0]);
  });

  it("excludes folded players from eligibility", () => {
    const pots = buildSidePots([
      { seatId: 0, contribution: 500, folded: false },
      { seatId: 1, contribution: 500, folded: true },
      { seatId: 2, contribution: 500, folded: false },
    ]);

    expect(pots[0]!.eligibleSeatIds).toEqual([0, 2]);
  });

  it("folded caller still funds a matched pot, not uncalled", () => {
    const pots = buildSidePots([
      { seatId: 0, contribution: 200, folded: false },
      { seatId: 1, contribution: 200, folded: true },
    ]);
    const live = splitLivePots(pots);
    expect(live.uncalledAmount).toBe(0);
    expect(live.pots[0]!.amount).toBe(400);
    expect(live.pots[0]!.eligibleSeatIds).toEqual([0]);
  });

  it("tie on main pot scenario has correct amounts", () => {
    const pots = buildSidePots([
      { seatId: 0, contribution: 200, folded: false },
      { seatId: 1, contribution: 100, folded: false },
      { seatId: 2, contribution: 200, folded: false },
    ]);

    expect(pots[0]!.amount).toBe(300);
    expect(pots[1]!.amount).toBe(200);
  });

  it("QA host unmatched shove is not a Side 2 pot on the live table", () => {
    const pots = buildSidePots([
      { seatId: 0, contribution: 25, folded: false },
      { seatId: 1, contribution: 50, folded: false },
      { seatId: 2, contribution: 5000, folded: false },
    ]);
    expect(pots).toEqual([
      { amount: 75, eligibleSeatIds: [0, 1, 2], contributorCount: 3 },
      { amount: 50, eligibleSeatIds: [1, 2], contributorCount: 2 },
      { amount: 4950, eligibleSeatIds: [2], contributorCount: 1 },
    ]);
    const live = splitLivePots(pots);
    expect(live.pots).toEqual([
      { amount: 75, eligibleSeatIds: [0, 1, 2], contributorCount: 3 },
      { amount: 50, eligibleSeatIds: [1, 2], contributorCount: 2 },
    ]);
    expect(live.uncalledAmount).toBe(4950);
    expect(totalPotAmount(pots)).toBe(5075);
  });

  it("QA guest matched stacks show Main + one side pot, no uncalled", () => {
    const pots = buildSidePots([
      { seatId: 0, contribution: 50, folded: false },
      { seatId: 1, contribution: 5000, folded: false },
      { seatId: 2, contribution: 5000, folded: false },
    ]);
    expect(pots).toEqual([
      { amount: 150, eligibleSeatIds: [0, 1, 2], contributorCount: 3 },
      { amount: 9900, eligibleSeatIds: [1, 2], contributorCount: 2 },
    ]);
    const live = splitLivePots(pots);
    expect(live.pots).toEqual(pots);
    expect(live.uncalledAmount).toBe(0);
    expect(totalPotAmount(pots)).toBe(10050);
  });
});
