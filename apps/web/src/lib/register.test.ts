import { describe, it, expect } from "vitest";
import { parseRegisterInput, placeholderDisplayName } from "./register";

describe("placeholderDisplayName", () => {
  it("uses the local-part and strips plus tags", () => {
    expect(placeholderDisplayName("spnayar+test1@gmail.com")).toBe("spnayar");
    expect(placeholderDisplayName("  Host.Name@Example.COM ")).toBe("Host.Name");
  });

  it("falls back when the local-part is too short", () => {
    expect(placeholderDisplayName("a@b.co")).toBe("Player");
    expect(placeholderDisplayName("ab@b.co")).toBe("ab");
  });

  it("truncates long local-parts to 32 characters", () => {
    const long = `${"n".repeat(40)}@example.com`;
    expect(placeholderDisplayName(long)).toBe("n".repeat(32));
  });
});

describe("parseRegisterInput", () => {
  it("accepts invite + email only and lowercases email", () => {
    const parsed = parseRegisterInput({
      email: " Host@Example.COM ",
      inviteCode: "friends-only",
      displayName: "should-be-ignored",
      password: "should-be-ignored",
    });
    expect(parsed).toEqual({
      ok: true,
      data: {
        email: "host@example.com",
        inviteCode: "friends-only",
      },
    });
  });

  it("requires email and invite code — not a display name or password", () => {
    expect(parseRegisterInput({ inviteCode: "x" }).ok).toBe(false);
    expect(parseRegisterInput({ email: "a@b.co" }).ok).toBe(false);
    expect(
      parseRegisterInput({ email: "a@b.co", inviteCode: "friends-only" }).ok
    ).toBe(true);
  });

  it("rejects invalid email", () => {
    expect(
      parseRegisterInput({
        email: "not-an-email",
        inviteCode: "friends-only",
      }).ok
    ).toBe(false);
  });
});
