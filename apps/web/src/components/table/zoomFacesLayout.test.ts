import { describe, expect, it } from "vitest";
import {
  ZOOM_FACES_PHONE_THUMB,
  ZOOM_FACES_SIDE_THUMB,
  ZOOM_SDK_VIEW_HEIGHT,
  ZOOM_SDK_VIEW_WIDTH,
} from "./zoomFacesLayout";

/**
 * Layout contract for PTC-46 Zoom table faces:
 * - SDK paints at speaker-view floor (240×135)
 * - CSS scales into a side thumbnail (sm+) or phone strip
 * - Table keeps viewport; faces never sit as a large top band
 */
describe("Zoom faces thumbnail layout", () => {
  it("pins Meeting SDK speaker view to the documented minimum floor", () => {
    expect(ZOOM_SDK_VIEW_WIDTH).toBe(240);
    expect(ZOOM_SDK_VIEW_HEIGHT).toBe(135);
    expect(ZOOM_SDK_VIEW_WIDTH / ZOOM_SDK_VIEW_HEIGHT).toBeCloseTo(16 / 9, 5);
  });

  it("keeps phone thumb smaller than side thumb so the table dominates", () => {
    expect(
      ZOOM_FACES_PHONE_THUMB.width * ZOOM_FACES_PHONE_THUMB.height
    ).toBeLessThan(ZOOM_FACES_SIDE_THUMB.width * ZOOM_FACES_SIDE_THUMB.height);
    expect(ZOOM_FACES_PHONE_THUMB.height).toBeLessThan(80);
    expect(ZOOM_FACES_SIDE_THUMB.height).toBeLessThan(120);
  });
});
