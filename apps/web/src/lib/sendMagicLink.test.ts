import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const findUnique = vi.fn();
const consume = vi.fn();
const sendAppEmail = vi.fn();

vi.mock("@poker/db", () => ({
  prisma: { user: { findUnique } },
}));

vi.mock("./mailer", () => ({
  sendAppEmail: (...args: unknown[]) => sendAppEmail(...args),
}));

vi.mock("./rateLimit", () => ({
  sendLinkLimiter: { consume: (...args: unknown[]) => consume(...args) },
}));

describe("deliverMagicLink", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    findUnique.mockReset();
    consume.mockReset();
    sendAppEmail.mockReset();
    consume.mockResolvedValue({ allowed: true, retryAfterSec: 900 });
    process.env = { ...originalEnv };
    delete process.env.RESEND_API_KEY;
    process.env.NODE_ENV = "development";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("does not call Resend when the email is not registered", async () => {
    findUnique.mockResolvedValue(null);
    const { deliverMagicLink } = await import("./sendMagicLink");
    const result = await deliverMagicLink({
      identifier: "New.User@Example.com",
      url: "http://localhost:3000/api/auth/callback/email?token=abc",
      ip: "127.0.0.1",
    });
    expect(result).toEqual({ status: "skipped", reason: "unknown_email" });
    expect(findUnique).toHaveBeenCalledWith({
      where: { email: "new.user@example.com" },
      select: { id: true },
    });
    expect(sendAppEmail).not.toHaveBeenCalled();
  });

  it("skips Resend when RESEND_API_KEY is missing in non-prod", async () => {
    findUnique.mockResolvedValue({ id: "user_1" });
    sendAppEmail.mockResolvedValue({
      skipped: true,
      reason: "missing_api_key",
    });
    const { deliverMagicLink } = await import("./sendMagicLink");
    const result = await deliverMagicLink({
      identifier: "spnayar@gmail.com",
      url: "http://localhost:3000/callback",
      ip: "127.0.0.1",
    });
    expect(result).toEqual({
      status: "skipped",
      reason: "missing_api_key",
    });
  });

  it("throws when RESEND_API_KEY is missing in production", async () => {
    process.env.NODE_ENV = "production";
    findUnique.mockResolvedValue({ id: "user_1" });
    sendAppEmail.mockResolvedValue({
      skipped: true,
      reason: "missing_api_key",
    });
    vi.resetModules();
    const { deliverMagicLink } = await import("./sendMagicLink");
    await expect(
      deliverMagicLink({
        identifier: "spnayar@gmail.com",
        url: "http://localhost:3000/callback",
        ip: "127.0.0.1",
      })
    ).rejects.toThrow(/RESEND_API_KEY is missing/);
  });

  it("propagates Resend API failures instead of swallowing them", async () => {
    findUnique.mockResolvedValue({ id: "user_1" });
    sendAppEmail.mockRejectedValue(new Error("Invalid API key"));
    const { deliverMagicLink } = await import("./sendMagicLink");
    await expect(
      deliverMagicLink({
        identifier: "spnayar@gmail.com",
        url: "http://localhost:3000/callback",
        ip: "127.0.0.1",
      })
    ).rejects.toThrow("Invalid API key");
  });

  it("sends when the user exists and Resend accepts the message", async () => {
    findUnique.mockResolvedValue({ id: "user_1" });
    sendAppEmail.mockResolvedValue({ skipped: false, id: "msg_1" });
    process.env.NEXTAUTH_URL = "http://localhost:3000";
    const { deliverMagicLink } = await import("./sendMagicLink");
    const result = await deliverMagicLink({
      identifier: "spnayar+test1@gmail.com",
      url: "http://localhost:3000/callback",
      ip: "127.0.0.1",
    });
    expect(result).toEqual({ status: "sent", id: "msg_1" });
    expect(sendAppEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "spnayar+test1@gmail.com",
        subject: "Your Poker Night login link",
      })
    );
    const html = sendAppEmail.mock.calls[0]?.[0]?.html as string;
    expect(html).toContain(
      'src="https://www.pokertableclub.com/poker-table-club-logo.png"'
    );
    expect(html).toContain('alt="Poker Table Club chip logo"');
  });
});

describe("clubLogoAbsoluteUrl", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("uses NEXTAUTH_URL origin when it is public HTTPS", async () => {
    process.env.NEXTAUTH_URL = "https://www.pokertableclub.com/";
    const { clubLogoAbsoluteUrl } = await import("./sendMagicLink");
    expect(clubLogoAbsoluteUrl()).toBe(
      "https://www.pokertableclub.com/poker-table-club-logo.png"
    );
  });

  it("uses a public HTTPS staging origin from NEXTAUTH_URL", async () => {
    process.env.NEXTAUTH_URL = "https://poker-web.up.railway.app";
    const { clubLogoAbsoluteUrl } = await import("./sendMagicLink");
    expect(clubLogoAbsoluteUrl()).toBe(
      "https://poker-web.up.railway.app/poker-table-club-logo.png"
    );
  });

  it("falls back when NEXTAUTH_URL is localhost or http", async () => {
    const { clubLogoAbsoluteUrl, CLUB_LOGO_FALLBACK_ORIGIN } =
      await import("./sendMagicLink");
    process.env.NEXTAUTH_URL = "http://localhost:3000";
    expect(clubLogoAbsoluteUrl()).toBe(
      `${CLUB_LOGO_FALLBACK_ORIGIN}/poker-table-club-logo.png`
    );
    process.env.NEXTAUTH_URL = "https://localhost:3000";
    expect(clubLogoAbsoluteUrl()).toBe(
      `${CLUB_LOGO_FALLBACK_ORIGIN}/poker-table-club-logo.png`
    );
    process.env.NEXTAUTH_URL = "http://example.com";
    expect(clubLogoAbsoluteUrl()).toBe(
      `${CLUB_LOGO_FALLBACK_ORIGIN}/poker-table-club-logo.png`
    );
    delete process.env.NEXTAUTH_URL;
    expect(clubLogoAbsoluteUrl()).toBe(
      `${CLUB_LOGO_FALLBACK_ORIGIN}/poker-table-club-logo.png`
    );
  });
});

describe("magicLinkHtml", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("embeds a small absolute HTTPS chip with alt text", async () => {
    process.env.NEXTAUTH_URL = "http://localhost:3000";
    const { magicLinkHtml } = await import("./sendMagicLink");
    const html = magicLinkHtml(
      "https://www.pokertableclub.com/api/auth/callback/email?token=abc",
      15
    );
    expect(html).toContain(
      'src="https://www.pokertableclub.com/poker-table-club-logo.png"'
    );
    expect(html).toContain('alt="Poker Table Club chip logo"');
    expect(html).toContain('width="48"');
    expect(html).toContain('height="48"');
    expect(html).not.toMatch(/src="\//);
    expect(html).not.toMatch(/localhost/);
  });
});
