import { describe, expect, it } from "vitest";
import {
  ZOOM_FACES_MAX,
  ZOOM_FACES_TILE_HEIGHT,
  ZOOM_FACES_TILE_WIDTH,
  ZOOM_SDK_TILE_HEIGHT,
  computeZoomFacesLayout,
  countVideoOnAttendees,
  listVideoOnFaces,
  stackHeightForTiles,
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

describe("listVideoOnFaces", () => {
  it("skips the club mirror participant and caps at max", () => {
    const faces = listVideoOnFaces(
      [
        { userId: 1, userName: "The Poker Table Club", video: true },
        { userId: 2, displayName: "Sanjay Nayar", bVideoOn: true },
        { userId: 3, userName: "Alex", video: true },
        { userId: 4, userName: "Off", video: false },
      ],
      "The Poker Table Club",
      9
    );
    expect(faces.map((f) => f.displayName)).toEqual([
      "Sanjay Nayar",
      "Alex",
    ]);
  });
});

describe("stackHeightForTiles", () => {
  it("sizes stack to landscape thumbs + gaps only", () => {
    expect(stackHeightForTiles(0)).toBe(0);
    expect(stackHeightForTiles(1)).toBe(ZOOM_FACES_TILE_HEIGHT);
    expect(stackHeightForTiles(2)).toBe(
      ZOOM_FACES_TILE_HEIGHT * 2 + 6
    );
  });
});

describe("computeZoomFacesLayout", () => {
  it("returns zero frame height when nobody has video on", () => {
    const layout = computeZoomFacesLayout(0, ZOOM_FACES_TILE_WIDTH, 400);
    expect(layout.tileCount).toBe(0);
    expect(layout.frameHeight).toBe(0);
  });

  it("uses landscape tile geometry (wider than tall)", () => {
    expect(ZOOM_FACES_TILE_WIDTH).toBeGreaterThan(ZOOM_FACES_TILE_HEIGHT);
    expect(ZOOM_FACES_TILE_WIDTH / ZOOM_FACES_TILE_HEIGHT).toBeCloseTo(
      16 / 9,
      1
    );
  });

  it("caps at 9 and sizes SDK engine for gallery blit source", () => {
    const needed = stackHeightForTiles(ZOOM_FACES_MAX);
    const layout = computeZoomFacesLayout(
      12,
      ZOOM_FACES_TILE_WIDTH,
      needed + 40
    );
    expect(layout.tileCount).toBe(ZOOM_FACES_MAX);
    expect(layout.sdkHeight).toBe(ZOOM_SDK_TILE_HEIGHT * ZOOM_FACES_MAX);
    expect(layout.frameHeight).toBe(needed);
  });
});
