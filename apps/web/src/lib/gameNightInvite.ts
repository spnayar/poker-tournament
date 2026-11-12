import { prisma } from "@poker/db";
import { EMAIL_RE, invitedUserCreateData } from "./register";
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
import { createEmailCallbackUrl } from "./magicLinkToken";
import { emailMaxAgeSec } from "./sendMagicLink";

export const MAX_INVITE_EMAILS = 20;
export const DISPLAY_NAME_MAX = 32;

export type PastPlayer = {
  userId: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
};

export type InvitePerson = {
  email: string;
  displayName?: string | null;
};

export type InviteEmailResult = {
  email: string;
  status: "sent" | "skipped" | "rate_limited" | "self";
  id?: string | null;
  accountCreated?: boolean;
};

export function parseInviteEmails(
  input: unknown
): { ok: true; emails: string[] } | { ok: false; error: string } {
  const people = parseInvitePeople(input);
  if (!people.ok) return people;
  return { ok: true, emails: people.people.map((p) => p.email) };
}

export function normalizeOptionalDisplayName(
  raw: unknown
): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.trim().replace(/\s+/g, " ");
  if (name.length < 2) return null;
  return name.slice(0, DISPLAY_NAME_MAX);
}

/**
 * Accepts string / string[] of emails, or `{ email, displayName? }[]`.
 */
export function parseInvitePeople(
  input: unknown
): { ok: true; people: InvitePerson[] } | { ok: false; error: string } {
  let raw: InvitePerson[] = [];

  if (typeof input === "string") {
    raw = input
      .split(/[,;\s]+/)
      .filter(Boolean)
      .map((email) => ({ email }));
  } else if (Array.isArray(input)) {
    for (const value of input) {
      if (typeof value === "string") {
        for (const part of value.split(/[,;\s]+/)) {
          if (part.trim()) raw.push({ email: part });
        }
      } else if (value && typeof value === "object" && "email" in value) {
        const email =
          typeof (value as { email: unknown }).email === "string"
            ? (value as { email: string }).email
            : "";
        const displayName = normalizeOptionalDisplayName(
          (value as { displayName?: unknown }).displayName
        );
        raw.push({ email, displayName });
      }
    }
  } else {
    return { ok: false, error: "Add at least one email" };
  }

  const people: InvitePerson[] = [];
  const seen = new Set<string>();
  for (const row of raw) {
    const email = row.email.trim().toLowerCase();
    if (!email) continue;
    if (!EMAIL_RE.test(email)) {
      return { ok: false, error: `Invalid email: ${row.email.trim()}` };
    }
    if (seen.has(email)) continue;
    seen.add(email);
    people.push({
      email,
      displayName: normalizeOptionalDisplayName(row.displayName ?? null),
    });
  }

  if (people.length === 0) {
    return { ok: false, error: "Add at least one email" };
  }
  if (people.length > MAX_INVITE_EMAILS) {
    return {
      ok: false,
      error: `At most ${MAX_INVITE_EMAILS} emails at a time`,
    };
  }
  return { ok: true, people };
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
  magicUrl?: string | null;
  isNewAccount?: boolean;
  zoomJoinUrl?: string | null;
}): string {
  const host = escapeHtml(opts.hostDisplayName);
  const night = escapeHtml(opts.nightName);
  const code = escapeHtml(opts.joinCode);
  const buyIn = escapeHtml(formatCents(opts.buyInCents));
  const zoomJoinUrl = opts.zoomJoinUrl?.trim() || null;
  const magicUrl = opts.magicUrl?.trim() || null;
  const minutes = Math.round(emailMaxAgeSec() / 60);

  return clubEmailHtml({
    heading: "Poker Night",
    innerHtml: [
      emailBody(
        `${host} invited you to <strong style="color:#e2e8f0;">${night}</strong>.`
      ),
      magicUrl
        ? [
            emailBody(
              opts.isNewAccount
                ? "Use this one-time link to create your account and sign in — no password or club invite code needed."
                : "Use this one-time link to sign in on this device, then you will land in the game night."
            ),
            emailCta(magicUrl, opts.isNewAccount ? "Create account & join" : "Sign in & join"),
            emailFinePrint(
              `This login link expires in ${minutes} minutes.`
            ),
          ].join("\n    ")
        : "",
      `<p style="margin:20px 0 8px;color:#94a3b8;font-size:13px;">Join code</p>
    <p style="margin:0;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:28px;letter-spacing:0.28em;font-weight:700;color:#34d399;">${code}</p>`,
      emailBody(`Buy-in (ledger): ${buyIn}`),
      emailCta(opts.joinUrl, "Join this game night"),
      zoomJoinUrl
        ? [
            emailBody(
              "This night has a Zoom call — join when you are ready to play."
            ),
            emailCta(zoomJoinUrl, "Join Zoom"),
          ].join("\n    ")
        : "",
      emailFinePrint(
        "Already signed in? The join link takes you straight to the lobby. New players get an account from this invite — no separate club code."
      ),
      emailFinePrint(LEDGER_DISCLAIMER),
    ]
      .filter(Boolean)
      .join("\n    "),
  });
}

export function gameNightInviteText(opts: {
  hostDisplayName: string;
  nightName: string;
  joinCode: string;
  buyInCents: number;
  joinUrl: string;
  magicUrl?: string | null;
  isNewAccount?: boolean;
  zoomJoinUrl?: string | null;
}): string {
  const lines = [
    `Poker Night`,
    `${opts.hostDisplayName} invited you to ${opts.nightName}.`,
  ];
  const magicUrl = opts.magicUrl?.trim();
  if (magicUrl) {
    const minutes = Math.round(emailMaxAgeSec() / 60);
    lines.push(
      opts.isNewAccount
        ? `Create your account and sign in (expires in ${minutes} minutes):`
        : `Sign in (expires in ${minutes} minutes):`,
      magicUrl
    );
  }
  lines.push(
    `Join code: ${opts.joinCode}`,
    `Buy-in (ledger): ${formatCents(opts.buyInCents)}`,
    `Join: ${opts.joinUrl}`
  );
  const zoomJoinUrl = opts.zoomJoinUrl?.trim();
  if (zoomJoinUrl) {
    lines.push(`Join Zoom: ${zoomJoinUrl}`);
  }
  lines.push(
    `New players get an account from this invite — no separate club code.`,
    LEDGER_DISCLAIMER
  );
  return lines.join("\n");
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

async function ensureInvitedUser(opts: {
  email: string;
  displayName?: string | null;
}): Promise<{ userId: string; created: boolean }> {
  const email = opts.email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true, displayNameSet: true },
  });
  if (existing) {
    const name = normalizeOptionalDisplayName(opts.displayName ?? null);
    if (name && existing.displayNameSet === false) {
      await prisma.user.update({
        where: { id: existing.id },
        data: { displayName: name, displayNameSet: true },
      });
    }
    return { userId: existing.id, created: false };
  }

  const name = normalizeOptionalDisplayName(opts.displayName ?? null);
  const data = invitedUserCreateData(email);
  if (name) {
    data.displayName = name;
    data.displayNameSet = true;
  }
  const row = await prisma.user.create({ data });
  return { userId: row.id, created: true };
}

export async function sendGameNightInvites(opts: {
  emails?: string[];
  people?: InvitePerson[];
  hostEmail: string;
  hostDisplayName: string;
  nightName: string;
  joinCode: string;
  buyInCents: number;
  ip: string;
  zoomJoinUrl?: string | null;
}): Promise<{ results: InviteEmailResult[]; previewHtml: string; joinUrl: string }> {
  const people: InvitePerson[] =
    opts.people ??
    (opts.emails ?? []).map((email) => ({ email: email.trim().toLowerCase() }));
  const joinUrl = inviteJoinUrl(opts.joinCode);
  const joinCallbackPath = joinPath(opts.joinCode);
  const zoomJoinUrl = opts.zoomJoinUrl?.trim() || null;
  const subject = `You're invited to ${opts.nightName}`;
  const hostEmail = opts.hostEmail.trim().toLowerCase();
  const results: InviteEmailResult[] = [];
  let previewHtml = gameNightInviteHtml({
    hostDisplayName: opts.hostDisplayName,
    nightName: opts.nightName,
    joinCode: opts.joinCode,
    buyInCents: opts.buyInCents,
    joinUrl,
    zoomJoinUrl,
  });

  for (const person of people) {
    const email = person.email.trim().toLowerCase();
    if (email === hostEmail) {
      results.push({ email, status: "self" });
      continue;
    }

    const { allowed } = await sendLinkLimiter.consume(email, opts.ip);
    if (!allowed) {
      results.push({ email, status: "rate_limited" });
      continue;
    }

    const account = await ensureInvitedUser({
      email,
      displayName: person.displayName,
    });

    const magicUrl = await createEmailCallbackUrl({
      email,
      callbackPath: joinCallbackPath,
    });

    const html = gameNightInviteHtml({
      hostDisplayName: opts.hostDisplayName,
      nightName: opts.nightName,
      joinCode: opts.joinCode,
      buyInCents: opts.buyInCents,
      joinUrl,
      magicUrl,
      isNewAccount: account.created,
      zoomJoinUrl,
    });
    const text = gameNightInviteText({
      hostDisplayName: opts.hostDisplayName,
      nightName: opts.nightName,
      joinCode: opts.joinCode,
      buyInCents: opts.buyInCents,
      joinUrl,
      magicUrl,
      isNewAccount: account.created,
      zoomJoinUrl,
    });
    previewHtml = html;

    if (!isProduction()) {
      console.log("[invite] Game night magic + join (non-prod):", {
        to: email,
        joinUrl,
        joinCode: opts.joinCode,
        magicUrl,
        accountCreated: account.created,
        hasZoom: Boolean(zoomJoinUrl),
      });
    }

    const sent = await sendAppEmail({
      to: email,
      subject,
      html,
      text,
    });

    if (sent.skipped) {
      results.push({
        email,
        status: "skipped",
        id: null,
        accountCreated: account.created,
      });
      continue;
    }
    results.push({
      email,
      status: "sent",
      id: sent.id,
      accountCreated: account.created,
    });
  }

  return { results, previewHtml, joinUrl };
}
