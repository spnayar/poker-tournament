import { prisma } from "@poker/db";
import { EMAIL_RE } from "./register";
import { sendAppEmail } from "./mailer";
import { sendLinkLimiter } from "./rateLimit";
import { formatCents, LEDGER_DISCLAIMER } from "./utils";
import {
  absoluteAppUrl,
  clubEmailHtml,
  emailBody,
  emailCta,
  emailFinePrint,
  escapeHtml,
} from "./emailLayout";
import { isProduction } from "./emailLayout";
import { joinPath } from "./joinNight";

export const MAX_INVITE_EMAILS = 20;

export type PastPlayer = {
  userId: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
};

export type InviteEmailResult = {
  email: string;
  status: "sent" | "skipped" | "rate_limited" | "self";
  id?: string | null;
};

export function parseInviteEmails(
  input: unknown
): { ok: true; emails: string[] } | { ok: false; error: string } {
  let raw: string[] = [];
  if (typeof input === "string") {
    raw = input.split(/[,;\s]+/);
  } else if (Array.isArray(input)) {
    raw = input.flatMap((value) =>
      typeof value === "string" ? value.split(/[,;\s]+/) : []
    );
  } else {
    return { ok: false, error: "Add at least one email" };
  }

  const emails: string[] = [];
  const seen = new Set<string>();
  for (const part of raw) {
    const email = part.trim().toLowerCase();
    if (!email) continue;
    if (!EMAIL_RE.test(email)) {
      return { ok: false, error: `Invalid email: ${part.trim()}` };
    }
    if (seen.has(email)) continue;
    seen.add(email);
    emails.push(email);
  }

  if (emails.length === 0) {
    return { ok: false, error: "Add at least one email" };
  }
  if (emails.length > MAX_INVITE_EMAILS) {
    return {
      ok: false,
      error: `At most ${MAX_INVITE_EMAILS} emails at a time`,
    };
  }
  return { ok: true, emails };
}

export function inviteJoinUrl(joinCode: string): string {
  return absoluteAppUrl(joinPath(joinCode));
}

export function gameNightInviteHtml(opts: {
  hostDisplayName: string;
  nightName: string;
  joinCode: string;
  buyInCents: number;
  joinUrl: string;
}): string {
  const host = escapeHtml(opts.hostDisplayName);
  const night = escapeHtml(opts.nightName);
  const code = escapeHtml(opts.joinCode);
  const buyIn = escapeHtml(formatCents(opts.buyInCents));

  return clubEmailHtml({
    heading: "Poker Night",
    innerHtml: [
      emailBody(
        `${host} invited you to <strong style="color:#e2e8f0;">${night}</strong>.`
      ),
      `<p style="margin:20px 0 8px;color:#94a3b8;font-size:13px;">Join code</p>
    <p style="margin:0;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:28px;letter-spacing:0.28em;font-weight:700;color:#34d399;">${code}</p>`,
      emailBody(`Buy-in (ledger): ${buyIn}`),
      emailCta(opts.joinUrl, "Join this game night"),
      emailFinePrint(
        "If you are not signed in, this link opens a login page and we email a magic link. New players still need the club invite code to create an account. After you sign in you land in this game night."
      ),
      emailFinePrint(LEDGER_DISCLAIMER),
    ].join("\n    "),
  });
}

export function gameNightInviteText(opts: {
  hostDisplayName: string;
  nightName: string;
  joinCode: string;
  buyInCents: number;
  joinUrl: string;
}): string {
  return [
    `Poker Night`,
    `${opts.hostDisplayName} invited you to ${opts.nightName}.`,
    `Join code: ${opts.joinCode}`,
    `Buy-in (ledger): ${formatCents(opts.buyInCents)}`,
    `Join: ${opts.joinUrl}`,
    `If you are not signed in, we will email a login link. New players still need the club invite code to create an account.`,
    LEDGER_DISCLAIMER,
  ].join("\n");
}

export async function listPastPlayers(opts: {
  userId: string;
  excludeUserIds?: string[];
}): Promise<PastPlayer[]> {
  const exclude = [opts.userId, ...(opts.excludeUserIds ?? [])];
  const rows = await prisma.tournamentPlayer.findMany({
    where: {
      userId: { notIn: exclude },
      tournament: {
        OR: [
          { hostUserId: opts.userId },
          { players: { some: { userId: opts.userId } } },
        ],
      },
    },
    include: {
      user: {
        select: {
          id: true,
          displayName: true,
          email: true,
          avatarUrl: true,
        },
      },
    },
    orderBy: { joinedAt: "desc" },
    take: 120,
  });

  const seen = new Set<string>();
  const out: PastPlayer[] = [];
  for (const row of rows) {
    const email = row.user.email.trim().toLowerCase();
    if (!email || seen.has(email)) continue;
    seen.add(email);
    out.push({
      userId: row.user.id,
      displayName: row.user.displayName,
      email,
      avatarUrl: row.user.avatarUrl,
    });
    if (out.length >= 30) break;
  }
  return out;
}

export async function sendGameNightInvites(opts: {
  emails: string[];
  hostEmail: string;
  hostDisplayName: string;
  nightName: string;
  joinCode: string;
  buyInCents: number;
  ip: string;
}): Promise<{ results: InviteEmailResult[]; previewHtml: string; joinUrl: string }> {
  const joinUrl = inviteJoinUrl(opts.joinCode);
  const html = gameNightInviteHtml({
    hostDisplayName: opts.hostDisplayName,
    nightName: opts.nightName,
    joinCode: opts.joinCode,
    buyInCents: opts.buyInCents,
    joinUrl,
  });
  const text = gameNightInviteText({
    hostDisplayName: opts.hostDisplayName,
    nightName: opts.nightName,
    joinCode: opts.joinCode,
    buyInCents: opts.buyInCents,
    joinUrl,
  });
  const subject = `You're invited to ${opts.nightName}`;
  const hostEmail = opts.hostEmail.trim().toLowerCase();
  const results: InviteEmailResult[] = [];

  for (const email of opts.emails) {
    if (email === hostEmail) {
      results.push({ email, status: "self" });
      continue;
    }

    const { allowed } = await sendLinkLimiter.consume(email, opts.ip);
    if (!allowed) {
      results.push({ email, status: "rate_limited" });
      continue;
    }

    if (!isProduction()) {
      console.log("[invite] Game night join URL (non-prod):", {
        to: email,
        joinUrl,
        joinCode: opts.joinCode,
      });
    }

    const sent = await sendAppEmail({
      to: email,
      subject,
      html,
      text,
    });

    if (sent.skipped) {
      results.push({ email, status: "skipped", id: null });
      continue;
    }
    results.push({ email, status: "sent", id: sent.id });
  }

  return { results, previewHtml: html, joinUrl };
}
