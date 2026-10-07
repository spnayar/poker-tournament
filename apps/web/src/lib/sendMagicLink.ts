import { prisma } from "@poker/db";
import { sendAppEmail } from "./mailer";
import { sendLinkLimiter } from "./rateLimit";
import {
  CLUB_LOGO_FALLBACK_ORIGIN,
  clubEmailHtml,
  clubLogoAbsoluteUrl,
  emailBody,
  emailCta,
  emailFinePrint,
  isProduction,
} from "./emailLayout";

export { CLUB_LOGO_FALLBACK_ORIGIN, clubLogoAbsoluteUrl, isProduction };

const DEFAULT_EMAIL_MAX_AGE_SEC = 900;

export function emailMaxAgeSec(): number {
  const raw = Number(process.env["AUTH_EMAIL_MAX_AGE"]);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_EMAIL_MAX_AGE_SEC;
}

export type DeliverMagicLinkResult =
  | { status: "sent"; id: string | null }
  | {
      status: "skipped";
      reason: "unknown_email" | "rate_limited" | "missing_api_key";
    };

export function magicLinkHtml(url: string, minutes: number): string {
  return clubEmailHtml({
    heading: "Poker Night",
    innerHtml: [
      emailBody(
        `Use this one-time link to sign in. It expires in ${minutes} minutes.`
      ),
      emailCta(url, "Sign in"),
      emailFinePrint("If you did not request this, you can ignore the email."),
    ].join("\n    "),
  });
}

/**
 * NextAuth Email provider send hook.
 * Unknown emails and rate limits skip silently (no account enumeration).
 * Missing RESEND_API_KEY skips in non-prod (console URL is the fallback) and
 * throws in production. Resend API errors propagate so NextAuth can fail the
 * sign-in request instead of showing "check your email" after a silent miss.
 */
export async function deliverMagicLink(opts: {
  identifier: string;
  url: string;
  ip: string;
}): Promise<DeliverMagicLinkResult> {
  const email = opts.identifier.trim().toLowerCase();
  const { allowed } = await sendLinkLimiter.consume(email, opts.ip);
  if (!allowed) {
    console.warn("[auth] Magic-link send rate-limited", { email });
    return { status: "skipped", reason: "rate_limited" };
  }

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (!existing) {
    return { status: "skipped", reason: "unknown_email" };
  }

  if (!isProduction()) {
    console.log("[auth] Magic link callback URL (non-prod):", opts.url);
  }

  const minutes = Math.round(emailMaxAgeSec() / 60);
  const result = await sendAppEmail({
    to: email,
    subject: "Your Poker Night login link",
    html: magicLinkHtml(opts.url, minutes),
    text: `Sign in to Poker Night (expires in ${minutes} minutes):\n${opts.url}\n`,
  });

  if (result.skipped) {
    if (isProduction()) {
      throw new Error(
        "RESEND_API_KEY is missing; magic-link email was not sent"
      );
    }
    console.warn(
      "[auth] Magic-link email skipped (no RESEND_API_KEY); use the console URL above"
    );
    return { status: "skipped", reason: "missing_api_key" };
  }

  return { status: "sent", id: result.id };
}
