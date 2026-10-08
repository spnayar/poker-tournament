import { prisma } from "@poker/db";
import { EMAIL_RE, invitedUserCreateData } from "./register";
import { sendAppEmail } from "./mailer";
import { sendLinkLimiter } from "./rateLimit";
import {
  clubEmailHtml,
  emailBody,
  emailCta,
  emailFinePrint,
  isProduction,
} from "./emailLayout";
import { createEmailCallbackUrl } from "./magicLinkToken";
import { emailMaxAgeSec } from "./sendMagicLink";

export type AdminInviteParseResult =
  | { ok: true; email: string }
  | { ok: false; error: string };

export function parseAdminInviteEmail(body: unknown): AdminInviteParseResult {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Enter a valid email" };
  }
  const raw = body as Record<string, unknown>;
  const email =
    typeof raw.email === "string" ? raw.email.trim().toLowerCase() : "";
  if (!email) return { ok: false, error: "Enter an email" };
  if (!EMAIL_RE.test(email)) return { ok: false, error: "Enter a valid email" };
  return { ok: true, email };
}

export const ADMIN_INVITE_SUBJECT = "Welcome to the Poker Table Club";
export const ADMIN_INVITE_CTA = "Go to the Poker Table Club";

export function adminInviteHtml(url: string, minutes: number): string {
  return clubEmailHtml({
    heading: null,
    innerHtml: [
      emailBody(
        "You are invited to Poker Table Club. Use this one-time link to create your account and sign in. No invite code needed."
      ),
      emailCta(url, ADMIN_INVITE_CTA),
      emailFinePrint(
        `This link expires in ${minutes} minutes. If you were not expecting this, you can ignore the email.`
      ),
    ].join("\n    "),
  });
}

export function adminInviteText(url: string, minutes: number): string {
  return [
    "You are invited to Poker Table Club. This link creates your account and signs you in — no invite code needed.",
    `${ADMIN_INVITE_CTA} (expires in ${minutes} minutes):`,
    url,
  ].join("\n");
}

export type AdminInviteResult =
  | {
      status: "created" | "exists";
      email: string;
      userId: string;
      sent: "sent" | "skipped";
    }
  | { status: "rate_limited"; email: string };

/**
 * Admin invite is the authorization: create the user if needed, then email a
 * magic link. Unknown emails no longer need `friends-only`.
 */
export async function inviteUserFromAdmin(opts: {
  email: string;
  ip: string;
}): Promise<AdminInviteResult> {
  const email = opts.email.trim().toLowerCase();
  const { allowed } = await sendLinkLimiter.consume(email, opts.ip);
  if (!allowed) {
    return { status: "rate_limited", email };
  }

  let user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  let created = false;
  if (!user) {
    const row = await prisma.user.create({
      data: invitedUserCreateData(email),
    });
    user = { id: row.id };
    created = true;
  }

  const url = await createEmailCallbackUrl({ email });
  const minutes = Math.round(emailMaxAgeSec() / 60);

  if (!isProduction()) {
    console.log("[admin] Invite magic-link URL (non-prod):", { email, url });
  }

  const sent = await sendAppEmail({
    to: email,
    subject: ADMIN_INVITE_SUBJECT,
    html: adminInviteHtml(url, minutes),
    text: adminInviteText(url, minutes),
  });

  return {
    status: created ? "created" : "exists",
    email,
    userId: user.id,
    sent: sent.skipped ? "skipped" : "sent",
  };
}
