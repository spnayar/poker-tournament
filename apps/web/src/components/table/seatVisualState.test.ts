import { describe, expect, it } from "vitest";
import {
  opponentHolePresentation,
  seatVisualKind,
  showSeatHoleCards,
} from "./seatVisualState";

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

describe("opponentHolePresentation", () => {
  it("tucks face-down backs mid-hand so the avatar stays the seat face (F3)", () => {
    expect(
      opponentHolePresentation({
        folded: false,
        revealHoleCards: false,
        showCards: false,
      })
    ).toBe("tucked-backs");
  });

  it("fans revealed cards only at showdown", () => {
    expect(
      opponentHolePresentation({
        folded: false,
        revealHoleCards: true,
        showCards: true,
      })
    ).toBe("fan-reveal");
  });

  it("hides cards for folded or eliminated seats", () => {
    expect(
      opponentHolePresentation({
        folded: true,
        revealHoleCards: false,
        showCards: false,
      })
    ).toBe("hidden");
    expect(
      opponentHolePresentation({
        folded: false,
        eliminated: true,
        revealHoleCards: true,
        showCards: true,
      })
    ).toBe("hidden");
  });
});
