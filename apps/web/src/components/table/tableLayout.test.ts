import { describe, expect, it } from "vitest";
import {
  bottomSeatVisualIndex,
  getSeatPosition,
  getSeatPositionForViewer,
  getVisualSeatIndex,
  seatAnchorTransform,
} from "./tableLayout";

describe("tableLayout", () => {
  it("places the viewer at the bottom visual index", () => {
    expect(bottomSeatVisualIndex(2)).toBe(1);
    expect(bottomSeatVisualIndex(7)).toBe(3);
    expect(getVisualSeatIndex(0, 7, 0)).toBe(3);
  });

  it("keeps hero seat Y low enough for hole cards under the clip line", () => {
    const two = getSeatPosition(bottomSeatVisualIndex(2), 2, false);
    const seven = getSeatPosition(bottomSeatVisualIndex(7), 7, false);
    const sevenCompact = getSeatPosition(bottomSeatVisualIndex(7), 7, true);
    expect(two.y).toBeLessThanOrEqual(72);
    expect(seven.y).toBeLessThanOrEqual(72);
    expect(sevenCompact.y).toBeLessThanOrEqual(68);
  });

  it("anchors bottom seats upward so cards hang into the felt", () => {
    const bottom = bottomSeatVisualIndex(7);
    expect(seatAnchorTransform(bottom, 7)).toContain("-88%");
    expect(seatAnchorTransform(0, 7)).toContain("-18%");
  });

  it("spreads seven seats without stacking on the same point", () => {
    const viewer = 0;
    const positions = Array.from({ length: 7 }, (_, i) =>
      getSeatPositionForViewer(i, 7, viewer, false)
    );
    const keys = new Set(positions.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`));
    expect(keys.size).toBe(7);
    const hero = positions.find((p) => p.visualIndex === bottomSeatVisualIndex(7));
    expect(hero?.y).toBeLessThanOrEqual(72);
  });
});
