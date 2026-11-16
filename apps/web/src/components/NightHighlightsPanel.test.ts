import { describe, expect, it } from "vitest";
import { hasNightHighlights } from "./NightHighlightsPanel";
import type { NightRecapStats } from "@/lib/nightRecap";

function emptyStats(over: Partial<NightRecapStats> = {}): NightRecapStats {
  return {
    tournamentCount: 0,
    totalHands: 0,
    winners: [],
    itm: [],
    handsWon: [],
    knockouts: [],
    flopsSeen: [],
    largestPot: null,
    bestHand: null,
    ...over,
  };
}

describe("hasNightHighlights", () => {
  it("is false for null/empty", () => {
    expect(hasNightHighlights(null)).toBe(false);
    expect(hasNightHighlights(undefined)).toBe(false);
    expect(hasNightHighlights(emptyStats())).toBe(false);
  });

  it("is true when hands were dealt or fun facts exist", () => {
    expect(hasNightHighlights(emptyStats({ totalHands: 8 }))).toBe(true);
    expect(
      hasNightHighlights(
        emptyStats({
          handsWon: [{ displayName: "Phone", count: 4 }],
        })
      )
    ).toBe(true);
    expect(
      hasNightHighlights(
        emptyStats({
          flopsSeen: [
            { displayName: "Bot", percent: 100, seen: 8, dealt: 8 },
          ],
        })
      )
    ).toBe(true);
  });
});
