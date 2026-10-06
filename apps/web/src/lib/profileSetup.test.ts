import { describe, it, expect } from "vitest";
import { needsProfileSetup } from "./profileSetup";

describe("needsProfileSetup", () => {
  it("is incomplete until name is confirmed and an avatar is picked", () => {
    expect(
      needsProfileSetup({ displayNameSet: false, avatarUrl: null })
    ).toBe(true);
    expect(
      needsProfileSetup({
        displayNameSet: true,
        avatarUrl: null,
      })
    ).toBe(true);
    expect(
      needsProfileSetup({
        displayNameSet: false,
        avatarUrl: "https://example.com/a.png",
      })
    ).toBe(true);
    expect(
      needsProfileSetup({
        displayNameSet: true,
        avatarUrl: "https://example.com/a.png",
      })
    ).toBe(false);
  });
});
