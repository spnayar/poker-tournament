/**
 * Meeting SDK mirror join display name — always the club brand, never the
 * signed-in seat name. Seat / Action Log identity stays elsewhere in the app.
 *
 * Avatar note: Component View `client.join()` has no participant avatar /
 * userPhoto field (only userName, userEmail, zak, …). Avatars come from the
 * Zoom account profile when joining with a ZAK — not something we can set for
 * this anonymous mirror join. Logo asset: `/poker-table-club-logo.png`.
 */
export const ZOOM_MIRROR_PARTICIPANT_NAME = "The Poker Table Club";

/** Normalize Zoom ↔ seat display names for soft auto-mapping. */
export function normalizeZoomDisplayName(
  name: string | null | undefined
): string {
  if (typeof name !== "string" || !name) return "";
  return name
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function speakerLabel(
  speaker: { displayName?: string | null; userName?: string | null } | null | undefined
): string {
  if (!speaker || typeof speaker !== "object") return "";
  return speaker.displayName || speaker.userName || "";
}

/**
 * Map Zoom active-speaker display names onto seat userIds.
 * Medium confidence only — host remap is a later Phase 3 safety net.
 * Tolerates missing seats, blank names, and Zoom payloads that use userName.
 */
export function matchSpeakerUserIds(
  seats: { userId?: string | null; displayName?: string | null }[] | null | undefined,
  speakers:
    | { displayName?: string | null; userName?: string | null }[]
    | null
    | undefined
): string[] {
  const byName = new Map<string, string>();
  for (const seat of seats ?? []) {
    if (!seat || typeof seat.userId !== "string" || !seat.userId) continue;
    const key = normalizeZoomDisplayName(seat.displayName);
    if (key) byName.set(key, seat.userId);
  }
  const matched = new Set<string>();
  for (const speaker of speakers ?? []) {
    const label = speakerLabel(speaker);
    if (!label) continue;
    const userId = byName.get(normalizeZoomDisplayName(label));
    if (userId) matched.add(userId);
  }
  return [...matched];
}
