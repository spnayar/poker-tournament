import { describe, expect, it } from "vitest";
import type { LegalActions } from "@poker/protocol";
import {
  getBetContext,
  potWagerTarget,
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
