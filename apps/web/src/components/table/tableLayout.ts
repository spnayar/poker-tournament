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

export function getSeatPosition(
  visualIndex: number,
  total: number,
  compact = false
): { x: number; y: number } {
  const angle = (visualIndex / total) * 2 * Math.PI - Math.PI / 2;
  const rx = compact ? 34 : 42;
  const ry = compact ? 30 : 38;
  let y = 50 + ry * Math.sin(angle);
  if (compact) {
    y = Math.min(86, Math.max(22, y));
  }
  return {
    x: 50 + rx * Math.cos(angle),
    y,
  };
}

/** Shift the seat stack so top seats hang down and bottom seats hang up. */
export function seatAnchorTransform(visualIndex: number, total: number): string {
  const angle = (visualIndex / total) * 2 * Math.PI - Math.PI / 2;
  const y = Math.sin(angle);
  const ty = y < -0.25 ? "-18%" : y > 0.25 ? "-78%" : "-50%";
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
