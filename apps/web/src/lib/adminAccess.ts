import type { AccountStatus, User, UserRole } from "@poker/db";

export const BOOTSTRAP_ADMIN_EMAILS = [
  "spnayar@gmail.com",
  "info@pokertableclub.com",
] as const;

export function parseAdminEmails(
  envValue: string | undefined = process.env["ADMIN_EMAILS"]
): string[] {
  const extras = (envValue ?? "")
    .split(",")
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
  return [...new Set([...BOOTSTRAP_ADMIN_EMAILS, ...extras])];
}

export function isAllowlistedAdminEmail(
  email: string | null | undefined
): boolean {
  if (!email) return false;
  return parseAdminEmails().includes(email.trim().toLowerCase());
}

export function isAdminUser(user: {
  role: UserRole;
  email: string;
}): boolean {
  return user.role === "ADMIN" || isAllowlistedAdminEmail(user.email);
}

export function canDeleteAccount(opts: {
  actorId: string;
  target: { id: string; email: string; role: UserRole };
}): { ok: true } | { ok: false; reason: string } {
  if (opts.actorId === opts.target.id) {
    return { ok: false, reason: "You cannot remove your own account" };
  }
  if (isAdminUser(opts.target)) {
    return { ok: false, reason: "Admin accounts cannot be removed" };
  }
  return { ok: true };
}

/**
 * Phrase admins must type to run the legacy password-era purge.
 * Kept in one place so the UI and API stay in lockstep.
 */
export const LEGACY_PURGE_CONFIRM_PHRASE = "PURGE LEGACY ACCOUNTS";

/**
 * Pre-magic-link leftover accounts: still have a password hash from the old
 * credentials era, and have never completed a magic-link sign-in
 * (`lastLoginAt` / `loginCount` are only written on magic-link success).
 * Admins and allowlisted emails are never candidates.
 */
export function isLegacyPasswordEraCandidate(user: {
  email: string;
  role: UserRole;
  passwordHash: string | null | undefined;
  lastLoginAt: Date | string | null | undefined;
  loginCount: number;
}): boolean {
  if (!user.passwordHash) return false;
  if (user.lastLoginAt != null) return false;
  if (user.loginCount > 0) return false;
  if (isAdminUser(user)) return false;
  return true;
}

export function parseAccountStatus(
  value: unknown
): AccountStatus | null {
  if (value === "FREE" || value === "PAID") return value;
  if (value === "free") return "FREE";
  if (value === "paid") return "PAID";
  return null;
}

export type AdminActor = Pick<
  User,
  "id" | "email" | "displayName" | "role" | "accountStatus"
>;
