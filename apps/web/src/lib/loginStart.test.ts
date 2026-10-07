import { describe, it, expect } from "vitest";
import { decideLoginStart, parseLoginStartInput } from "./loginStart";

const EXPECTED = "friends-only";

describe("parseLoginStartInput", () => {
  it("requires email and lowercases it; invite is optional", () => {
    expect(parseLoginStartInput({ email: " Host@Example.COM " })).toEqual({
      ok: true,
      data: { email: "host@example.com", inviteCode: null },
    });
    expect(
      parseLoginStartInput({
        email: " Host@Example.COM ",
        inviteCode: "  friends-only  ",
      })
    ).toEqual({
      ok: true,
      data: { email: "host@example.com", inviteCode: "friends-only" },
    });
  });

  it("treats blank invite as missing", () => {
    const parsed = parseLoginStartInput({
      email: "a@b.co",
      inviteCode: "   ",
    });
    expect(parsed).toEqual({
      ok: true,
      data: { email: "a@b.co", inviteCode: null },
    });
  });

  it("rejects missing or invalid email", () => {
    expect(parseLoginStartInput({})).toEqual({
      ok: false,
      error: "Enter your email",
      status: 400,
    });
    expect(parseLoginStartInput({ email: "   " })).toEqual({
      ok: false,
      error: "Enter your email",
      status: 400,
    });
    expect(parseLoginStartInput({ email: "not-an-email" })).toMatchObject({
      ok: false,
      error: "Enter a valid email",
    });
  });
});

describe("decideLoginStart", () => {
  it("sends a link for registered emails without asking for invite", () => {
    expect(
      decideLoginStart({
        userExists: true,
        inviteCode: null,
        expectedInvite: EXPECTED,
      })
    ).toEqual({ action: "send_link" });
  });

  it("ignores a wrong invite when the email is already registered", () => {
    expect(
      decideLoginStart({
        userExists: true,
        inviteCode: "nope",
        expectedInvite: EXPECTED,
      })
    ).toEqual({ action: "send_link" });
  });

  it("asks for invite when the email has no account", () => {
    expect(
      decideLoginStart({
        userExists: false,
        inviteCode: null,
        expectedInvite: EXPECTED,
      })
    ).toEqual({ action: "needs_invite" });
  });

  it("creates the account on a valid invite then sends a link", () => {
    expect(
      decideLoginStart({
        userExists: false,
        inviteCode: EXPECTED,
        expectedInvite: EXPECTED,
      })
    ).toEqual({ action: "create_and_send" });
  });

  it("rejects an invalid invite for unregistered emails", () => {
    expect(
      decideLoginStart({
        userExists: false,
        inviteCode: "wrong",
        expectedInvite: EXPECTED,
      })
    ).toEqual({ action: "invalid_invite" });
  });
});
