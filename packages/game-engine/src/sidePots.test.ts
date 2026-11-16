import { describe, it, expect } from "vitest";
import {
  buildSidePots,
  coalesceEligiblePots,
  hasRealSidePotStructure,
  liveTablePots,
  splitLivePots,
  totalPotAmount,
  uncalledReturnsFromPots,
} from "./sidePots";

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
    expect(uncalledReturnsFromPots(pots)).toEqual([
      { seatId: 2, amount: 4950 },
    ]);
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

  it("coalesces fold-created contribution levels into one pot", () => {
    // Shorter folded stack is not an all-in side pot — same eligibles merge.
    const pots = buildSidePots([
      { seatId: 0, contribution: 1000, folded: false },
      { seatId: 1, contribution: 1000, folded: false },
      { seatId: 2, contribution: 200, folded: true },
    ]);
    expect(pots).toHaveLength(1);
    expect(pots[0]).toEqual({
      amount: 2200,
      eligibleSeatIds: [0, 1],
      contributorCount: 3,
    });
  });

  it("keeps real side pots when all-in changes eligibility", () => {
    const pots = buildSidePots([
      { seatId: 0, contribution: 1200, folded: false },
      { seatId: 1, contribution: 500, folded: false },
      { seatId: 2, contribution: 1200, folded: false },
      { seatId: 3, contribution: 300, folded: true },
    ]);
    // Folded 300 merges into the main layer with [0,1,2]; short all-in still sides.
    expect(pots).toEqual([
      { amount: 1800, eligibleSeatIds: [0, 1, 2], contributorCount: 4 },
      { amount: 1400, eligibleSeatIds: [0, 2], contributorCount: 2 },
    ]);
  });
});

describe("coalesceEligiblePots", () => {
  it("merges adjacent same-eligible layers", () => {
    const merged = coalesceEligiblePots([
      { amount: 600, eligibleSeatIds: [0, 1], contributorCount: 3 },
      { amount: 1600, eligibleSeatIds: [0, 1], contributorCount: 2 },
      { amount: 400, eligibleSeatIds: [0], contributorCount: 1 },
    ]);
    expect(merged).toEqual([
      { amount: 2200, eligibleSeatIds: [0, 1], contributorCount: 3 },
      { amount: 400, eligibleSeatIds: [0], contributorCount: 1 },
    ]);
  });
});

describe("liveTablePots (F5 / Nov 16 QA)", () => {
  it("does not invent Main/Side/Uncalled for unequal blinds with nobody all-in", () => {
    const players = [
      { seatId: 0, contribution: 25, folded: false, allIn: false },
      { seatId: 1, contribution: 50, folded: false, allIn: false },
    ];
    expect(hasRealSidePotStructure(players)).toBe(false);
    const live = liveTablePots(players);
    expect(live.pots).toHaveLength(1);
    expect(live.pots[0]!.amount).toBe(75);
    expect(live.uncalledAmount).toBe(0);
    expect(live.totalPot).toBe(75);
  });

  it("collapses mid-betting Main/Side chrome when nobody is all-in", () => {
    // Hand 1 style: Pot 125 with contribution levels 25/50/50 — not a side pot.
    const players = [
      { seatId: 0, contribution: 25, folded: false, allIn: false },
      { seatId: 1, contribution: 50, folded: false, allIn: false },
      { seatId: 2, contribution: 50, folded: false, allIn: false },
    ];
    const live = liveTablePots(players);
    expect(live.pots).toEqual([
      {
        amount: 125,
        eligibleSeatIds: [0, 1, 2],
        contributorCount: 3,
      },
    ]);
    expect(live.uncalledAmount).toBe(0);
  });

  it("Hand 5: covered all-in shows one pot, not Main 300 / Uncalled 4825", () => {
    // Host 75, Bot 75, Phone 75, Big all-in 4900 — nobody continued past Big.
    const afterShove = [
      { seatId: 0, contribution: 75, folded: false, allIn: false },
      { seatId: 1, contribution: 75, folded: false, allIn: false },
      { seatId: 2, contribution: 75, folded: false, allIn: false },
      { seatId: 3, contribution: 4900, folded: false, allIn: true },
    ];
    expect(hasRealSidePotStructure(afterShove)).toBe(false);
    const shoveLive = liveTablePots(afterShove);
    expect(shoveLive.pots).toHaveLength(1);
    expect(shoveLive.pots[0]!.amount).toBe(5125);
    expect(shoveLive.uncalledAmount).toBe(0);
    expect(shoveLive.totalPot).toBe(5125);

    // After Bot calls to 4900, Phone still to act — still no real side pot.
    const afterCall = [
      { seatId: 0, contribution: 75, folded: true, allIn: false },
      { seatId: 1, contribution: 4900, folded: false, allIn: false },
      { seatId: 2, contribution: 75, folded: false, allIn: false },
      { seatId: 3, contribution: 4900, folded: false, allIn: true },
    ];
    expect(hasRealSidePotStructure(afterCall)).toBe(false);
    const callLive = liveTablePots(afterCall);
    expect(callLive.pots).toHaveLength(1);
    expect(callLive.pots[0]!.amount).toBe(9950);
    expect(callLive.uncalledAmount).toBe(0);

    // Everyone matched the covered all-in → single main 14775.
    const allMatched = [
      { seatId: 0, contribution: 75, folded: true, allIn: false },
      { seatId: 1, contribution: 4900, folded: false, allIn: false },
      { seatId: 2, contribution: 4900, folded: false, allIn: false },
      { seatId: 3, contribution: 4900, folded: false, allIn: true },
    ];
    const matchedLive = liveTablePots(allMatched);
    expect(matchedLive.pots).toHaveLength(1);
    expect(matchedLive.pots[0]!.amount).toBe(14775);
    expect(matchedLive.uncalledAmount).toBe(0);
    // Settlement layers also coalesce to one contested pot.
    expect(buildSidePots(allMatched)).toEqual([
      {
        amount: 14775,
        eligibleSeatIds: [1, 2, 3],
        contributorCount: 4,
      },
    ]);
  });

  it("Hand 6: short all-in with callers continuing keeps Main + Side 1", () => {
    // Bot all-in 50, Phone 100, Host 100 → Main 150 · Side 1 100.
    const players = [
      { seatId: 0, contribution: 100, folded: false, allIn: false },
      { seatId: 1, contribution: 50, folded: false, allIn: true },
      { seatId: 2, contribution: 100, folded: false, allIn: false },
    ];
    expect(hasRealSidePotStructure(players)).toBe(true);
    const live = liveTablePots(players);
    expect(live.pots).toEqual([
      { amount: 150, eligibleSeatIds: [0, 1, 2], contributorCount: 3 },
      { amount: 100, eligibleSeatIds: [0, 2], contributorCount: 2 },
    ]);
    expect(live.uncalledAmount).toBe(0);
    expect(live.totalPot).toBe(250);
  });

  it("still labels uncalled when a raise continues past a short all-in", () => {
    const players = [
      { seatId: 0, contribution: 500, folded: false, allIn: true },
      { seatId: 1, contribution: 1200, folded: false, allIn: false },
      { seatId: 2, contribution: 500, folded: false, allIn: false },
    ];
    expect(hasRealSidePotStructure(players)).toBe(true);
    const live = liveTablePots(players);
    expect(live.pots).toEqual([
      { amount: 1500, eligibleSeatIds: [0, 1, 2], contributorCount: 3 },
    ]);
    expect(live.uncalledAmount).toBe(700);
    expect(live.totalPot).toBe(2200);
  });
});
