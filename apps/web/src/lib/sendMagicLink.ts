import { prisma } from "@poker/db";
import { sendAppEmail } from "./mailer";
import { sendLinkLimiter } from "./rateLimit";

const DEFAULT_EMAIL_MAX_AGE_SEC = 900;

export function emailMaxAgeSec(): number {
  const raw = Number(process.env["AUTH_EMAIL_MAX_AGE"]);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_EMAIL_MAX_AGE_SEC;
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

export type DeliverMagicLinkResult =
  | { status: "sent"; id: string | null }
  | {
      status: "skipped";
      reason: "unknown_email" | "rate_limited" | "missing_api_key";
    };

export function magicLinkHtml(url: string, minutes: number): string {
  return `<div style="font-family:Helvetica,Arial,sans-serif;background:#0f172a;color:#e2e8f0;padding:24px;">
  <div style="max-width:480px;margin:0 auto;background:#1e293b;border-radius:16px;padding:32px;border:1px solid #334155;">
    <h1 style="color:#f8fafc;font-size:22px;margin:0 0 12px;">Poker Night</h1>
    <p style="color:#94a3b8;font-size:14px;line-height:1.5;">Use this one-time link to sign in. It expires in ${minutes} minutes.</p>
    <p style="margin:28px 0;"><a href="${url}" style="background:#059669;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;display:inline-block;">Sign in</a></p>
    <p style="color:#64748b;font-size:12px;line-height:1.4;">If you did not request this, you can ignore the email.</p>
  </div>
</div>`;
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
