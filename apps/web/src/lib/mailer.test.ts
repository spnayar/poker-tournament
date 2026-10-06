import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const sendMock = vi.fn();

vi.mock("resend", () => ({
  Resend: class {
    emails = { send: sendMock };
  },
}));

describe("sendAppEmail", () => {
  const original = { ...process.env };

  beforeEach(() => {
    sendMock.mockReset();
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_FROM;
  });

  afterEach(() => {
    process.env = { ...original };
  });

  it("skips send when RESEND_API_KEY is missing", async () => {
    const { sendAppEmail } = await import("./mailer");
    const result = await sendAppEmail({
      to: "a@example.com",
      subject: "Hello",
      html: "<p>Hi</p>",
    });
    expect(result).toEqual({ skipped: true, reason: "missing_api_key" });
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("defaults from-address to Poker Night noreply when EMAIL_FROM is unset", async () => {
    process.env.RESEND_API_KEY = "re_test";
    sendMock.mockResolvedValue({ data: { id: "msg_1" }, error: null });
    vi.resetModules();
    const { sendAppEmail, DEFAULT_EMAIL_FROM, EMAIL_REPLY_TO, getEmailFromAddress } =
      await import("./mailer");
    expect(getEmailFromAddress()).toBe(DEFAULT_EMAIL_FROM);
    expect(DEFAULT_EMAIL_FROM).toBe(
      "Poker Night <noreply@mail.pokertableclub.com>"
    );
    await sendAppEmail({
      to: "a@example.com",
      subject: "Hello",
      html: "<p>Hi</p>",
      text: "Hi",
    });
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        from: DEFAULT_EMAIL_FROM,
        to: "a@example.com",
        replyTo: EMAIL_REPLY_TO,
      })
    );
  });

  it("treats blank EMAIL_FROM as unset", async () => {
    process.env.RESEND_API_KEY = "re_test";
    process.env.EMAIL_FROM = "   ";
    sendMock.mockResolvedValue({ data: { id: "msg_blank" }, error: null });
    vi.resetModules();
    const { sendAppEmail, DEFAULT_EMAIL_FROM, getEmailFromAddress } =
      await import("./mailer");
    expect(getEmailFromAddress()).toBe(DEFAULT_EMAIL_FROM);
    await sendAppEmail({
      to: "a@example.com",
      subject: "Hello",
      html: "<p>Hi</p>",
    });
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({ from: DEFAULT_EMAIL_FROM })
    );
  });

  it("uses EMAIL_FROM when set and still sets Reply-To", async () => {
    process.env.RESEND_API_KEY = "re_test";
    process.env.EMAIL_FROM = "Custom Night <custom@mail.pokertableclub.com>";
    sendMock.mockResolvedValue({ data: { id: "msg_2" }, error: null });
    vi.resetModules();
    const { sendAppEmail, EMAIL_REPLY_TO } = await import("./mailer");
    await sendAppEmail({
      to: "a@example.com",
      subject: "Hello",
      html: "<p>Hi</p>",
    });
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "Custom Night <custom@mail.pokertableclub.com>",
        replyTo: EMAIL_REPLY_TO,
      })
    );
    expect(EMAIL_REPLY_TO).toBe("info@pokertableclub.com");
  });
});
