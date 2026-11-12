"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  type ReactNode,
  type RefObject,
} from "react";
import { matchSpeakerUserIds } from "@/lib/zoomDisplayName";
import {
  loadZoomMtgEmbedded,
  type ZoomEmbeddedClient,
} from "@/lib/zoomMeetingSdkLoader";
import {
  ZOOM_SDK_VIEW_HEIGHT,
  ZOOM_SDK_VIEW_WIDTH,
} from "./zoomFacesLayout";

export {
  ZOOM_SDK_VIEW_HEIGHT,
  ZOOM_SDK_VIEW_WIDTH,
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

/**
 * Meeting SDK video mirror — table keeps the viewport; faces live in a side
 * thumbnail (sm+) or a tiny strip under the Action Log (phone).
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

  const leaveMirror = useCallback(async () => {
    const client = clientRef.current;
    clientRef.current = null;
    setJoined(false);
    setExpanded(false);
    onSpeakingUserIds([]);
    if (!client) return;
    try {
      await client.leaveMeeting?.();
    } catch {
      /* leaving is best-effort */
    }
  }, [onSpeakingUserIds]);

  const pinCompactSpeakerView = useCallback(
    async (client: ZoomEmbeddedClient) => {
      try {
        await client.setViewType?.("speaker");
      } catch {
        /* view type may be unavailable mid-join */
      }
      try {
        client.updateVideoOptions?.({
          isResizable: false,
          viewSizes: {
            default: {
              width: ZOOM_SDK_VIEW_WIDTH,
              height: ZOOM_SDK_VIEW_HEIGHT,
            },
            ribbon: {
              width: ZOOM_SDK_VIEW_WIDTH,
              height: ZOOM_SDK_VIEW_HEIGHT,
            },
          },
          popper: { disableDraggable: true },
        });
      } catch {
        /* size pin is best-effort — CSS frame still clamps */
      }
    },
    []
  );

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

      // Expand the thumbnail slot before Zoom measures zoomAppRoot —
      // a max-height:0 ancestor makes Component View paint a huge floating panel.
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
          // Missing Zoom participant / name mapping must never break the strip.
          onSpeakingUserIds([]);
        }
        void enforceAudioOff(client);
      };

      // Component View InitOptions do not document disableJoinAudio (Client View does).
      // Pass it anyway + stopAudio/mute after join. Product assumes Zoom owns audio.
      //
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
        customize: {
          meetingInfo: [],
          video: {
            isResizable: false,
            defaultViewType: "speaker",
            viewSizes: {
              default: {
                width: ZOOM_SDK_VIEW_WIDTH,
                height: ZOOM_SDK_VIEW_HEIGHT,
              },
              ribbon: {
                width: ZOOM_SDK_VIEW_WIDTH,
                height: ZOOM_SDK_VIEW_HEIGHT,
              },
            },
            popper: { disableDraggable: true },
          },
        },
      });

      client.on?.("active-speaker", onActiveSpeaker);

      // Only pass defined join fields — Zoom may call string methods on optionals.
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
        return;
      }

      await client.join({
        signature,
        meetingNumber,
        password,
        userName,
      });

      await enforceAudioOff(client);
      await pinCompactSpeakerView(client);
      setJoined(true);
    } catch (err) {
      const raw =
        err instanceof Error ? err.message : "Meeting SDK join failed";
      // Keep the banner useful without dumping opaque SDK TypeErrors as the only clue.
      const message = /reading 'includes'/i.test(raw)
        ? "Could not start table faces (Zoom listener ran before init). Try again."
        : raw;
      setError(message);
      clientRef.current = null;
      setJoined(false);
      setExpanded(false);
      onSpeakingUserIds([]);
    } finally {
      setJoining(false);
    }
  }, [
    enforceAudioOff,
    onSpeakingUserIds,
    pinCompactSpeakerView,
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
 * Single Meeting SDK root inside our slate/emerald thumbnail frame.
 * Responsive CSS: side-sized above Action Log on sm+, tiny strip under it on phone.
 */
export function ZoomMirrorFacesFrame() {
  const { joined, expanded, rootRef } = useZoomMirror();
  const show = joined && expanded;

  return (
    <div
      className="zoom-faces-frame-slot shrink-0 w-full"
      data-expanded={show ? "true" : "false"}
      aria-hidden={!show}
    >
      <div className="zoom-faces-thumb mx-auto">
        <div className="zoom-faces-thumb__scale">
          <div
            ref={rootRef}
            id="zoom-meeting-sdk-root"
            className="zoom-faces-sdk-root"
          />
        </div>
      </div>
    </div>
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
