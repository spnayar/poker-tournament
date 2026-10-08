const STORAGE_PREFIX = "poker-recap-preview:";

export function storeRecapPreviewHtml(
  tournamentId: string,
  html: string | null | undefined
): void {
  if (typeof window === "undefined") return;
  const key = `${STORAGE_PREFIX}${tournamentId}`;
  if (!html) {
    sessionStorage.removeItem(key);
    return;
  }
  sessionStorage.setItem(key, html);
}

export function readRecapPreviewHtml(tournamentId: string): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(`${STORAGE_PREFIX}${tournamentId}`);
}

export function clearRecapPreviewHtml(tournamentId: string): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(`${STORAGE_PREFIX}${tournamentId}`);
}
