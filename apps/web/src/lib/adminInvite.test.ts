import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { findUnique, create, verificationCreate, consume, sendAppEmail } =
  vi.hoisted(() => ({
    findUnique: vi.fn(),
    create: vi.fn(),
    verificationCreate: vi.fn(),
    consume: vi.fn(),
    sendAppEmail: vi.fn(),
  }));

vi.mock("@poker/db", () => ({
  prisma: {
    user: { findUnique, create },
    verificationToken: { create: verificationCreate },
  },
}));

vi.mock("./mailer", () => ({
  sendAppEmail: (...args: unknown[]) => sendAppEmail(...args),
}));

vi.mock("./rateLimit", () => ({
  sendLinkLimiter: { consume: (...args: unknown[]) => consume(...args) },
}));

import {
  adminInviteHtml,
  parseAdminInviteEmail,
  inviteUserFromAdmin,
} from "./adminInvite";

describe("parseAdminInviteEmail", () => {
  it("lowercases a valid email", () => {
    expect(parseAdminInviteEmail({ email: " Pal@Example.COM " })).toEqual({
      ok: true,
      email: "pal@example.com",
    });
  });

  it("rejects missing or invalid email", () => {
    expect(parseAdminInviteEmail({}).ok).toBe(false);
    expect(parseAdminInviteEmail({ email: "nope" }).ok).toBe(false);
  });
});

describe("adminInviteHtml", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("matches Poker Night chip branding and skips friends-only", () => {
    process.env.NEXTAUTH_URL = "http://localhost:3000";
    const html = adminInviteHtml("https://www.pokertableclub.com/api/auth/callback/email?token=abc", 15);
    expect(html).toContain("Poker Night");
    expect(html).toContain(
      'src="https://www.pokertableclub.com/poker-table-club-logo.png"'
    );
    expect(html).toContain('alt="Poker Table Club chip logo"');
    expect(html).toContain("Join Poker Night");
    expect(html).not.toContain("friends-only");
  });
});

describe("inviteUserFromAdmin", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    findUnique.mockReset();
    create.mockReset();
    verificationCreate.mockReset();
    consume.mockReset();
    sendAppEmail.mockReset();
    consume.mockResolvedValue({ allowed: true, retryAfterSec: 900 });
    verificationCreate.mockResolvedValue({});
    sendAppEmail.mockResolvedValue({ skipped: false, id: "msg_1" });
    process.env = { ...originalEnv };
    process.env.NEXTAUTH_SECRET = "test-secret";
    process.env.NEXTAUTH_URL = "http://localhost:3000";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("creates an account without the friends-only code", async () => {
    findUnique.mockResolvedValue(null);
    create.mockResolvedValue({ id: "user_new" });
    const result = await inviteUserFromAdmin({
      email: "New.Pal@Example.com",
      ip: "127.0.0.1",
    });
    expect(result).toMatchObject({
      status: "created",
      email: "new.pal@example.com",
      userId: "user_new",
      sent: "sent",
    });
    expect(create).toHaveBeenCalled();
    expect(sendAppEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "new.pal@example.com",
        subject: "You're invited to Poker Night",
      })
    );
    const html = sendAppEmail.mock.calls[0]?.[0]?.html as string;
    expect(html).not.toContain("friends-only");
    expect(html).toContain("Join Poker Night");
  });

  it("resends a link when the account already exists", async () => {
    findUnique.mockResolvedValue({ id: "user_old" });
    const result = await inviteUserFromAdmin({
      email: "pal@example.com",
      ip: "127.0.0.1",
    });
    expect(result).toMatchObject({
      status: "exists",
      userId: "user_old",
      sent: "sent",
    });
    expect(create).not.toHaveBeenCalled();
  });
});
