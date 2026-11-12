"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";
import { matchSpeakerUserIds } from "@/lib/zoomDisplayName";
import {
  loadZoomMtgEmbedded,
  type ZoomEmbeddedClient,
} from "@/lib/zoomMeetingSdkLoader";
import {
  ZOOM_FACES_COLUMN_WIDTH,
  ZOOM_FACES_MAX,
  ZOOM_FACES_PHONE_STRIP_HEIGHT,
  ZOOM_SDK_TILE_HEIGHT,
  ZOOM_SDK_TILE_WIDTH,
  ZOOM_SDK_VIEW_HEIGHT,
  ZOOM_SDK_VIEW_WIDTH,
  computeZoomFacesLayout,
  countVideoOnAttendees,
} from "./zoomFacesLayout";

export {
  ZOOM_SDK_VIEW_HEIGHT,
  ZOOM_SDK_VIEW_WIDTH,
  ZOOM_FACES_MAX,
} from "./zoomFacesLayout";

type ZoomStatus = {
  videoMode: string;
  zoomJoinUrl: string | null;
  zoomMeetingNumber: string | null;
  hasPwdQuery: boolean;
  hasPasscodePlain: boolean;
  mirrorConfigured: boolean;
  canMirror: boolean;
};

type SeatLike = { userId: string; displayName: string };

type ZoomMirrorContextValue = {
  status: ZoomStatus | null;
  joining: boolean;
  joined: boolean;
  expanded: boolean;
  error: string | null;
  canAttemptMirror: boolean;
  videoOnCount: number;
  rootRef: RefObject<HTMLDivElement | null>;
  startMirror: () => void;
  leaveMirror: () => void;
  setExpanded: (next: boolean) => void;
};

const ZoomMirrorContext = createContext<ZoomMirrorContextValue | null>(null);

function useZoomMirror(): ZoomMirrorContextValue {
  const ctx = useContext(ZoomMirrorContext);
  if (!ctx) {
    throw new Error("Zoom mirror components require ZoomMirrorProvider");
  }
  return ctx;
}

type ZoomMirrorProviderProps = {
  tournamentId: string;
  seats: SeatLike[];
  onSpeakingUserIds: (userIds: string[]) => void;
  children: ReactNode;
};

function readVideoOnCount(client: ZoomEmbeddedClient): number {
  try {
    const list = client.getAttendeeslist?.() ?? [];
    return Math.min(ZOOM_FACES_MAX, countVideoOnAttendees(list));
  } catch {
    return 0;
  }
}

/**
 * Meeting SDK video mirror — table keeps the viewport.
 *
 * Desktop: faces column right of Action Log (ribbon of up to 9 video-on tiles).
 * Phone: compact strip, collapsed until Show faces.
 *
 * Spike: Component View cannot paint per-seat streams. Active speakers get
 * seat rings via name match. In-app audio stays off so Zoom owns the call.
 */
export function ZoomMirrorProvider({
  tournamentId,
  seats,
  onSpeakingUserIds,
  children,
}: ZoomMirrorProviderProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const clientRef = useRef<ZoomEmbeddedClient | null>(null);
  const seatsRef = useRef(seats);
  seatsRef.current = seats;

  const [status, setStatus] = useState<ZoomStatus | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [videoOnCount, setVideoOnCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/tournaments/${tournamentId}/zoom`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setStatus(data.zoom ?? null);
      } catch {
        /* ignore — faces are optional */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tournamentId]);

  useEffect(() => {
    const root = document.documentElement;
    if (joined && expanded) {
      root.classList.add("zoom-faces-active");
    } else {
      root.classList.remove("zoom-faces-active");
    }
    return () => root.classList.remove("zoom-faces-active");
  }, [joined, expanded]);

  const enforceAudioOff = useCallback(async (client: ZoomEmbeddedClient) => {
    try {
      await client.stopAudio?.();
    } catch {
      /* stopAudio may no-op if audio never joined */
    }
    try {
      await client.mute?.(true);
    } catch {
      /* mute may fail before media ready */
    }
  }, []);

  const pinRibbonForVideoOn = useCallback(
    async (client: ZoomEmbeddedClient, count: number) => {
      const tiles = Math.max(1, Math.min(ZOOM_FACES_MAX, count || 1));
      const height = ZOOM_SDK_TILE_HEIGHT * tiles;
      try {
        await client.setViewType?.(tiles === 1 ? "speaker" : "ribbon");
      } catch {
        /* view type may be unavailable mid-join */
      }
      try {
        client.updateVideoOptions?.({
          isResizable: false,
          viewSizes: {
            default: { width: ZOOM_SDK_TILE_WIDTH, height },
            ribbon: { width: ZOOM_SDK_TILE_WIDTH, height },
          },
          popper: { disableDraggable: true },
        });
      } catch {
        /* size pin is best-effort — CSS frame still clamps */
      }
    },
    []
  );

  const refreshVideoOnCount = useCallback(
    (client: ZoomEmbeddedClient) => {
      const next = readVideoOnCount(client);
      setVideoOnCount(next);
      void pinRibbonForVideoOn(client, next);
    },
    [pinRibbonForVideoOn]
  );

  const leaveMirror = useCallback(async () => {
    const client = clientRef.current;
    clientRef.current = null;
    setJoined(false);
    setExpanded(false);
    setVideoOnCount(0);
    onSpeakingUserIds([]);
    if (!client) return;
    try {
      await client.leaveMeeting?.();
    } catch {
      /* leaving is best-effort */
    }
  }, [onSpeakingUserIds]);

  const startMirror = useCallback(async () => {
    setError(null);
    setJoining(true);
    try {
      const res = await fetch(
        `/api/tournaments/${tournamentId}/zoom/signature`,
        { method: "POST" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          typeof data.error === "string"
            ? data.error
            : "Could not start table faces"
        );
        return;
      }

      if (data.audioPolicy !== "mirror_video_only") {
        setError("Server refused mirror without audio-off policy");
        return;
      }

      const root = rootRef.current;
      if (!root) {
        setError("Video container missing");
        return;
      }

      // Expand before Zoom measures zoomAppRoot (zero-height → huge float panel).
      setExpanded(true);

      // CDN UMD + Zoom React 18 vendors — never webpack-import the ESM SDK
      // (that resolves to app React 19 and crashes on ReactCurrentOwner).
      const ZoomMtgEmbedded = await loadZoomMtgEmbedded();
      const client = ZoomMtgEmbedded.createClient();
      clientRef.current = client;

      const onActiveSpeaker = (payload: unknown) => {
        try {
          const speakers = Array.isArray(payload)
            ? (payload as {
                displayName?: string | null;
                userName?: string | null;
              }[])
            : [];
          onSpeakingUserIds(
            matchSpeakerUserIds(seatsRef.current ?? [], speakers)
          );
        } catch {
          onSpeakingUserIds([]);
        }
        void enforceAudioOff(client);
      };

      const onRosterChange = () => {
        refreshVideoOnCount(client);
        void enforceAudioOff(client);
      };

      // IMPORTANT: register listeners only AFTER init(). Zoom's client.on() checks an
      // internal event-name list that is assigned during init — calling on() first
      // throws: Cannot read properties of undefined (reading 'includes').
      await client.init({
        zoomAppRoot: root,
        language: "en-US",
        patchJsMedia: true,
        leaveOnPageUnload: true,
        disableJoinAudio: true,
        disablePreview: true,
        maximumVideosInGalleryView: ZOOM_FACES_MAX,
        customize: {
          meetingInfo: [],
          video: {
            isResizable: false,
            defaultViewType: "ribbon",
            viewSizes: {
              default: {
                width: ZOOM_SDK_TILE_WIDTH,
                height: ZOOM_SDK_TILE_HEIGHT,
              },
              ribbon: {
                width: ZOOM_SDK_TILE_WIDTH,
                height: ZOOM_SDK_TILE_HEIGHT * ZOOM_FACES_MAX,
              },
            },
            popper: { disableDraggable: true },
          },
        },
      });

      client.on?.("active-speaker", onActiveSpeaker);
      client.on?.("user-added", onRosterChange);
      client.on?.("user-removed", onRosterChange);
      client.on?.("user-updated", onRosterChange);

      const userName =
        typeof data.userName === "string" && data.userName.trim()
          ? data.userName.trim()
          : "Player";
      const meetingNumber = String(data.meetingNumber ?? "").trim();
      const password =
        typeof data.password === "string" ? data.password : "";
      const signature =
        typeof data.signature === "string" ? data.signature : "";
      if (!signature || !meetingNumber) {
        setError("Meeting SDK join is missing signature or meeting number");
        clientRef.current = null;
        setExpanded(false);
        return;
      }

      await client.join({
        signature,
        meetingNumber,
        password,
        userName,
      });

      await enforceAudioOff(client);
      refreshVideoOnCount(client);
      setJoined(true);
    } catch (err) {
      const raw =
        err instanceof Error ? err.message : "Meeting SDK join failed";
      const message = /reading 'includes'/i.test(raw)
        ? "Could not start table faces (Zoom listener ran before init). Try again."
        : raw;
      setError(message);
      clientRef.current = null;
      setJoined(false);
      setExpanded(false);
      setVideoOnCount(0);
      onSpeakingUserIds([]);
    } finally {
      setJoining(false);
    }
  }, [
    enforceAudioOff,
    onSpeakingUserIds,
    refreshVideoOnCount,
    tournamentId,
  ]);

  useEffect(() => {
    return () => {
      void leaveMirror();
    };
  }, [leaveMirror]);

  const canAttemptMirror = Boolean(
    status?.mirrorConfigured && status?.canMirror
  );

  const value: ZoomMirrorContextValue = {
    status,
    joining,
    joined,
    expanded,
    error,
    canAttemptMirror,
    videoOnCount,
    rootRef,
    startMirror: () => {
      void startMirror();
    },
    leaveMirror: () => {
      void leaveMirror();
    },
    setExpanded,
  };

  return (
    <ZoomMirrorContext.Provider value={value}>
      {children}
    </ZoomMirrorContext.Provider>
  );
}

/** Slim Join / Show / Hide controls — no video height. */
export function ZoomMirrorToolbar() {
  const {
    status,
    joining,
    joined,
    expanded,
    error,
    canAttemptMirror,
    startMirror,
    leaveMirror,
    setExpanded,
  } = useZoomMirror();

  if (!status?.zoomJoinUrl && !status?.zoomMeetingNumber) {
    return null;
  }

  return (
    <div className="shrink-0 w-full max-w-7xl mx-auto">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] sm:text-xs text-slate-400 mb-0.5">
        <span className="text-emerald-400/90 font-medium">Zoom linked</span>
        {status.zoomMeetingNumber ? (
          <span className="font-mono text-slate-500">
            · {status.zoomMeetingNumber}
          </span>
        ) : null}
        {status.zoomJoinUrl ? (
          <>
            <a
              href={status.zoomJoinUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-300 hover:text-emerald-200 underline-offset-2 hover:underline"
            >
              Join Zoom
            </a>
            <button
              type="button"
              className="text-slate-400 hover:text-slate-200 underline-offset-2 hover:underline"
              onClick={() => {
                void navigator.clipboard?.writeText(status.zoomJoinUrl!);
              }}
            >
              Copy
            </button>
          </>
        ) : null}
        {canAttemptMirror ? (
          joined ? (
            <button
              type="button"
              className="text-amber-300 hover:text-amber-200 underline-offset-2 hover:underline"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? "Hide faces" : "Show faces"}
            </button>
          ) : (
            <button
              type="button"
              disabled={joining}
              className="text-amber-300 hover:text-amber-200 underline-offset-2 hover:underline disabled:opacity-50"
              onClick={startMirror}
            >
              {joining ? "Starting faces…" : "Show table faces"}
            </button>
          )
        ) : status.mirrorConfigured && !status.hasPasscodePlain ? (
          <span className="text-amber-400/80">
            · Host: add plain Zoom passcode for in-app faces
          </span>
        ) : !status.mirrorConfigured ? (
          <span className="text-slate-500">
            · In-app faces need Meeting SDK credentials
          </span>
        ) : null}
        {joined ? (
          <button
            type="button"
            className="text-slate-500 hover:text-slate-300 underline-offset-2 hover:underline"
            onClick={leaveMirror}
          >
            Leave faces
          </button>
        ) : null}
      </div>
      {error ? (
        <p
          className="text-[11px] text-amber-300/90 mb-0.5 truncate"
          title={error}
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Meeting SDK root inside our slate/emerald frame.
 * Parent layout places this right of Action Log on sm+ and under it on phone.
 * Ribbon height tracks video-on count (max 9); avatar-only tiles are CSS-hidden.
 */
export function ZoomMirrorFacesFrame() {
  const { joined, expanded, videoOnCount, rootRef } = useZoomMirror();
  const show = joined && expanded;
  const shellRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({
    w: ZOOM_FACES_COLUMN_WIDTH,
    h: 360,
  });

  useEffect(() => {
    const el = shellRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setBox({
        w: Math.max(1, Math.floor(width)),
        h: Math.max(1, Math.floor(height)),
      });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Phone shell is wide — clamp to column width so thumbs stay compact.
  const layoutW = Math.min(
    Math.max(box.w, 1),
    ZOOM_FACES_COLUMN_WIDTH
  );
  const layoutH = Math.max(
    box.h,
    show ? ZOOM_FACES_PHONE_STRIP_HEIGHT : 0
  );
  const layout = computeZoomFacesLayout(
    show ? Math.max(videoOnCount, 0) : 0,
    layoutW,
    layoutH
  );

  const frameStyle: CSSProperties | undefined =
    show && layout.tileCount > 0
      ? {
          width: layout.frameWidth,
          height: layout.frameHeight,
          ["--zoom-sdk-w" as string]: `${layout.sdkWidth}px`,
          ["--zoom-sdk-h" as string]: `${layout.sdkHeight}px`,
          ["--zoom-scale-x" as string]: String(layout.scaleX),
          ["--zoom-scale-y" as string]: String(layout.scaleY),
        }
      : {
          // Keep a measurable mount target while joining / cameras off.
          width: Math.min(box.w, ZOOM_FACES_COLUMN_WIDTH),
          height: show ? ZOOM_FACES_PHONE_STRIP_HEIGHT : 0,
          ["--zoom-sdk-w" as string]: `${ZOOM_SDK_TILE_WIDTH}px`,
          ["--zoom-sdk-h" as string]: `${ZOOM_SDK_TILE_HEIGHT}px`,
          ["--zoom-scale-x" as string]: "0.4",
          ["--zoom-scale-y" as string]: "0.4",
        };

  return (
    <aside
      ref={shellRef}
      className="zoom-faces-column shrink-0 min-h-0 overflow-hidden flex flex-col items-center"
      data-expanded={show ? "true" : "false"}
      data-video-on={layout.tileCount}
      aria-label="Table faces"
      aria-hidden={!show}
    >
      <div
        className={`zoom-faces-thumb ${
          show ? "zoom-faces-thumb--visible" : ""
        }`}
        style={frameStyle}
      >
        <div className="zoom-faces-thumb__scale">
          <div
            ref={rootRef}
            id="zoom-meeting-sdk-root"
            className="zoom-faces-sdk-root"
          />
        </div>
      </div>
      {show && videoOnCount === 0 ? (
        <p className="text-[10px] text-slate-500 text-center px-1 mt-1 leading-tight">
          Waiting for cameras…
        </p>
      ) : null}
    </aside>
  );
}

/**
 * Back-compat wrapper: toolbar + faces stacked.
 * Table page uses Provider + Toolbar + FacesFrame in the sidebar instead.
 */
export function ZoomMirrorStrip({
  tournamentId,
  seats,
  onSpeakingUserIds,
}: {
  tournamentId: string;
  seats: SeatLike[];
  onSpeakingUserIds: (userIds: string[]) => void;
}) {
  return (
    <ZoomMirrorProvider
      tournamentId={tournamentId}
      seats={seats}
      onSpeakingUserIds={onSpeakingUserIds}
    >
      <ZoomMirrorToolbar />
      <ZoomMirrorFacesFrame />
    </ZoomMirrorProvider>
  );
}
