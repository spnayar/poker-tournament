import { describe, it, expect } from "vitest";
import { buildSidePots } from "./sidePots";

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
    });
    expect(pots[1]).toEqual({
      amount: 1400,
      eligibleSeatIds: [0, 2],
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

  it("tie on main pot scenario has correct amounts", () => {
    const pots = buildSidePots([
      { seatId: 0, contribution: 200, folded: false },
      { seatId: 1, contribution: 100, folded: false },
      { seatId: 2, contribution: 200, folded: false },
    ]);

    expect(pots[0]!.amount).toBe(300);
    expect(pots[1]!.amount).toBe(200);
  });
});
