import { Resend } from "resend";

/** Production from-address for the verified mail.pokertableclub.com Resend domain. Overridable via EMAIL_FROM. */
export const DEFAULT_EMAIL_FROM =
  "Poker Night <noreply@mail.pokertableclub.com>";

/** Human inbox (M365). Replies to app mail land here, not on the noreply sender. */
export const EMAIL_REPLY_TO = "info@pokertableclub.com";

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
  return DEFAULT_EMAIL_FROM;
}

/**
 * Thin Resend wrapper for app mail (magic-link login and game-night invites).
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
    replyTo: EMAIL_REPLY_TO,
  });

  if (result.error) {
    console.error("[mailer] Resend error", result.error);
    throw new Error(result.error.message);
  }

  return { skipped: false, id: result.data?.id ?? null };
}
