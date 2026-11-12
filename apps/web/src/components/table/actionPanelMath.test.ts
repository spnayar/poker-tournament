import { describe, expect, it } from "vitest";
import type { LegalActions } from "@poker/protocol";
import {
  getBetContext,
  nudgeWagerAmount,
  potWagerTarget,
  resolveBigBlind,
  snapWagerAmount,
  wagerChipStep,
  wagerTargetForMultiplier,
} from "./actionPanelMath";

function legal(partial: Partial<LegalActions>): LegalActions {
  return {
    canFold: true,
    canCheck: false,
    canCall: false,
    callAmount: 0,
    canBet: false,
    minBet: 0,
    canRaise: false,
    minRaise: 0,
    minRaiseTo: 0,
    maxRaise: 0,
    canAllIn: true,
    allInAmount: 0,
    ...partial,
  };
}

describe("getBetContext", () => {
  it("derives betThisRound from maxRaise - allInAmount", () => {
    const ctx = getBetContext(
      legal({
        canCall: true,
        callAmount: 50,
        maxRaise: 5000,
        allInAmount: 4950,
      })
    );
    expect(ctx.betThisRound).toBe(50);
    expect(ctx.currentBet).toBe(100);
  });
});

describe("wagerChipStep", () => {
  it("stays on BB multiples — never stack/40 odd steps like 463", () => {
    // Live bug shape: blinds 50/100, deep stack ~18.5k → old step was ~463
    const step = wagerChipStep(100, 100, 18620);
    expect(step).toBe(200);
    expect(step % 100).toBe(0);
  });

  it("uses 1BB when the legal range is shallow", () => {
    expect(wagerChipStep(100, 100, 500)).toBe(100);
  });
});

describe("nudgeWagerAmount", () => {
  it("steps +/− by one big blind", () => {
    const bb = 100;
    const min = 100;
    const max = 18620;
    expect(nudgeWagerAmount(min, 1, min, max, bb)).toBe(200);
    expect(nudgeWagerAmount(200, 1, min, max, bb)).toBe(300);
    expect(nudgeWagerAmount(300, -1, min, max, bb)).toBe(200);
    expect(nudgeWagerAmount(200, -1, min, max, bb)).toBe(100);
  });

  it("jumps off odd amounts onto the next BB multiple", () => {
    const bb = 100;
    const min = 100;
    const max = 18620;
    // Live bug leftover: 463 → clean 500 / 400, never +463
    expect(nudgeWagerAmount(463, 1, min, max, bb)).toBe(500);
    expect(nudgeWagerAmount(463, -1, min, max, bb)).toBe(400);
  });

  it("clamps at min and max", () => {
    expect(nudgeWagerAmount(100, -1, 100, 5000, 100)).toBe(100);
    expect(nudgeWagerAmount(5000, 1, 100, 5000, 100)).toBe(5000);
  });
});

describe("snapWagerAmount", () => {
  it("snaps slider values onto the BB denomination grid", () => {
    // Deep range uses 2BB slider steps → 463 snaps to 400
    expect(snapWagerAmount(463, 100, 18620, 100)).toBe(400);
  });
});

describe("resolveBigBlind", () => {
  it("prefers explicit bigBlind over legal fallbacks", () => {
    expect(
      resolveBigBlind(
        legal({ canBet: true, minBet: 50, minRaise: 50 }),
        100
      )
    ).toBe(100);
  });
});

describe("wagerTargetForMultiplier", () => {
  it("sizes opening bets from currentBet * multiplier", () => {
    const amount = wagerTargetForMultiplier(
      legal({
        canBet: true,
        minBet: 100,
        allInAmount: 5000,
        maxRaise: 5000,
        canCall: false,
      }),
      2
    );
    // currentBet falls back to minBet when canBet
    expect(amount).toBe(200);
  });

  it("sizes raises as raise-to currentBet * multiplier", () => {
    const amount = wagerTargetForMultiplier(
      legal({
        canRaise: true,
        canCall: true,
        callAmount: 100,
        minRaiseTo: 200,
        maxRaise: 5000,
        allInAmount: 4900,
        minRaise: 100,
      }),
      3
    );
    // betThisRound=100, currentBet=200 → 600
    expect(amount).toBe(600);
  });
});

describe("potWagerTarget", () => {
  it("bets the pot when opening", () => {
    const amount = potWagerTarget(
      legal({
        canBet: true,
        minBet: 50,
        allInAmount: 5000,
        maxRaise: 5000,
      }),
      150
    );
    expect(amount).toBe(150);
  });

  it("computes pot-sized raise-to", () => {
    const amount = potWagerTarget(
      legal({
        canRaise: true,
        canCall: true,
        callAmount: 100,
        minRaiseTo: 200,
        maxRaise: 5000,
        allInAmount: 4900,
        minRaise: 100,
      }),
      300
    );
    // currentBet=200, pot=300, call=100 → 600
    expect(amount).toBe(600);
  });
});
