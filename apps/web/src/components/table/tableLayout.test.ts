import { describe, expect, it } from "vitest";
import {
  bottomSeatVisualIndex,
  getSeatPosition,
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
    expect(hero.y).toBeLessThanOrEqual(74);
    expect(seatAnchorTransformForViewer(hero.visualIndex, 7, true)).toContain(
      "-92%"
    );
  });

  it("keeps non-hero bottom-adjacent seats off the hero pin", () => {
    const seats = Array.from({ length: 7 }, (_, i) =>
      getSeatPositionForViewer(i, 7, 0, false)
    );
    const others = seats.filter((s) => !s.isViewer);
    for (const s of others) {
      const tooClose =
        Math.abs(s.x - 50) < 6 && s.y > heroBottomY(false) - 6;
      expect(tooClose).toBe(false);
    }
    const keys = new Set(others.map((p) => `${p.x.toFixed(0)},${p.y.toFixed(0)}`));
    expect(keys.size).toBe(6);
  });

  it("anchors top seats downward", () => {
    expect(seatAnchorTransform(0, 7)).toContain("-18%");
  });

  it("spreads seven seats on desktop and compact", () => {
    for (const compact of [false, true]) {
      const positions = Array.from({ length: 7 }, (_, i) =>
        getSeatPositionForViewer(i, 7, 0, compact)
      );
      expect(positions).toHaveLength(7);
      const hero = positions.find((p) => p.isViewer)!;
      expect(hero.y).toBe(heroBottomY(compact));
      // Non-hero seats stay on a reasonable ellipse band.
      for (const p of positions.filter((s) => !s.isViewer)) {
        expect(p.y).toBeGreaterThanOrEqual(14);
        expect(p.y).toBeLessThanOrEqual(82);
      }
    }
  });

  it("does not place ellipse seats below the hero pin line", () => {
    const bottomish = getSeatPosition(bottomSeatVisualIndex(2), 2, false);
    expect(bottomish.y).toBeLessThanOrEqual(82);
  });
});
