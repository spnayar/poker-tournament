import { describe, it, expect, afterEach } from "vitest";
import {
  BOOTSTRAP_ADMIN_EMAILS,
  canDeleteAccount,
  isAdminUser,
  isAllowlistedAdminEmail,
  isLegacyPasswordEraCandidate,
  LEGACY_PURGE_CONFIRM_PHRASE,
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

describe("isLegacyPasswordEraCandidate", () => {
  const base = {
    email: "old@example.com",
    role: "PLAYER" as const,
    passwordHash: "bcrypt-leftover",
    lastLoginAt: null,
    loginCount: 0,
  };

  it("matches leftover passwordHash with no magic-link login", () => {
    expect(isLegacyPasswordEraCandidate(base)).toBe(true);
  });

  it("skips magic-link users even if a hash remains", () => {
    expect(
      isLegacyPasswordEraCandidate({
        ...base,
        lastLoginAt: new Date("2026-10-01"),
        loginCount: 1,
      })
    ).toBe(false);
    expect(
      isLegacyPasswordEraCandidate({
        ...base,
        lastLoginAt: null,
        loginCount: 2,
      })
    ).toBe(false);
  });

  it("skips accounts without a password hash", () => {
    expect(
      isLegacyPasswordEraCandidate({ ...base, passwordHash: null })
    ).toBe(false);
  });

  it("never matches admins or allowlisted emails", () => {
    expect(
      isLegacyPasswordEraCandidate({ ...base, role: "ADMIN" })
    ).toBe(false);
    expect(
      isLegacyPasswordEraCandidate({
        ...base,
        email: "spnayar@gmail.com",
      })
    ).toBe(false);
    expect(
      isLegacyPasswordEraCandidate({
        ...base,
        email: "info@pokertableclub.com",
      })
    ).toBe(false);
  });

  it("exports a stable confirm phrase", () => {
    expect(LEGACY_PURGE_CONFIRM_PHRASE).toBe("PURGE LEGACY ACCOUNTS");
  });
});
