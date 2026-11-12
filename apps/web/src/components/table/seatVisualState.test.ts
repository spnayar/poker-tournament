import { describe, expect, it } from "vitest";
import { seatVisualKind, showSeatHoleCards } from "./seatVisualState";

describe("seatVisualKind", () => {
  it("orders out > folded > away > live", () => {
    expect(
      seatVisualKind({
        folded: true,
        skipped: true,
        away: true,
        eliminated: true,
      })
    ).toBe("out");
    expect(
      seatVisualKind({ folded: true, skipped: true, away: true })
    ).toBe("folded");
    expect(
      seatVisualKind({ folded: false, skipped: true, away: false })
    ).toBe("away");
    expect(
      seatVisualKind({ folded: false, skipped: false, away: false })
    ).toBe("live");
  });
});

describe("showSeatHoleCards", () => {
  it("hides hole-card backs for folded or eliminated seats", () => {
    expect(showSeatHoleCards({ folded: true })).toBe(false);
    expect(showSeatHoleCards({ folded: false, eliminated: true })).toBe(
      false
    );
    expect(showSeatHoleCards({ folded: false })).toBe(true);
  });
});
