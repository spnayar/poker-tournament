import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { findMany, consume, sendAppEmail } = vi.hoisted(() => ({
  findMany: vi.fn(),
  consume: vi.fn(),
  sendAppEmail: vi.fn(),
}));

vi.mock("@poker/db", () => ({
  prisma: { tournamentPlayer: { findMany } },
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
    });
    expect(html).toContain("Poker Night");
    expect(html).toContain(
      'src="https://www.pokertableclub.com/poker-table-club-logo.png"'
    );
    expect(html).toContain('alt="Poker Table Club chip logo"');
    expect(html).toContain("#0f172a");
    expect(html).toContain("#059669");
    expect(html).toContain("XK7M");
    expect(html).toContain("Friday Game Night");
    expect(html).toContain("$20.00");
    expect(html).toContain("Join this game night");
    expect(html).toContain("http://localhost:3000/join/XK7M");
    expect(html).toContain("No real money");
    expect(html).not.toMatch(/hole|cards/i);
    expect(html).not.toMatch(/src="\//);
  });

  it("escapes host and night names", () => {
    const html = gameNightInviteHtml({
      hostDisplayName: "<script>alert(1)</script>",
      nightName: 'Night & "Chips"',
      joinCode: "AB12",
      buyInCents: 500,
      joinUrl: "https://www.pokertableclub.com/join/AB12",
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&amp;");
    expect(html).toContain("&quot;");
  });
});

describe("gameNightInviteText", () => {
  it("includes join code and ledger buy-in", () => {
    const text = gameNightInviteText({
      hostDisplayName: "Sanjay",
      nightName: "Friday Game Night",
      joinCode: "XK7M",
      buyInCents: 2000,
      joinUrl: "http://localhost:3000/join/XK7M",
    });
    expect(text).toContain("Join code: XK7M");
    expect(text).toContain("$20.00");
    expect(text).toContain("/join/XK7M");
  });
});

describe("listPastPlayers", () => {
  it("de-dupes by email and skips excluded users", async () => {
    findMany.mockResolvedValue([
      {
        user: {
          id: "u2",
          displayName: "Pat",
          email: "Pat@X.co",
          avatarUrl: null,
        },
      },
      {
        user: {
          id: "u3",
          displayName: "Pat Alt",
          email: "pat@x.co",
          avatarUrl: null,
        },
      },
    ]);
    const { listPastPlayers } = await import("./gameNightInvite");
    const players = await listPastPlayers({
      userId: "host",
      excludeUserIds: ["u4"],
    });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: { notIn: ["host", "u4"] },
        }),
      })
    );
    expect(players).toEqual([
      {
        userId: "u2",
        displayName: "Pat",
        email: "pat@x.co",
        avatarUrl: null,
      },
    ]);
  });
});

describe("sendGameNightInvites", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    consume.mockReset();
    sendAppEmail.mockReset();
    consume.mockResolvedValue({ allowed: true, retryAfterSec: 900 });
    process.env = { ...originalEnv };
    process.env.NEXTAUTH_URL = "http://localhost:3000";
    process.env.NODE_ENV = "development";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("skips the host, rate-limits, and sends the rest via sendAppEmail", async () => {
    sendAppEmail.mockResolvedValue({ skipped: false, id: "msg_1" });
    const { sendGameNightInvites } = await import("./gameNightInvite");
    const result = await sendGameNightInvites({
      emails: ["host@x.co", "pat@x.co", "alex@x.co"],
      hostEmail: "Host@x.co",
      hostDisplayName: "Sanjay",
      nightName: "Friday Game Night",
      joinCode: "XK7M",
      buyInCents: 2000,
      ip: "127.0.0.1",
    });
    expect(result.results).toEqual([
      { email: "host@x.co", status: "self" },
      { email: "pat@x.co", status: "sent", id: "msg_1" },
      { email: "alex@x.co", status: "sent", id: "msg_1" },
    ]);
    expect(sendAppEmail).toHaveBeenCalledTimes(2);
    expect(sendAppEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "pat@x.co",
        subject: "You're invited to Friday Game Night",
      })
    );
    expect(result.previewHtml).toContain("XK7M");
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
