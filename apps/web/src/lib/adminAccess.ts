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
