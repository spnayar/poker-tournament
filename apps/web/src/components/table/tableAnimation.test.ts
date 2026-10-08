import { describe, expect, it } from "vitest";
import {
  FLOP_CARD_STAGGER_SEC,
  getBoardRevealSchedule,
  getBoardRevealTotalMs,
  RUNOUT_CARD_STAGGER_SEC,
  RUNOUT_FLOP_CARD_STAGGER_SEC,
  RUNOUT_FLOP_PAUSE_SEC,
  STREET_CARD_STAGGER_SEC,
} from "./tableAnimation";

describe("getBoardRevealSchedule", () => {
  it("staggers a normal flop quickly", () => {
    const schedule = getBoardRevealSchedule(0, ["As", "Kd", "7c"]);
    expect(schedule).toEqual([
      { slot: 0, delayMs: 0 },
      { slot: 1, delayMs: Math.round(FLOP_CARD_STAGGER_SEC * 1000) },
      { slot: 2, delayMs: Math.round(FLOP_CARD_STAGGER_SEC * 2000) },
    ]);
    expect(getBoardRevealTotalMs(0, ["As", "Kd", "7c"])).toBeLessThan(2000);
  });

  it("staggers turn quickly and river with a short delay", () => {
    const turn = getBoardRevealSchedule(3, ["As", "Kd", "7c", "2h"]);
    expect(turn).toEqual([{ slot: 3, delayMs: 0 }]);
    expect(getBoardRevealTotalMs(3, ["As", "Kd", "7c", "2h"])).toBeLessThan(
      1000
    );

    const river = getBoardRevealSchedule(4, ["As", "Kd", "7c", "2h", "9s"]);
    expect(river[0]?.delayMs).toBeLessThan(1200);
    expect(STREET_CARD_STAGGER_SEC).toBeLessThan(0.6);
  });

  it("keeps all-in runout under ~6s before the last flip", () => {
    const schedule = getBoardRevealSchedule(0, [
      "As",
      "Kd",
      "7c",
      "2h",
      "9s",
    ]);
    const last = schedule[schedule.length - 1]!;
    const expectedLast =
      Math.round(
        (RUNOUT_FLOP_CARD_STAGGER_SEC * 3 +
          RUNOUT_FLOP_PAUSE_SEC +
          RUNOUT_CARD_STAGGER_SEC) *
          1000
      );
    expect(last.delayMs).toBe(expectedLast);
    expect(last.delayMs).toBeLessThan(6000);
    expect(getBoardRevealTotalMs(0, ["As", "Kd", "7c", "2h", "9s"])).toBeLessThan(
      7000
    );
  });
});
