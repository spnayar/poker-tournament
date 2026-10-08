import { describe, expect, it } from "vitest";
import {
  bottomSeatVisualIndex,
  getSeatPositionForViewer,
  getVisualSeatIndex,
  heroBottomY,
  seatAnchorTransform,
  seatAnchorTransformForViewer,
} from "./tableLayout";

describe("tableLayout", () => {
  it("maps the viewer onto the bottom visual slot", () => {
    expect(bottomSeatVisualIndex(2)).toBe(1);
    expect(bottomSeatVisualIndex(7)).toBe(4);
    expect(getVisualSeatIndex(0, 7, 0)).toBe(4);
  });

  it("pins the viewer to true 6 o'clock with room for hole cards", () => {
    const hero = getSeatPositionForViewer(0, 7, 0, false);
    expect(hero.isViewer).toBe(true);
    expect(hero.x).toBe(50);
    expect(hero.y).toBe(heroBottomY(false));
    expect(hero.y).toBeGreaterThanOrEqual(90);
    expect(seatAnchorTransformForViewer(hero.visualIndex, 7, true)).toBe(
      "translate(-50%, -100%)"
    );
  });

  it("keeps all non-hero seats above the hero pin line", () => {
    for (const total of [2, 6, 7]) {
      const seats = Array.from({ length: total }, (_, i) =>
        getSeatPositionForViewer(i, total, 0, false)
      );
      const heroY = heroBottomY(false);
      for (const s of seats.filter((p) => !p.isViewer)) {
        expect(s.y).toBeLessThanOrEqual(heroY - 8);
      }
      const keys = new Set(
        seats.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
      );
      expect(keys.size).toBe(total);
    }
  });

  it("anchors top seats downward", () => {
    expect(seatAnchorTransform(0, 7)).toContain("-18%");
  });

  it("spreads seven seats on desktop and compact without stacking", () => {
    for (const compact of [false, true]) {
      const positions = Array.from({ length: 7 }, (_, i) =>
        getSeatPositionForViewer(i, 7, 0, compact)
      );
      expect(positions.filter((p) => p.isViewer)).toHaveLength(1);
      const xs = positions.filter((p) => !p.isViewer).map((p) => p.x);
      expect(Math.min(...xs)).toBeLessThan(45);
      expect(Math.max(...xs)).toBeGreaterThan(55);
    }
  });
});
