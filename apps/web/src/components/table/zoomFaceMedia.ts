/**
 * Bridge Meeting SDK gallery media into our custom landscape tiles.
 * Component View cannot attachVideo into arbitrary DOM — we locate the SDK's
 * video/canvas by participant name and blit (cover) into our tile canvas.
 */

import { normalizeZoomDisplayName } from "@/lib/zoomDisplayName";

const FRAME_SELECTORS = [
  ".gallery-video-container__video-frame",
  ".mobile-gallery-video-container__video-frame",
  ".speaker-active-container__video-frame",
  ".video-avatar__avatar",
  "[class*='video-frame']",
];

const NAME_SELECTORS = [
  ".video-avatar__avatar-name",
  ".video-avatar__name-tag",
  ".suspension-user-name",
  "[class*='avatar-name']",
  "[class*='user-name']",
];

const CHROME_SELECTORS = [
  ".suspension-header",
  ".meeting-info-container",
  ".meeting-info-container__inner-icons",
  ".meeting-info-container__wrapper",
  ".meeting-info-encryption-icon__icon-wrap",
  ".meeting-info-encryption-icon__button-wrap",
  "[class*='encryption-icon']",
  "[class*='meeting-info']",
  ".gallery-video-container__switch-button",
  ".gallery-video-container__pagination",
  ".speaker-active-container__switch-button",
  ".speaker-view-button",
  ".more-button",
  ".video-avatar__group-btn",
  ".avatar-more",
  ".avatar-more-xs-btn",
  ".footer",
  ".footer__inner",
  ".sharee-container-box",
];

export function findSdkMediaForName(
  sdkRoot: ParentNode,
  displayName: string
): HTMLVideoElement | HTMLCanvasElement | null {
  const key = normalizeZoomDisplayName(displayName);
  if (!key) return null;

  for (const frameSel of FRAME_SELECTORS) {
    for (const frame of Array.from(sdkRoot.querySelectorAll(frameSel))) {
      let label = "";
      for (const nameSel of NAME_SELECTORS) {
        const el = frame.querySelector(nameSel);
        if (el?.textContent?.trim()) {
          label = el.textContent.trim();
          break;
        }
      }
      if (!label || normalizeZoomDisplayName(label) !== key) continue;
      const media = frame.querySelector("video, canvas");
      if (media instanceof HTMLVideoElement || media instanceof HTMLCanvasElement) {
        return media;
      }
    }
  }

  // Fallback: scan any name+media pairing under the root.
  for (const nameSel of NAME_SELECTORS) {
    for (const nameEl of Array.from(sdkRoot.querySelectorAll(nameSel))) {
      if (normalizeZoomDisplayName(nameEl.textContent ?? "") !== key) continue;
      const host =
        nameEl.closest(FRAME_SELECTORS.join(",")) ?? nameEl.parentElement;
      const media = host?.querySelector("video, canvas");
      if (
        media instanceof HTMLVideoElement ||
        media instanceof HTMLCanvasElement
      ) {
        return media;
      }
    }
  }

  return null;
}

/** Hide / remove Zoom chrome that leaks beside our custom tiles. */
export function stripZoomChrome(scope: ParentNode = document): void {
  for (const sel of CHROME_SELECTORS) {
    for (const el of Array.from(scope.querySelectorAll(sel))) {
      if (!(el instanceof HTMLElement)) continue;
      el.style.setProperty("display", "none", "important");
      el.style.setProperty("visibility", "hidden", "important");
      el.style.setProperty("pointer-events", "none", "important");
      el.setAttribute("aria-hidden", "true");
    }
  }
  try {
    for (const btn of Array.from(
      scope.querySelectorAll(
        "button[aria-label*='Security' i], button[aria-label*='Gallery' i], button[aria-label*='Speaker' i], button[aria-label*='View' i], button[title*='Security' i], button[title*='View' i]"
      )
    )) {
      if (!(btn instanceof HTMLElement)) continue;
      btn.style.setProperty("display", "none", "important");
      btn.style.setProperty("visibility", "hidden", "important");
    }
  } catch {
    /* older query engines may reject case-insensitive attribute flags */
  }
}

function sourceSize(
  source: HTMLVideoElement | HTMLCanvasElement
): { w: number; h: number } {
  if (source instanceof HTMLVideoElement) {
    return {
      w: source.videoWidth || source.clientWidth || 0,
      h: source.videoHeight || source.clientHeight || 0,
    };
  }
  return {
    w: source.width || source.clientWidth || 0,
    h: source.height || source.clientHeight || 0,
  };
}

/** Draw source into dest with object-fit: cover. */
export function blitCover(
  source: HTMLVideoElement | HTMLCanvasElement,
  dest: HTMLCanvasElement
): void {
  const ctx = dest.getContext("2d");
  if (!ctx) return;
  const { w: sw, h: sh } = sourceSize(source);
  const dw = dest.width;
  const dh = dest.height;
  if (!sw || !sh || !dw || !dh) return;
  const scale = Math.max(dw / sw, dh / sh);
  const rw = sw * scale;
  const rh = sh * scale;
  const ox = (dw - rw) / 2;
  const oy = (dh - rh) / 2;
  ctx.clearRect(0, 0, dw, dh);
  try {
    ctx.drawImage(source, ox, oy, rw, rh);
  } catch {
    /* source may be cross-origin / not ready */
  }
}

export type FaceBlitHandle = {
  stop: () => void;
};

/**
 * Continuously blit SDK media for `displayName` into `dest` until stopped.
 */
export function startFaceBlit(
  sdkRoot: HTMLElement,
  displayName: string,
  dest: HTMLCanvasElement
): FaceBlitHandle {
  let raf = 0;
  let stopped = false;
  let source: HTMLVideoElement | HTMLCanvasElement | null = null;

  const tick = () => {
    if (stopped) return;
    if (!source || !source.isConnected) {
      source = findSdkMediaForName(sdkRoot, displayName);
    }
    if (source) blitCover(source, dest);
    raf = requestAnimationFrame(tick);
  };

  raf = requestAnimationFrame(tick);
  return {
    stop: () => {
      stopped = true;
      if (raf) cancelAnimationFrame(raf);
    },
  };
}
