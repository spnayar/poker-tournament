import { describe, expect, it } from "vitest";
import { getAvatarUrl } from "./utils";

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
