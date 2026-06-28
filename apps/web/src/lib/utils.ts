export function getAvatarUrl(seed: string, avatarUrl?: string | null): string {
  if (avatarUrl) return avatarUrl;
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(seed)}`;
}

export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export const LEDGER_DISCLAIMER =
  "For fun among friends. No real money is handled by this site.";
