import { describe, expect, it } from "vitest";
import { buildBlindLevels } from "@poker/protocol";
import { BlindTimer } from "./blindTimer";

const levels = buildBlindLevels(5000, "turbo");

describe("BlindTimer", () => {
  it("schedules the next level when the timer expires", () => {
    const timer = new BlindTimer(levels, 60_000);
    timer.startLevelTimer();
    const endsAt = timer.toSnapshot().levelEndsAt!;
    expect(timer.tick(endsAt + 1)).toBe(true);
    expect(timer.getIncreasePending()).toBe(true);
    expect(timer.getPendingLevelIndex()).toBe(1);
  });

  it("lets the host jump to a later structure level", () => {
    const timer = new BlindTimer(levels, 60_000);
    timer.startLevelTimer();
    expect(timer.forceToLevel(3)).toBe(true);
    expect(timer.getPendingLevelIndex()).toBe(3);
    const state = timer.getPublicState(25, 50, 0);
    expect(state.pendingSb).toBe(levels[3]!.sb);
    expect(state.pendingBb).toBe(levels[3]!.bb);
    expect((state.advanceOptions ?? []).map((l) => l.level)).toEqual(
      levels.slice(1).map((l) => l.level)
    );
  });

  it("rejects same-or-lower targets and double schedules", () => {
    const timer = new BlindTimer(levels, 60_000);
    expect(timer.forceToLevel(0)).toBe(false);
    expect(timer.forceNextLevel()).toBe(true);
    expect(timer.forceToLevel(2)).toBe(false);
  });
});
