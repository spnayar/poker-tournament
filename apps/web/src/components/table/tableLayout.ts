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
    // Keep rx inside the felt so pods aren't clipped; ry spreads vertical gaps.
    return { rx: crowded ? 40 : 38, ry: crowded ? 34 : 30 };
  }
  return { rx: crowded ? 44 : 43, ry: crowded ? 36 : 35 };
}

export function heroBottomY(compact = false): number {
  // Anchor at the bottom of the felt; seat uses translateY(-100%) so the
  // hole-card row sits on this line and the avatar stacks upward.
  return compact ? 97 : 95;
}

/**
 * Open arc for opponents: ~8 o'clock through 12 to ~4 o'clock.
 * Must never pass through 6 o'clock (π/2) — that was stacking neighbors on the hero.
 */
export function opponentArcAngles(others: number, compact = false): number[] {
  if (others <= 0) return [];
  // Phones need more clearance so side pods clear the hero card stack.
  const bottomClearance = Math.PI * (compact ? 0.5 : 0.38);
  const start = Math.PI / 2 + bottomClearance;
  const end = Math.PI / 2 + 2 * Math.PI - bottomClearance;
  if (others === 1) return [start + (end - start) * 0.5];
  return Array.from({ length: others }, (_, i) => {
    const t = i / (others - 1);
    return start + (end - start) * t;
  });
}

function clampOpponentPoint(
  x: number,
  y: number,
  compact: boolean
): { x: number; y: number } {
  const maxY = heroBottomY(compact) - (compact ? 32 : 18);
  const minY = compact ? 18 : 12;
  const minX = compact ? 12 : 8;
  const maxX = 100 - minX;
  return {
    x: Math.min(maxX, Math.max(minX, x)),
    y: Math.min(maxY, Math.max(minY, y)),
  };
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
  const minTopY = compact ? 18 : 12;
  y = Math.min(maxBottomY, Math.max(minTopY, y));

  return { x, y };
}

/**
 * Anchor transforms from ellipse angle:
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

/** Prefer actual laid-out Y so open-arc opponents get the right hang direction. */
export function seatAnchorTransformFromY(
  yPercent: number,
  isViewer: boolean,
  compact = false
): string {
  if (isViewer) return "translate(-50%, -100%)";
  // Top rail: hang upward (outside) so pods do not cover the board/pot.
  if (yPercent < (compact ? 30 : 28)) {
    return "translate(-50%, -100%)";
  }
  if (yPercent > 72) return "translate(-50%, -90%)";
  if (yPercent > 60) return "translate(-50%, -78%)";
  if (yPercent > 50) return "translate(-50%, -65%)";
  return "translate(-50%, -50%)";
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

type SeatPos = { x: number; y: number; visualIndex: number; isViewer: boolean };

/**
 * Place every seat for a viewer-centric table. Opponents sit on an open top arc;
 * a separation pass keeps pods from stacking on phones.
 */
export function layoutSeatsForViewer(
  total: number,
  viewerSortedSeatIndex: number,
  compact = false
): SeatPos[] {
  const { rx, ry } = ellipseRadii(total, compact);
  const minDist = compact ? (total >= 6 ? 22 : 24) : total >= 6 ? 20 : 22;
  const positions: SeatPos[] = [];

  for (let i = 0; i < total; i++) {
    positions.push(
      getSeatPositionForViewer(i, total, viewerSortedSeatIndex, compact)
    );
  }

  if (viewerSortedSeatIndex < 0 || total < 3) return positions;

  // Nudge non-hero seats apart along the ellipse when too close.
  const others = positions
    .map((p, index) => ({ ...p, index }))
    .filter((p) => !p.isViewer);

  for (let pass = 0; pass < 4; pass++) {
    let moved = false;
    for (let a = 0; a < others.length; a++) {
      for (let b = a + 1; b < others.length; b++) {
        const A = others[a]!;
        const B = others[b]!;
        const dx = B.x - A.x;
        const dy = B.y - A.y;
        const dist = Math.hypot(dx, dy);
        if (dist >= minDist || dist < 0.001) continue;
        const push = ((minDist - dist) / 2) * 1.05;
        const ux = dx / dist;
        const uy = dy / dist;
        const aClamped = clampOpponentPoint(A.x - ux * push, A.y - uy * push, compact);
        const bClamped = clampOpponentPoint(B.x + ux * push, B.y + uy * push, compact);
        A.x = aClamped.x;
        A.y = aClamped.y;
        B.x = bClamped.x;
        B.y = bClamped.y;
        moved = true;
      }
    }
    if (!moved) break;
  }

  // Pull nudged points back toward the ellipse rim so they still hug the rail.
  for (const o of others) {
    const vx = (o.x - 50) / rx;
    const vy = (o.y - 50) / ry;
    const mag = Math.hypot(vx, vy) || 1;
    const target = clampOpponentPoint(50 + rx * (vx / mag), 50 + ry * (vy / mag), compact);
    o.x = target.x;
    o.y = target.y;
    positions[o.index] = {
      x: o.x,
      y: o.y,
      visualIndex: o.visualIndex,
      isViewer: false,
    };
  }

  return positions;
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
): SeatPos {
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

  // Re-index the other seats across the top arc (exclude bottom / 6 o'clock).
  // Engine turn order advances ascending seatId as clockwise on the ring.
  // From the hero at 6 o'clock, clockwise is left → top → right, so the seat
  // immediately after the viewer (ascending) must sit on the viewer's left.
  const others = total - 1;
  const orderAmongOthers =
    (sortedSeatIndex - viewerSortedSeatIndex - 1 + total) % total;
  const angles = opponentArcAngles(others, compact);
  const angle = angles[orderAmongOthers] ?? angles[0]!;
  const { rx, ry } = ellipseRadii(total, compact);
  const point = clampOpponentPoint(
    50 + rx * Math.cos(angle),
    50 + ry * Math.sin(angle),
    compact
  );

  return { ...point, visualIndex, isViewer: false };
}
