import { describe, it, expect, afterEach } from "vitest";
import {
  BOOTSTRAP_ADMIN_EMAILS,
  canDeleteAccount,
  isAdminUser,
  isAllowlistedAdminEmail,
  parseAccountStatus,
  parseAdminEmails,
} from "./adminAccess";

describe("parseAdminEmails", () => {
  const original = process.env.ADMIN_EMAILS;

  afterEach(() => {
    if (original === undefined) delete process.env.ADMIN_EMAILS;
    else process.env.ADMIN_EMAILS = original;
  });

  it("always includes Sanjay Gmail and info@", () => {
    delete process.env.ADMIN_EMAILS;
    expect(parseAdminEmails(undefined)).toEqual([...BOOTSTRAP_ADMIN_EMAILS]);
    expect(parseAdminEmails("")).toEqual([...BOOTSTRAP_ADMIN_EMAILS]);
  });

  it("unions extras from ADMIN_EMAILS", () => {
    expect(parseAdminEmails(" Host@Example.com , spnayar@gmail.com ")).toEqual([
      "spnayar@gmail.com",
      "info@pokertableclub.com",
      "host@example.com",
    ]);
  });
});

describe("isAllowlistedAdminEmail", () => {
  it("matches bootstrap emails case-insensitively", () => {
    expect(isAllowlistedAdminEmail("Sanjay@unused")).toBe(false);
    expect(isAllowlistedAdminEmail("spnayar@gmail.com")).toBe(true);
    expect(isAllowlistedAdminEmail(" Info@PokerTableClub.com ")).toBe(true);
  });
});

describe("isAdminUser", () => {
  it("grants access via role or allowlist", () => {
    expect(
      isAdminUser({ role: "ADMIN", email: "other@example.com" })
    ).toBe(true);
    expect(
      isAdminUser({ role: "PLAYER", email: "spnayar@gmail.com" })
    ).toBe(true);
    expect(
      isAdminUser({ role: "PLAYER", email: "friend@example.com" })
    ).toBe(false);
  });
});

describe("canDeleteAccount", () => {
  it("blocks self-delete and admin/allowlisted accounts", () => {
    expect(
      canDeleteAccount({
        actorId: "me",
        target: { id: "me", email: "friend@x.co", role: "PLAYER" },
      }).ok
    ).toBe(false);
    expect(
      canDeleteAccount({
        actorId: "me",
        target: {
          id: "sanjay",
          email: "spnayar@gmail.com",
          role: "PLAYER",
        },
      }).ok
    ).toBe(false);
    expect(
      canDeleteAccount({
        actorId: "me",
        target: { id: "other", email: "pal@x.co", role: "ADMIN" },
      }).ok
    ).toBe(false);
    expect(
      canDeleteAccount({
        actorId: "me",
        target: { id: "pal", email: "pal@x.co", role: "PLAYER" },
      })
    ).toEqual({ ok: true });
  });
});

describe("parseAccountStatus", () => {
  it("accepts free/paid in either case", () => {
    expect(parseAccountStatus("FREE")).toBe("FREE");
    expect(parseAccountStatus("paid")).toBe("PAID");
    expect(parseAccountStatus("nope")).toBeNull();
  });
});
