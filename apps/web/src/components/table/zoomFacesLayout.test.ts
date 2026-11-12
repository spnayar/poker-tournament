import { describe, expect, it } from "vitest";
import {
  ZOOM_FACES_CELL_HEIGHT,
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
    const layout = computeZoomFacesLayout(0, 120, 400);
    expect(layout.tileCount).toBe(0);
    expect(layout.frameHeight).toBe(0);
  });

  it("sizes frame height to active thumbs only (no empty slots)", () => {
    const one = computeZoomFacesLayout(1, 120, 900);
    const three = computeZoomFacesLayout(3, 120, 900);
    expect(one.frameHeight).toBe(ZOOM_FACES_CELL_HEIGHT);
    expect(three.frameHeight).toBe(ZOOM_FACES_CELL_HEIGHT * 3);
    expect(three.frameHeight).toBeLessThan(ZOOM_FACES_CELL_HEIGHT * 9);
  });

  it("caps at 9 tiles and uses cover scale (no letterbox)", () => {
    const layout = computeZoomFacesLayout(12, 120, 900);
    expect(layout.tileCount).toBe(ZOOM_FACES_MAX);
    expect(layout.sdkHeight).toBe(ZOOM_SDK_TILE_HEIGHT * ZOOM_FACES_MAX);
    expect(layout.scaleX).toBe(layout.scaleY);
    expect(layout.scaleX).toBeGreaterThanOrEqual(
      layout.frameWidth / ZOOM_SDK_TILE_WIDTH
    );
  });

  it("never prefers letterbox contain scale over cover", () => {
    const layout = computeZoomFacesLayout(1, 120, 900);
    // Cover uses max(scaleX, scaleY); contain would use min.
    expect(layout.scaleX).toBe(Math.max(120 / ZOOM_SDK_TILE_WIDTH, layout.frameHeight / ZOOM_SDK_TILE_HEIGHT));
  });

  it("shrinks to fit a short column", () => {
    const layout = computeZoomFacesLayout(2, 120, 80);
    expect(layout.tileCount).toBe(2);
    expect(layout.frameHeight).toBe(80);
    expect(layout.frameWidth).toBeLessThanOrEqual(120);
  });
});
