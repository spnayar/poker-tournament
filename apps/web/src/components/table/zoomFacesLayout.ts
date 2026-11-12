/**
 * Custom landscape face thumbs (mock: stacked 16:9 tiles left of the table).
 * Meeting SDK still renders offscreen at its tile floor; we blit into these cells.
 */
export const ZOOM_SDK_TILE_WIDTH = 320;
export const ZOOM_SDK_TILE_HEIGHT = 180;

/** Back-compat aliases. */
export const ZOOM_SDK_VIEW_WIDTH = ZOOM_SDK_TILE_WIDTH;
export const ZOOM_SDK_VIEW_HEIGHT = ZOOM_SDK_TILE_HEIGHT;

/** Max faces in the table column. */
export const ZOOM_FACES_MAX = 9;

/** Visible landscape thumb width (px) — column is exactly this wide. */
export const ZOOM_FACES_TILE_WIDTH = 168;

/** Visible landscape thumb height (px) — true 16:9 of TILE_WIDTH. */
export const ZOOM_FACES_TILE_HEIGHT = 95;

/** Gap between stacked thumbs (px). */
export const ZOOM_FACES_TILE_GAP = 6;

/** Desktop faces column width (px). */
export const ZOOM_FACES_COLUMN_WIDTH = ZOOM_FACES_TILE_WIDTH;

/** Phone strip height when expanded (px) — one landscape tile + gap. */
export const ZOOM_FACES_PHONE_STRIP_HEIGHT =
  ZOOM_FACES_TILE_HEIGHT + ZOOM_FACES_TILE_GAP;

/** @deprecated use ZOOM_FACES_TILE_HEIGHT */
export const ZOOM_FACES_CELL_HEIGHT = ZOOM_FACES_TILE_HEIGHT;

export type ZoomFaceTileModel = {
  userId: number;
  displayName: string;
};

export type ZoomFacesLayout = {
  tileCount: number;
  sdkWidth: number;
  sdkHeight: number;
  frameWidth: number;
  frameHeight: number;
  scaleX: number;
  scaleY: number;
};

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

function normalizeName(name: string): string {
  return name
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Active video-on participants for the custom stack.
 * Skips the table's own mirror join ("The Poker Table Club").
 */
export function listVideoOnFaces(
  attendees: Array<{
    userId?: number;
    displayName?: string;
    userName?: string;
    video?: boolean;
    bVideoOn?: boolean;
  } | null | undefined>,
  mirrorParticipantName: string,
  max: number = ZOOM_FACES_MAX
): ZoomFaceTileModel[] {
  const mirrorKey = normalizeName(mirrorParticipantName);
  const out: ZoomFaceTileModel[] = [];
  for (const a of attendees) {
    if (!a || typeof a.userId !== "number") continue;
    if (!(a.video === true || a.bVideoOn === true)) continue;
    const displayName = String(a.displayName || a.userName || "").trim();
    if (!displayName) continue;
    if (mirrorKey && normalizeName(displayName) === mirrorKey) continue;
    out.push({ userId: a.userId, displayName });
    if (out.length >= max) break;
  }
  return out;
}

/** Stack height for N landscape thumbs including gaps. */
export function stackHeightForTiles(tileCount: number): number {
  const n = Math.max(0, Math.min(ZOOM_FACES_MAX, Math.floor(tileCount)));
  if (n <= 0) return 0;
  return n * ZOOM_FACES_TILE_HEIGHT + (n - 1) * ZOOM_FACES_TILE_GAP;
}

/**
 * Layout metadata for the offscreen SDK engine (gallery sized to N tiles).
 * Visible column uses stackHeightForTiles — not this scale math.
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
  const frameWidth = Math.max(
    0,
    Math.min(columnWidth || ZOOM_FACES_TILE_WIDTH, ZOOM_FACES_TILE_WIDTH)
  );
  const sdkWidth = ZOOM_SDK_TILE_WIDTH;
  const sdkHeight = Math.max(ZOOM_SDK_TILE_HEIGHT, ZOOM_SDK_TILE_HEIGHT * Math.max(tileCount, 1));

  if (tileCount === 0 || frameWidth <= 0 || columnHeight <= 0) {
    return {
      tileCount: 0,
      sdkWidth,
      sdkHeight: ZOOM_SDK_TILE_HEIGHT,
      frameWidth,
      frameHeight: 0,
      scaleX: frameWidth > 0 ? frameWidth / sdkWidth : 0,
      scaleY: 0,
    };
  }

  const frameHeight = Math.min(stackHeightForTiles(tileCount), columnHeight);
  return {
    tileCount,
    sdkWidth,
    sdkHeight,
    frameWidth,
    frameHeight,
    scaleX: frameWidth / sdkWidth,
    scaleY: frameHeight / sdkHeight,
  };
}
