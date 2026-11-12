import { describe, expect, it } from "vitest";
import {
  bottomSeatVisualIndex,
  getSeatPositionForViewer,
  getVisualSeatIndex,
  heroBottomY,
  layoutSeatsForViewer,
  opponentArcAngles,
  seatAnchorTransform,
  seatAnchorTransformForViewer,
  seatAnchorTransformFromY,
} from "./tableLayout";

function seatsFor(total: number, compact: boolean) {
  return layoutSeatsForViewer(total, 0, compact);
}

function pairwiseMinDistance(
  points: { x: number; y: number }[]
): number {
  let min = Infinity;
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const dx = points[i]!.x - points[j]!.x;
      const dy = points[i]!.y - points[j]!.y;
      min = Math.min(min, Math.hypot(dx, dy));
    }
  }
  return min;
}

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

  it("sweeps the opponent arc through the top, never through 6 o'clock", () => {
    for (const compact of [false, true]) {
      for (const others of [1, 2, 3, 5, 6]) {
        for (const angle of opponentArcAngles(others, compact)) {
          // 6 o'clock is π/2; keep a wide gap so neighbors cannot stack on hero.
          const dist = Math.abs(
            Math.atan2(
              Math.sin(angle - Math.PI / 2),
              Math.cos(angle - Math.PI / 2)
            )
          );
          expect(dist).toBeGreaterThan(0.5);
        }
      }
    }
  });

  it("keeps all non-hero seats above the hero pin line", () => {
    for (const total of [2, 3, 4, 6, 7]) {
      for (const compact of [false, true]) {
        const seats = seatsFor(total, compact);
        const heroY = heroBottomY(compact);
        for (const s of seats.filter((p) => !p.isViewer)) {
          expect(s.y).toBeLessThanOrEqual(heroY - 18);
        }
        const keys = new Set(
          seats.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
        );
        expect(keys.size).toBe(total);
      }
    }
  });

  it("uses left and right flanks for 3–4 seats (live-night overlap regression)", () => {
    for (const compact of [false, true]) {
      const four = seatsFor(4, compact).filter((p) => !p.isViewer);
      const xs = four.map((p) => p.x);
      expect(Math.min(...xs)).toBeLessThan(25);
      expect(Math.max(...xs)).toBeGreaterThan(75);
      // Nobody sits on the hero x at the bottom.
      expect(four.every((p) => p.y < heroBottomY(compact) - 20)).toBe(true);

      const three = seatsFor(3, compact).filter((p) => !p.isViewer);
      expect(Math.min(...three.map((p) => p.x))).toBeLessThan(25);
      expect(Math.max(...three.map((p) => p.x))).toBeGreaterThan(75);
    }
  });

  it("puts the lone opponent at top for heads-up", () => {
    for (const compact of [false, true]) {
      const opp = seatsFor(2, compact).find((p) => !p.isViewer)!;
      expect(opp.x).toBeCloseTo(50, 0);
      expect(opp.y).toBeLessThan(30);
    }
  });

  it("spreads seats without stacking on desktop and compact", () => {
    for (const total of [2, 3, 4, 6, 7]) {
      for (const compact of [false, true]) {
        const positions = seatsFor(total, compact);
        expect(positions.filter((p) => p.isViewer)).toHaveLength(1);
        expect(pairwiseMinDistance(positions)).toBeGreaterThan(
          compact ? (total >= 6 ? 20 : 22) : 18
        );
      }
    }
  });

  it("keeps a single-seat getSeatPositionForViewer API for overlays", () => {
    const hero = getSeatPositionForViewer(0, 4, 0, true);
    expect(hero.isViewer).toBe(true);
    expect(hero.x).toBe(50);
  });

  it("anchors top seats onto the outer rail (away from the board)", () => {
    expect(seatAnchorTransform(0, 7)).toContain("-18%");
    expect(seatAnchorTransformFromY(18, false, false)).toContain("-100%");
    expect(seatAnchorTransformFromY(18, false, true)).toContain("-100%");
    expect(seatAnchorTransformFromY(94, true, true)).toBe(
      "translate(-50%, -100%)"
    );
    expect(seatAnchorTransformForViewer(0, 7, true)).toBe(
      "translate(-50%, -100%)"
    );
  });
});
