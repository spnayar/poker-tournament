/** Visual index that places a seat at 6 o'clock (bottom center). */
export function bottomSeatVisualIndex(total: number): number {
  return Math.floor(total / 2);
}

/**
 * Map a seat's index in seatId-sorted order to a visual index,
 * rotating the table so the viewer's seat sits at 6 o'clock.
 */
export function getVisualSeatIndex(
  sortedSeatIndex: number,
  total: number,
  viewerSortedSeatIndex: number
): number {
  if (viewerSortedSeatIndex < 0) return sortedSeatIndex;
  const bottom = bottomSeatVisualIndex(total);
  return (
    (sortedSeatIndex - viewerSortedSeatIndex + bottom + total) % total
  );
}

/**
 * Ellipse seat positions. Bottom (hero) seats sit higher on the felt so
 * hole cards clear the table container edge under overflow clipping.
 */
export function getSeatPosition(
  visualIndex: number,
  total: number,
  compact = false
): { x: number; y: number } {
  const angle = (visualIndex / total) * 2 * Math.PI - Math.PI / 2;
  // Slightly tighter ellipse with 6–7 players to reduce seat overlap.
  const crowded = total >= 6;
  const rx = compact ? (crowded ? 32 : 34) : crowded ? 40 : 42;
  const ry = compact ? (crowded ? 26 : 28) : crowded ? 32 : 35;
  let y = 50 + ry * Math.sin(angle);
  const x = 50 + rx * Math.cos(angle);

  // Keep bottom seats above the clip line so hero hole cards stay visible.
  const maxBottomY = compact ? 68 : 72;
  const minTopY = compact ? 20 : 16;
  y = Math.min(maxBottomY, Math.max(minTopY, y));

  return { x, y };
}

/**
 * Anchor transforms:
 * - Top seats: hang downward so chrome clears host blind controls
 * - Bottom seats: hang upward so hole cards stay inside the felt box
 */
export function seatAnchorTransform(visualIndex: number, total: number): string {
  const angle = (visualIndex / total) * 2 * Math.PI - Math.PI / 2;
  const y = Math.sin(angle);
  let ty = "-50%";
  if (y < -0.25) ty = "-18%";
  else if (y > 0.25) ty = "-88%";
  else if (y > 0.05) ty = "-70%";
  return `translate(-50%, ${ty})`;
}

export function getViewerSortedSeatIndex(
  sortedSeats: { seatId: number; userId: string }[],
  viewerUserId: string,
  viewerSeatId?: number | null
): number {
  const byUser = sortedSeats.findIndex((s) => s.userId === viewerUserId);
  if (byUser >= 0) return byUser;
  if (viewerSeatId != null) {
    return sortedSeats.findIndex((s) => s.seatId === viewerSeatId);
  }
  return -1;
}

export function getSeatPositionForViewer(
  sortedSeatIndex: number,
  total: number,
  viewerSortedSeatIndex: number,
  compact = false
): { x: number; y: number; visualIndex: number } {
  const visualIndex = getVisualSeatIndex(
    sortedSeatIndex,
    total,
    viewerSortedSeatIndex
  );
  const pos = getSeatPosition(visualIndex, total, compact);
  return { ...pos, visualIndex };
}
