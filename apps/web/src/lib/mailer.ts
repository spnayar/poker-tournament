import { Resend } from "resend";

/** Used until mail.pokertableclub.com is verified in Resend. */
export const RESEND_TEST_FROM = "Poker Night <beth.t@example.com>";

export type SendAppEmailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

export type SendAppEmailResult =
  | { skipped: true; reason: "missing_api_key" }
  | { skipped: false; id: string | null };

export function getEmailFromAddress(): string {
  const from = process.env["EMAIL_FROM"]?.trim();
  if (from) return from;
  return RESEND_TEST_FROM;
}

/**
 * Thin Resend wrapper for app mail. Login is the only sender today;
 * later results/invite mail can reuse this.
 */
export async function sendAppEmail(
  input: SendAppEmailInput
): Promise<SendAppEmailResult> {
  const apiKey = process.env["RESEND_API_KEY"]?.trim();
  const from = getEmailFromAddress();

  if (!apiKey) {
    console.warn("[mailer] RESEND_API_KEY missing; email not sent", {
      to: input.to,
      subject: input.subject,
    });
    return { skipped: true, reason: "missing_api_key" };
  }

  const resend = new Resend(apiKey);
  const result = await resend.emails.send({
    from,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
  });

  if (result.error) {
    console.error("[mailer] Resend error", result.error);
    throw new Error(result.error.message);
  }

  return { skipped: false, id: result.data?.id ?? null };
}
