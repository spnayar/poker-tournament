import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const {
  findMany,
  userFindUnique,
  userCreate,
  userUpdate,
  verificationCreate,
  consume,
  sendAppEmail,
} = vi.hoisted(() => ({
  findMany: vi.fn(),
  userFindUnique: vi.fn(),
  userCreate: vi.fn(),
  userUpdate: vi.fn(),
  verificationCreate: vi.fn(),
  consume: vi.fn(),
  sendAppEmail: vi.fn(),
}));

vi.mock("@poker/db", () => ({
  prisma: {
    tournamentPlayer: { findMany },
    user: {
      findUnique: userFindUnique,
      create: userCreate,
      update: userUpdate,
    },
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
  gameNightInviteHtml,
  gameNightInviteText,
  parseInviteEmails,
  parseInvitePeople,
  MAX_INVITE_EMAILS,
} from "./gameNightInvite";

describe("parseInviteEmails", () => {
  it("lowercases, de-dupes, and splits commas", () => {
    expect(
      parseInviteEmails([" Alex@Example.com ", "alex@example.com", "pat@x.co"])
    ).toEqual({
      ok: true,
      emails: ["alex@example.com", "pat@x.co"],
    });
    expect(parseInviteEmails("a@b.co, c@d.co;e@f.co")).toEqual({
      ok: true,
      emails: ["a@b.co", "c@d.co", "e@f.co"],
    });
  });

  it("rejects invalid or empty lists", () => {
    expect(parseInviteEmails("not-an-email")).toMatchObject({ ok: false });
    expect(parseInviteEmails([])).toMatchObject({ ok: false });
    expect(parseInviteEmails("")).toMatchObject({ ok: false });
  });

  it("caps batch size", () => {
    const emails = Array.from(
      { length: MAX_INVITE_EMAILS + 1 },
      (_, i) => `p${i}@x.co`
    );
    expect(parseInviteEmails(emails)).toMatchObject({ ok: false });
  });
});

describe("parseInvitePeople", () => {
  it("keeps optional display names", () => {
    expect(
      parseInvitePeople([
        { email: " Pat@X.co ", displayName: "  Pat  " },
        { email: "alex@x.co" },
      ])
    ).toEqual({
      ok: true,
      people: [
        { email: "pat@x.co", displayName: "Pat" },
        { email: "alex@x.co", displayName: null },
      ],
    });
  });
});

describe("gameNightInviteHtml", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("matches magic-link branding and includes join code plus ledger buy-in", () => {
    process.env.NEXTAUTH_URL = "http://localhost:3000";
    const html = gameNightInviteHtml({
      hostDisplayName: "Sanjay",
      nightName: "Friday Game Night",
      joinCode: "XK7M",
      buyInCents: 2000,
      joinUrl: "http://localhost:3000/join/XK7M",
      magicUrl: "http://localhost:3000/api/auth/callback/email?token=abc",
      isNewAccount: true,
      zoomJoinUrl: "https://zoom.us/j/123?pwd=abc",
    });
    expect(html).toContain("Poker Night");
    expect(html).toContain(
      'src="https://www.pokertableclub.com/poker-table-club-logo.png"'
    );
    expect(html).toContain('alt="Poker Table Club chip logo"');
    expect(html).toContain("#0f172a");
    expect(html).toContain("#059669");
    expect(html).toContain("XK7M");
    expect(html).toContain("Create account &amp; join the table");
    expect(html).toContain("no password or club invite code needed");
    expect(html).toContain("This login link expires in");
    expect(html).not.toContain("friends-only");
    expect(html).not.toContain("Join this game night");
    expect(html).toContain("Buy-in (ledger): $20.00");
    expect(html).toContain('href="https://zoom.us/j/123?pwd=abc"');
    expect(html).toContain("Join Zoom");
    expect(html).not.toMatch(
      /background:#059669[^>]*>Join Zoom</
    );
    expect(html).toContain("http://localhost:3000/join/XK7M");

    const text = gameNightInviteText({
      hostDisplayName: "Sanjay",
      nightName: "Friday Game Night",
      joinCode: "XK7M",
      buyInCents: 2000,
      joinUrl: "http://localhost:3000/join/XK7M",
      magicUrl: "http://localhost:3000/api/auth/callback/email?token=abc",
      isNewAccount: true,
      zoomJoinUrl: "https://zoom.us/j/123?pwd=abc",
    });
    expect(text).toContain("Create your account and join the table");
    expect(text).toContain("Join Zoom: https://zoom.us/j/123?pwd=abc");
    expect(text).toContain("no separate club code");
  });

  it("uses a single sign-in CTA for existing accounts and keeps Zoom as a text link", () => {
    process.env.NEXTAUTH_URL = "http://localhost:3000";
    const html = gameNightInviteHtml({
      hostDisplayName: "Sanjay",
      nightName: "Friday Game Night",
      joinCode: "XK7M",
      buyInCents: 2000,
      joinUrl: "http://localhost:3000/join/XK7M",
      magicUrl: "http://localhost:3000/api/auth/callback/email?token=abc",
      isNewAccount: false,
      zoomJoinUrl: "https://zoom.us/j/123",
    });
    expect(html).toContain("Sign in &amp; join the table");
    expect(html).not.toContain("Create account &amp; join the table");
    expect(html).not.toContain("Join this game night");
    expect(html.match(/background:#059669/g)?.length).toBe(1);
    expect(html).toContain('color:#34d399;text-decoration:underline');
    expect(html).toContain(">Join Zoom<");
  });
});

describe("sendGameNightInvites", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    consume.mockReset();
    sendAppEmail.mockReset();
    userFindUnique.mockReset();
    userCreate.mockReset();
    userUpdate.mockReset();
    verificationCreate.mockReset();
    consume.mockResolvedValue({ allowed: true, retryAfterSec: 900 });
    verificationCreate.mockResolvedValue({});
    sendAppEmail.mockResolvedValue({ skipped: false, id: "msg_1" });
    process.env = { ...originalEnv };
    process.env.NEXTAUTH_URL = "http://localhost:3000";
    process.env.NEXTAUTH_SECRET = "test-secret";
    process.env.NODE_ENV = "development";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("creates new accounts, sends magic links, skips host", async () => {
    userFindUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "u-existing", displayNameSet: true });
    userCreate.mockResolvedValue({ id: "u-new" });

    const { sendGameNightInvites } = await import("./gameNightInvite");
    const result = await sendGameNightInvites({
      people: [
        { email: "host@x.co" },
        { email: "pat@x.co", displayName: "Pat" },
        { email: "alex@x.co" },
      ],
      hostEmail: "Host@x.co",
      hostDisplayName: "Sanjay",
      nightName: "Friday Game Night",
      joinCode: "XK7M",
      buyInCents: 2000,
      ip: "127.0.0.1",
    });
    expect(result.results).toEqual([
      { email: "host@x.co", status: "self" },
      {
        email: "pat@x.co",
        status: "sent",
        id: "msg_1",
        accountCreated: true,
      },
      {
        email: "alex@x.co",
        status: "sent",
        id: "msg_1",
        accountCreated: false,
      },
    ]);
    expect(userCreate).toHaveBeenCalledTimes(1);
    expect(sendAppEmail).toHaveBeenCalledTimes(2);
    expect(result.previewHtml).toContain("XK7M");
    expect(result.previewHtml).toContain("/api/auth/callback/email");
    expect(result.joinUrl).toBe("http://localhost:3000/join/XK7M");
  });

  it("does not send when rate-limited", async () => {
    consume.mockResolvedValue({ allowed: false, retryAfterSec: 900 });
    const { sendGameNightInvites } = await import("./gameNightInvite");
    const result = await sendGameNightInvites({
      emails: ["pat@x.co"],
      hostEmail: "host@x.co",
      hostDisplayName: "Sanjay",
      nightName: "Friday Game Night",
      joinCode: "XK7M",
      buyInCents: 2000,
      ip: "127.0.0.1",
    });
    expect(result.results).toEqual([
      { email: "pat@x.co", status: "rate_limited" },
    ]);
    expect(sendAppEmail).not.toHaveBeenCalled();
  });
});
