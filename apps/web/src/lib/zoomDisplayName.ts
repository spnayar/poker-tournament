/** Normalize Zoom ↔ seat display names for soft auto-mapping. */
export function normalizeZoomDisplayName(name: string): string {
  return name
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Map Zoom active-speaker display names onto seat userIds.
 * Medium confidence only — host remap is a later Phase 3 safety net.
 */
export function matchSpeakerUserIds(
  seats: { userId: string; displayName: string }[],
  speakers: { displayName?: string | null }[]
): string[] {
  const byName = new Map<string, string>();
  for (const seat of seats) {
    const key = normalizeZoomDisplayName(seat.displayName);
    if (key) byName.set(key, seat.userId);
  }
  const matched = new Set<string>();
  for (const speaker of speakers) {
    if (!speaker.displayName) continue;
    const userId = byName.get(normalizeZoomDisplayName(speaker.displayName));
    if (userId) matched.add(userId);
  }
  return [...matched];
}
