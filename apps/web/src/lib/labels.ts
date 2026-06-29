/** User-facing terminology: Game Night (container) → Tournament (single session). */

export function formatSessionLabel(gameNumber: number): string {
  return `Tournament ${gameNumber}`;
}

export function formatSessionLabelShort(gameNumber: number): string {
  return `Tournament #${gameNumber}`;
}

export function formatSessionHistoryName(
  gameNightName: string,
  gameNumber: number
): string {
  return `${gameNightName} — ${formatSessionLabel(gameNumber)}`;
}
