import { describe, expect, it } from "vitest";
import { formatCents, getAvatarUrl } from "./utils";

describe("formatCents", () => {
  it("formats positives with a leading dollar sign", () => {
    expect(formatCents(800)).toBe("$8.00");
    expect(formatCents(0)).toBe("$0.00");
  });

  it("formats negatives as -$X.XX not $-X.XX", () => {
    expect(formatCents(-800)).toBe("-$8.00");
    expect(formatCents(-28_00)).toBe("-$28.00");
  });
});

describe("getAvatarUrl", () => {
  it("rewrites a saved DiceBear picker URL to the local asset", () => {
    expect(
      getAvatarUrl(
        "Host",
        "https://api.dicebear.com/7.x/bottts/svg?seed=Robot-1&backgroundColor=b6e3f4"
      )
    ).toBe("/avatars/fun-robot-1.svg");
  });

  it("passes through a local picker URL", () => {
    expect(getAvatarUrl("Host", "/avatars/man-jack.svg")).toBe(
      "/avatars/man-jack.svg"
    );
  });

  it("falls back to a seeded DiceBear portrait when none is saved", () => {
    expect(getAvatarUrl("be97plus")).toBe(
      "https://api.dicebear.com/7.x/avataaars/svg?seed=be97plus"
    );
  });
});
