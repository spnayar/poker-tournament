import { EMAIL_RE } from "./register";
import type { PastPlayer } from "./gameNightInvite";

export type InviteDraft = {
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
};

export function normalizeInviteEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidInviteEmail(raw: string): boolean {
  const email = normalizeInviteEmail(raw);
  return email.length > 0 && EMAIL_RE.test(email);
}

export function inviteFromPastPlayer(player: PastPlayer): InviteDraft {
  return {
    email: normalizeInviteEmail(player.email),
    displayName: player.displayName,
    avatarUrl: player.avatarUrl,
  };
}

export function inviteFromTypedEmail(
  raw: string,
  suggestions: PastPlayer[] = []
): InviteDraft | null {
  const email = normalizeInviteEmail(raw);
  if (!isValidInviteEmail(email)) return null;
  const known = suggestions.find(
    (p) => normalizeInviteEmail(p.email) === email
  );
  if (known) return inviteFromPastPlayer(known);
  return { email, displayName: null, avatarUrl: null };
}

/** Adds a person to the pending-send list. No-op (same list) if already present. */
export function addInvite(list: InviteDraft[], invite: InviteDraft): InviteDraft[] {
  const email = normalizeInviteEmail(invite.email);
  if (!isValidInviteEmail(email)) return list;
  if (list.some((row) => row.email === email)) return list;
  return [...list, { ...invite, email }];
}

export function addInviteFromEmail(
  list: InviteDraft[],
  raw: string,
  suggestions: PastPlayer[] = []
): { list: InviteDraft[]; ok: boolean } {
  const invite = inviteFromTypedEmail(raw, suggestions);
  if (!invite) return { list, ok: false };
  return { list: addInvite(list, invite), ok: true };
}

export function removeInvite(list: InviteDraft[], email: string): InviteDraft[] {
  const target = normalizeInviteEmail(email);
  return list.filter((row) => row.email !== target);
}

export function inviteEmails(list: InviteDraft[]): string[] {
  return list.map((row) => row.email);
}

export function hasInvite(list: InviteDraft[], email: string): boolean {
  const target = normalizeInviteEmail(email);
  return list.some((row) => row.email === target);
}
