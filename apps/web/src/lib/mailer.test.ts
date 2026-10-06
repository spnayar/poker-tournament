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

  it("uses Resend onboarding from-address when EMAIL_FROM is unset", async () => {
    process.env.RESEND_API_KEY = "re_test";
    sendMock.mockResolvedValue({ data: { id: "msg_1" }, error: null });
    vi.resetModules();
    const { sendAppEmail, RESEND_TEST_FROM, getEmailFromAddress } =
      await import("./mailer");
    expect(getEmailFromAddress()).toBe(RESEND_TEST_FROM);
    await sendAppEmail({
      to: "a@example.com",
      subject: "Hello",
      html: "<p>Hi</p>",
      text: "Hi",
    });
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        from: RESEND_TEST_FROM,
        to: "a@example.com",
      })
    );
  });

  it("uses EMAIL_FROM when set", async () => {
    process.env.RESEND_API_KEY = "re_test";
    process.env.EMAIL_FROM = "Poker Night <noreply@mail.pokertableclub.com>";
    sendMock.mockResolvedValue({ data: { id: "msg_2" }, error: null });
    vi.resetModules();
    const { sendAppEmail } = await import("./mailer");
    await sendAppEmail({
      to: "a@example.com",
      subject: "Hello",
      html: "<p>Hi</p>",
    });
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "Poker Night <noreply@mail.pokertableclub.com>",
      })
    );
  });
});
