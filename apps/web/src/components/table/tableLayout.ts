/** Visual index nearest 6 o'clock (bottom center). */
export function bottomSeatVisualIndex(total: number): number {
  return Math.round(total / 2) % total;
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

function ellipseRadii(total: number, compact: boolean): { rx: number; ry: number } {
  const crowded = total >= 6;
  if (compact) {
    // Keep radius generous enough that 6–7 seats don't collapse inward.
    return { rx: crowded ? 36 : 34, ry: crowded ? 30 : 28 };
  }
  return { rx: crowded ? 41 : 42, ry: crowded ? 34 : 35 };
}

export function heroBottomY(compact = false): number {
  return compact ? 70 : 74;
}

/**
 * Ellipse seat positions. The viewer is pinned to true 6 o'clock separately
 * so hole cards stay clear of the container clip edge.
 */
export function getSeatPosition(
  visualIndex: number,
  total: number,
  compact = false
): { x: number; y: number } {
  const angle = (visualIndex / total) * 2 * Math.PI - Math.PI / 2;
  const { rx, ry } = ellipseRadii(total, compact);
  let y = 50 + ry * Math.sin(angle);
  const x = 50 + rx * Math.cos(angle);

  const maxBottomY = compact ? 78 : 82;
  const minTopY = compact ? 18 : 14;
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
  else if (y > 0.55) ty = "-90%";
  else if (y > 0.2) ty = "-78%";
  else if (y > 0.05) ty = "-65%";
  return `translate(-50%, ${ty})`;
}

/** Force the viewer seat onto exact 6 o'clock regardless of odd seat counts. */
export function seatAnchorTransformForViewer(
  visualIndex: number,
  total: number,
  isViewer: boolean
): string {
  if (isViewer) return "translate(-50%, -92%)";
  return seatAnchorTransform(visualIndex, total);
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
): { x: number; y: number; visualIndex: number; isViewer: boolean } {
  const visualIndex = getVisualSeatIndex(
    sortedSeatIndex,
    total,
    viewerSortedSeatIndex
  );
  const isViewer =
    viewerSortedSeatIndex >= 0 && sortedSeatIndex === viewerSortedSeatIndex;

  if (isViewer) {
    return {
      x: 50,
      y: heroBottomY(compact),
      visualIndex,
      isViewer: true,
    };
  }

  const pos = getSeatPosition(visualIndex, total, compact);
  // Nudge seats that land near 6 o'clock away from the pinned hero.
  if (Math.abs(pos.x - 50) < 8 && pos.y > heroBottomY(compact) - 10) {
    pos.x = pos.x < 50 ? 38 : 62;
    pos.y = Math.min(pos.y, heroBottomY(compact) - 8);
  }
  return { ...pos, visualIndex, isViewer: false };
}
