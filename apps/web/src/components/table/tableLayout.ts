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
  total: number
): { x: number; y: number } {
  const angle = (visualIndex / total) * 2 * Math.PI - Math.PI / 2;
  const rx = 42;
  const ry = 38;
  return {
    x: 50 + rx * Math.cos(angle),
    y: 50 + ry * Math.sin(angle),
  };
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
  viewerSortedSeatIndex: number
): { x: number; y: number } {
  const visualIndex = getVisualSeatIndex(
    sortedSeatIndex,
    total,
    viewerSortedSeatIndex
  );
  return getSeatPosition(visualIndex, total);
}
