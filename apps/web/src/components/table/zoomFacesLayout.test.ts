import { describe, expect, it } from "vitest";
import {
  ZOOM_FACES_MAX,
  ZOOM_SDK_TILE_HEIGHT,
  ZOOM_SDK_TILE_WIDTH,
  computeZoomFacesLayout,
  countVideoOnAttendees,
} from "./zoomFacesLayout";

describe("countVideoOnAttendees", () => {
  it("counts only attendees with video on", () => {
    expect(
      countVideoOnAttendees([
        { video: true },
        { bVideoOn: true },
        { video: false },
        { bVideoOn: false },
        null,
        {},
      ])
    ).toBe(2);
  });
});

describe("computeZoomFacesLayout", () => {
  it("returns zero frame height when nobody has video on", () => {
    const layout = computeZoomFacesLayout(0, 104, 400);
    expect(layout.tileCount).toBe(0);
    expect(layout.frameHeight).toBe(0);
  });

  it("caps at 9 tiles and fills column width for a tall column", () => {
    const layout = computeZoomFacesLayout(12, 104, 900);
    expect(layout.tileCount).toBe(ZOOM_FACES_MAX);
    expect(layout.sdkHeight).toBe(ZOOM_SDK_TILE_HEIGHT * ZOOM_FACES_MAX);
    expect(layout.frameWidth).toBe(104);
    expect(layout.scaleX).toBeCloseTo(104 / ZOOM_SDK_TILE_WIDTH, 5);
  });

  it("shrinks to fit a short column while keeping aspect of the ribbon", () => {
    const layout = computeZoomFacesLayout(2, 104, 80);
    expect(layout.tileCount).toBe(2);
    expect(layout.frameHeight).toBe(80);
    expect(layout.frameWidth).toBeLessThanOrEqual(104);
    expect(layout.sdkHeight).toBe(ZOOM_SDK_TILE_HEIGHT * 2);
  });

  it("makes two active thumbs larger than nine in the same column", () => {
    const two = computeZoomFacesLayout(2, 104, 500);
    const nine = computeZoomFacesLayout(9, 104, 500);
    const twoTileH = two.frameHeight / two.tileCount;
    const nineTileH = nine.frameHeight / nine.tileCount;
    expect(twoTileH).toBeGreaterThan(nineTileH);
  });
});
