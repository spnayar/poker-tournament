import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  matchSpeakerUserIds,
  normalizeZoomDisplayName,
  ZOOM_MIRROR_PARTICIPANT_NAME,
} from "./zoomDisplayName";

const webSrc = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("ZOOM_MIRROR_PARTICIPANT_NAME", () => {
  it("is the Poker Table Club brand for in-table Meeting SDK joins", () => {
    expect(ZOOM_MIRROR_PARTICIPANT_NAME).toBe("The Poker Table Club");
  });

  it("is what signature API and ZoomMirrorStrip join with (not session name)", () => {
    const signatureRoute = readFileSync(
      join(webSrc, "app/api/tournaments/[id]/zoom/signature/route.ts"),
      "utf8"
    );
    const strip = readFileSync(
      join(webSrc, "components/table/ZoomMirrorStrip.tsx"),
      "utf8"
    );
    expect(signatureRoute).toContain("ZOOM_MIRROR_PARTICIPANT_NAME");
    expect(signatureRoute).not.toMatch(/session\.user\.name/);
    expect(strip).toContain("ZOOM_MIRROR_PARTICIPANT_NAME");
    expect(strip).toMatch(
      /const userName = ZOOM_MIRROR_PARTICIPANT_NAME/
    );
  });
});

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
