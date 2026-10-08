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
    return { rx: crowded ? 38 : 34, ry: crowded ? 32 : 28 };
  }
  return { rx: crowded ? 43 : 42, ry: crowded ? 36 : 35 };
}

export function heroBottomY(compact = false): number {
  // Anchor at the bottom of the felt; seat uses translateY(-100%) so the
  // hole-card row sits on this line and the avatar stacks upward.
  return compact ? 92 : 94;
}

/**
 * Ellipse seat positions for non-hero seats. Angles skip the reserved
 * bottom arc so neighbors don't sit on top of the pinned viewer.
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

  const maxBottomY = heroBottomY(compact) - 6;
  const minTopY = compact ? 16 : 12;
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
  if (isViewer) return "translate(-50%, -100%)";
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

/**
 * Place opponents on an open arc that leaves the bottom for the hero.
 * visualIndex 0 is top; hero is excluded and pinned to 6 o'clock.
 */
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

  if (isViewer || viewerSortedSeatIndex < 0) {
    if (isViewer) {
      return {
        x: 50,
        y: heroBottomY(compact),
        visualIndex,
        isViewer: true,
      };
    }
    const pos = getSeatPosition(visualIndex, total, compact);
    return { ...pos, visualIndex, isViewer: false };
  }

  // Re-index the other seats across the top arc (exclude bottom).
  const others = total - 1;
  const orderAmongOthers =
    (sortedSeatIndex - viewerSortedSeatIndex - 1 + total) % total;
  // Sweep from ~200° to ~-20° (left-bottomish through top to right-bottomish),
  // never occupying exact 6 o'clock.
  const start = (-Math.PI / 2) + (Math.PI * 0.28);
  const end = (-Math.PI / 2) + (Math.PI * 1.72);
  const t = others <= 1 ? 0.5 : orderAmongOthers / (others - 1);
  const angle = start + (end - start) * t;
  const { rx, ry } = ellipseRadii(total, compact);
  let x = 50 + rx * Math.cos(angle);
  let y = 50 + ry * Math.sin(angle);
  y = Math.min(heroBottomY(compact) - 8, Math.max(compact ? 16 : 12, y));

  return { x, y, visualIndex, isViewer: false };
}
