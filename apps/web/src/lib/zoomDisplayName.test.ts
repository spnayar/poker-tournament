import { describe, expect, it } from "vitest";
import { matchSpeakerUserIds, normalizeZoomDisplayName } from "./zoomDisplayName";

describe("normalizeZoomDisplayName", () => {
  it("collapses punctuation and case", () => {
    expect(normalizeZoomDisplayName("  Sam J. ")).toBe("sam j");
    expect(normalizeZoomDisplayName("Sam-J")).toBe("sam j");
  });

  it("returns empty string for missing names", () => {
    expect(normalizeZoomDisplayName(undefined)).toBe("");
    expect(normalizeZoomDisplayName(null)).toBe("");
    expect(normalizeZoomDisplayName("")).toBe("");
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

  it("accepts Zoom payloads that use userName instead of displayName", () => {
    const seats = [{ userId: "u1", displayName: "Alex" }];
    expect(matchSpeakerUserIds(seats, [{ userName: "alex" }])).toEqual(["u1"]);
  });

  it("does not throw when seats or speakers are missing or incomplete", () => {
    expect(matchSpeakerUserIds(undefined, undefined)).toEqual([]);
    expect(matchSpeakerUserIds(null, null)).toEqual([]);
    expect(
      matchSpeakerUserIds(
        [
          { userId: undefined, displayName: "Ghost" },
          { userId: "u1", displayName: undefined },
          null as unknown as { userId: string; displayName: string },
        ],
        [null as unknown as { displayName: string }, { displayName: null }, {}]
      )
    ).toEqual([]);
  });
});
