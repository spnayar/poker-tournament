import { resolveAvatarUrl } from "./avatars";

export function getAvatarUrl(seed: string, avatarUrl?: string | null): string {
  const resolved = resolveAvatarUrl(avatarUrl);
  if (resolved) return resolved;
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(seed)}`;
}

/** Format ledger cents as currency. Negatives render as `-$8.00`, not `$-8.00`. */
export function formatCents(cents: number): string {
  const abs = (Math.abs(cents) / 100).toFixed(2);
  return cents < 0 ? `-$${abs}` : `$${abs}`;
}

export const LEDGER_DISCLAIMER =
  "For fun among friends. No real money is handled by this site.";
