import { describe, it, expect } from "vitest";
import { parseRegisterInput } from "./register";

describe("parseRegisterInput", () => {
  it("accepts invite + email + name and lowercases email", () => {
    const parsed = parseRegisterInput({
      email: " Host@Example.COM ",
      displayName: "Alex",
      inviteCode: "friends-only",
      password: "should-be-ignored",
    });
    expect(parsed).toEqual({
      ok: true,
      data: {
        email: "host@example.com",
        displayName: "Alex",
        inviteCode: "friends-only",
      },
    });
  });

  it("requires email, display name, and invite code — not a password", () => {
    expect(parseRegisterInput({ displayName: "Alex", inviteCode: "x" }).ok).toBe(
      false
    );
    expect(parseRegisterInput({ email: "a@b.co", inviteCode: "x" }).ok).toBe(
      false
    );
    expect(parseRegisterInput({ email: "a@b.co", displayName: "Alex" }).ok).toBe(
      false
    );
  });

  it("rejects invalid email and short names", () => {
    expect(
      parseRegisterInput({
        email: "not-an-email",
        displayName: "Alex",
        inviteCode: "friends-only",
      }).ok
    ).toBe(false);
    expect(
      parseRegisterInput({
        email: "a@b.co",
        displayName: "A",
        inviteCode: "friends-only",
      }).ok
    ).toBe(false);
  });
});
