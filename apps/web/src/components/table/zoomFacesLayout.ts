/**
 * Zoom Meeting SDK tile floor (ribbon docs minimum per tile).
 * We size a ribbon of N tiles then CSS-scale/cover into the faces column.
 */
export const ZOOM_SDK_TILE_WIDTH = 240;
export const ZOOM_SDK_TILE_HEIGHT = 135;

/** Back-compat aliases used by older imports. */
export const ZOOM_SDK_VIEW_WIDTH = ZOOM_SDK_TILE_WIDTH;
export const ZOOM_SDK_VIEW_HEIGHT = ZOOM_SDK_TILE_HEIGHT;

/** Max faces we try to show in the table column. */
export const ZOOM_FACES_MAX = 9;

/** Desktop faces column width (px) — left of the table. */
export const ZOOM_FACES_COLUMN_WIDTH = 120;

/** Phone strip height when expanded (px) — ≈ one cover cell. */
export const ZOOM_FACES_PHONE_STRIP_HEIGHT = 90;

/**
 * Visible face cell height for one video-on thumb (px).
 * Slightly taller than 16:9-of-width so cover-crop fills without letterboxing.
 */
export const ZOOM_FACES_CELL_HEIGHT = 90;

export type ZoomFacesLayout = {
  /** Active video-on tiles to request from the SDK (1–9, or 0). */
  tileCount: number;
  sdkWidth: number;
  sdkHeight: number;
  /** Visible frame size after scale (tight wrap — no empty column padding). */
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
 * Tight layout for active video-on thumbs only.
 * Frame height = cellHeight × tileCount (no reserved slots for cameras off).
 * Scale uses cover (max) so the ribbon fills the frame without black bars;
 * overflow clips on the thumb.
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
  const frameWidth = Math.max(0, Math.min(columnWidth, ZOOM_FACES_COLUMN_WIDTH));

  if (tileCount === 0 || frameWidth <= 0 || columnHeight <= 0) {
    return {
      tileCount: 0,
      sdkWidth: ZOOM_SDK_TILE_WIDTH,
      sdkHeight: ZOOM_SDK_TILE_HEIGHT,
      frameWidth,
      frameHeight: 0,
      scaleX: frameWidth > 0 ? frameWidth / ZOOM_SDK_TILE_WIDTH : 0,
      scaleY: 0,
    };
  }

  const sdkWidth = ZOOM_SDK_TILE_WIDTH;
  const sdkHeight = ZOOM_SDK_TILE_HEIGHT * tileCount;

  // Prefer packing N cells at ZOOM_FACES_CELL_HEIGHT; shrink if column is short.
  const idealHeight = ZOOM_FACES_CELL_HEIGHT * tileCount;
  const frameHeight = Math.min(idealHeight, columnHeight);

  // Cover scale — fill the frame; thumb overflow:hidden crops edges.
  const scaleX = frameWidth / sdkWidth;
  const scaleY = frameHeight / sdkHeight;
  const cover = Math.max(scaleX, scaleY);

  return {
    tileCount,
    sdkWidth,
    sdkHeight,
    frameWidth,
    frameHeight,
    scaleX: cover,
    scaleY: cover,
  };
}
