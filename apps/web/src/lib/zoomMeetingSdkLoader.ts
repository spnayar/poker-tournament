/**
 * Load Zoom Meeting SDK Component View via CDN UMD + Zoom's React 18 vendors.
 *
 * Why not `import("@zoom/meetingsdk/embedded")`?
 * The ESM build imports the app's React. Next.js 15 ships React 19, which removed
 * `__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentOwner`. The SDK
 * still reads that field → "Cannot read properties of undefined (reading
 * 'ReactCurrentOwner')". Zoom peers React 18.3.x only. Loading their vendor React 18
 * as globals for the UMD factory isolates the SDK from the app's React 19.
 *
 * Keep ZOOM_MEETING_SDK_VERSION aligned with apps/web package.json `@zoom/meetingsdk`.
 */

export const ZOOM_MEETING_SDK_VERSION = "6.10.0";

export type ZoomEmbeddedClient = {
  init: (args: Record<string, unknown>) => Promise<unknown>;
  join: (args: Record<string, unknown>) => Promise<unknown>;
  leaveMeeting?: () => Promise<unknown>;
  stopAudio?: () => Promise<unknown>;
  mute?: (mute: boolean) => Promise<unknown>;
  getAttendeeslist?: () => {
    userId: number;
    displayName?: string;
    video?: boolean;
    bVideoOn?: boolean;
  }[];
  on?: (event: string, cb: (...args: unknown[]) => void) => void;
  off?: (event: string, cb: (...args: unknown[]) => void) => void;
  /** Component View: speaker | ribbon | gallery | minimized | active */
  setViewType?: (viewType: string) => Promise<unknown> | unknown;
  updateVideoOptions?: (videoOptions: Record<string, unknown>) => void;
};

export type ZoomMtgEmbeddedGlobal = {
  createClient: () => ZoomEmbeddedClient;
};

type ZoomWindow = Window & {
  React?: unknown;
  ReactDOM?: unknown;
  ZoomMtgEmbedded?: ZoomMtgEmbeddedGlobal;
};

const VENDOR_SCRIPTS = [
  "react.min.js",
  "react-dom.min.js",
  "redux.min.js",
  "redux-thunk.min.js",
  "react-redux.min.js",
  "lodash.min.js",
] as const;

function vendorUrl(file: (typeof VENDOR_SCRIPTS)[number]): string {
  return `https://source.zoom.us/${ZOOM_MEETING_SDK_VERSION}/lib/vendor/${file}`;
}

function embeddedSdkUrl(): string {
  return `https://source.zoom.us/zoom-meeting-embedded-${ZOOM_MEETING_SDK_VERSION}.min.js`;
}

/** Exported for tests — exact script order Zoom documents for Component View UMD. */
export function zoomMeetingSdkScriptUrls(
  version: string = ZOOM_MEETING_SDK_VERSION
): string[] {
  return [
    ...VENDOR_SCRIPTS.map(
      (file) => `https://source.zoom.us/${version}/lib/vendor/${file}`
    ),
    `https://source.zoom.us/zoom-meeting-embedded-${version}.min.js`,
  ];
}

function findTrackedScript(src: string): HTMLScriptElement | null {
  return (
    Array.from(document.scripts).find(
      (el) => el.dataset.zoomMeetingSdk === src
    ) ?? null
  );
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = findTrackedScript(src);
    if (existing) {
      if (existing.dataset.loaded === "1") {
        resolve();
        return;
      }
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error(`Failed to load Zoom script: ${src}`)),
        { once: true }
      );
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = false;
    script.dataset.zoomMeetingSdk = src;
    script.onload = () => {
      script.dataset.loaded = "1";
      resolve();
    };
    script.onerror = () =>
      reject(new Error(`Failed to load Zoom script: ${src}`));
    document.head.appendChild(script);
  });
}

let loadPromise: Promise<ZoomMtgEmbeddedGlobal> | null = null;

/**
 * Ensures Zoom Component View UMD is available on window.ZoomMtgEmbedded,
 * wired to Zoom CDN React 18 (not the Next.js React 19 module graph).
 */
export function loadZoomMtgEmbedded(): Promise<ZoomMtgEmbeddedGlobal> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Zoom Meeting SDK requires a browser"));
  }

  const w = window as ZoomWindow;
  if (w.ZoomMtgEmbedded?.createClient) {
    return Promise.resolve(w.ZoomMtgEmbedded);
  }

  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    try {
      // Sets window.React / ReactDOM to Zoom's React 18.3.x. Next.js uses its own
      // module graph (React 19) and does not read these globals.
      for (const file of VENDOR_SCRIPTS) {
        await loadScript(vendorUrl(file));
      }
      await loadScript(embeddedSdkUrl());
    } catch (err) {
      loadPromise = null;
      throw err;
    }

    if (!w.ZoomMtgEmbedded?.createClient) {
      loadPromise = null;
      throw new Error("Zoom Meeting SDK loaded but ZoomMtgEmbedded is missing");
    }
    return w.ZoomMtgEmbedded;
  })();

  return loadPromise;
}
