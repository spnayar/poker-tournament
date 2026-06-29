import { describe, it, expect } from "vitest";
import {
  buildBlindLevels,
  getBlindLevelAt,
  resolveBlindLevels,
  roundBlindAmount,
} from "./blinds";

describe("blind structure", () => {
  it("scales level 1 blinds to ~1% of starting stack", () => {
    const levels = buildBlindLevels(5000, "gradual");
    expect(levels[0]).toEqual({ level: 1, sb: 25, bb: 50 });
  });

  it("scales for different starting chips", () => {
    const levels = buildBlindLevels(10000, "gradual");
    expect(levels[0]!.bb).toBe(100);
    expect(levels[0]!.sb).toBe(50);
  });

  it("turbo increases faster than gradual", () => {
    const gradual = buildBlindLevels(5000, "gradual");
    const turbo = buildBlindLevels(5000, "turbo");
    expect(turbo[3]!.bb).toBeGreaterThan(gradual[3]!.bb);
  });

  it("resolveBlindLevels falls back from legacy preset", () => {
    const levels = resolveBlindLevels(5000, { blindPreset: "turbo" });
    expect(levels[0]!.bb).toBe(50);
    expect(levels.length).toBeGreaterThan(5);
  });

  it("getBlindLevelAt clamps to last level", () => {
    const levels = buildBlindLevels(5000, "hyper");
    const last = levels[levels.length - 1]!;
    expect(getBlindLevelAt(levels, 99)).toEqual(last);
  });

  it("roundBlindAmount uses sensible steps", () => {
    expect(roundBlindAmount(47)).toBe(45);
    expect(roundBlindAmount(8)).toBe(8);
  });
});
