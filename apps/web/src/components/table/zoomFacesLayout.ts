/**
 * Zoom Meeting SDK tile floor (speaker/ribbon docs minimum per tile).
 * We size a ribbon of N tiles then CSS-scale into the faces column.
 */
export const ZOOM_SDK_TILE_WIDTH = 240;
export const ZOOM_SDK_TILE_HEIGHT = 135;

/** Back-compat aliases used by older imports. */
export const ZOOM_SDK_VIEW_WIDTH = ZOOM_SDK_TILE_WIDTH;
export const ZOOM_SDK_VIEW_HEIGHT = ZOOM_SDK_TILE_HEIGHT;

/** Max faces we try to show in the table column. */
export const ZOOM_FACES_MAX = 9;

/** Desktop faces column width (px) — narrow strip right of Action Log. */
export const ZOOM_FACES_COLUMN_WIDTH = 104;

/** Phone strip height when expanded (px). */
export const ZOOM_FACES_PHONE_STRIP_HEIGHT = 72;

export type ZoomFacesLayout = {
  /** Active video-on tiles to request from the SDK (1–9, or 0). */
  tileCount: number;
  sdkWidth: number;
  sdkHeight: number;
  /** Visible frame size after scale. */
  frameWidth: number;
  frameHeight: number;
  scaleX: number;
  scaleY: number;
};

/**
 * Count attendees with camera on. Meeting SDK still has no hide-non-video API;
 * we size the ribbon to this count and CSS-hide avatar-only frames.
 */
export function countVideoOnAttendees(
  attendees: Array<{ video?: boolean; bVideoOn?: boolean } | null | undefined>
): number {
  let n = 0;
  for (const a of attendees) {
    if (!a) continue;
    if (a.video === true || a.bVideoOn === true) n += 1;
  }
  return n;
}

/**
 * Layout the faces column so active thumbs use available space (up to 9).
 * Prefer filling column width; stack tiles vertically (ribbon).
 */
export function computeZoomFacesLayout(
  videoOnCount: number,
  columnWidth: number,
  columnHeight: number
): ZoomFacesLayout {
  const tileCount = Math.max(
    0,
    Math.min(ZOOM_FACES_MAX, Math.floor(videoOnCount))
  );
  if (tileCount === 0 || columnWidth <= 0 || columnHeight <= 0) {
    return {
      tileCount: 0,
      sdkWidth: ZOOM_SDK_TILE_WIDTH,
      sdkHeight: ZOOM_SDK_TILE_HEIGHT,
      frameWidth: Math.max(0, columnWidth),
      frameHeight: 0,
      scaleX: columnWidth > 0 ? columnWidth / ZOOM_SDK_TILE_WIDTH : 0,
      scaleY: 0,
    };
  }

  const sdkWidth = ZOOM_SDK_TILE_WIDTH;
  const sdkHeight = ZOOM_SDK_TILE_HEIGHT * tileCount;

  // Fit width first, then grow height if the column has room (maximize thumbs).
  const scaleByWidth = columnWidth / sdkWidth;
  let frameWidth = columnWidth;
  let frameHeight = sdkHeight * scaleByWidth;

  if (frameHeight > columnHeight && columnHeight > 0) {
    const scaleByHeight = columnHeight / sdkHeight;
    frameHeight = columnHeight;
    frameWidth = sdkWidth * scaleByHeight;
  }

  const scaleX = frameWidth / sdkWidth;
  const scaleY = frameHeight / sdkHeight;

  return {
    tileCount,
    sdkWidth,
    sdkHeight,
    frameWidth,
    frameHeight,
    scaleX,
    scaleY,
  };
}
