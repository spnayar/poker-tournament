import { describe, expect, it } from "vitest";
import { matchSpeakerUserIds, normalizeZoomDisplayName } from "./zoomDisplayName";

describe("normalizeZoomDisplayName", () => {
  it("collapses punctuation and case", () => {
    expect(normalizeZoomDisplayName("  Sam J. ")).toBe("sam j");
    expect(normalizeZoomDisplayName("Sam-J")).toBe("sam j");
  });
});

describe("matchSpeakerUserIds", () => {
  it("matches Zoom display names onto seats", () => {
    const seats = [
      { userId: "u1", displayName: "Alex" },
      { userId: "u2", displayName: "Sam J" },
    ];
    expect(matchSpeakerUserIds(seats, [{ displayName: "sam j" }])).toEqual(["u2"]);
    expect(matchSpeakerUserIds(seats, [{ displayName: "Nobody" }])).toEqual([]);
  });
});
