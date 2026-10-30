"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { matchSpeakerUserIds } from "@/lib/zoomDisplayName";

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

type ZoomMirrorStripProps = {
  tournamentId: string;
  seats: SeatLike[];
  onSpeakingUserIds: (userIds: string[]) => void;
};

type EmbeddedClient = {
  init: (args: Record<string, unknown>) => Promise<unknown>;
  join: (args: Record<string, unknown>) => Promise<unknown>;
  leaveMeeting?: () => Promise<unknown>;
  stopAudio?: () => Promise<unknown>;
  mute?: (mute: boolean) => Promise<unknown>;
  getAttendeeslist?: () => { userId: number; displayName?: string }[];
  on?: (event: string, cb: (...args: unknown[]) => void) => void;
  off?: (event: string, cb: (...args: unknown[]) => void) => void;
};

/**
 * Meeting SDK video mirror — viewport-neutral fallback.
 *
 * Spike result: Web Component View cannot paint per-participant streams into
 * seat avatar DOM (gallery/ribbon/container only). Faces live in a strip that
 * collapses to ~0 height when hidden; active speakers get seat rings via name match.
 * In-app audio is forced off so Zoom app remains the call.
 */
export function ZoomMirrorStrip({
  tournamentId,
  seats,
  onSpeakingUserIds,
}: ZoomMirrorStripProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const clientRef = useRef<EmbeddedClient | null>(null);
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

  const enforceAudioOff = useCallback(async (client: EmbeddedClient) => {
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

  const startMirror = useCallback(async () => {
    setError(null);
    setJoining(true);
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/zoom/signature`, {
        method: "POST",
      });
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

      const ZoomMtgEmbedded = (await import("@zoom/meetingsdk/embedded"))
        .default as unknown as {
        createClient: () => EmbeddedClient;
      };
      const client = ZoomMtgEmbedded.createClient();
      clientRef.current = client;

      const onActiveSpeaker = (payload: unknown) => {
        const speakers = Array.isArray(payload)
          ? (payload as { displayName?: string }[])
          : [];
        onSpeakingUserIds(matchSpeakerUserIds(seatsRef.current, speakers));
        void enforceAudioOff(client);
      };

      client.on?.("active-speaker", onActiveSpeaker);

      // Component View InitOptions do not document disableJoinAudio (Client View does).
      // Pass it anyway + stopAudio/mute after join. Product assumes Zoom owns audio.
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
            defaultViewType: "ribbon",
            viewSizes: {
              default: { width: 280, height: 72 },
              ribbon: { width: 280, height: 72 },
            },
            popper: { disableDraggable: true },
          },
        },
      });

      await client.join({
        signature: data.signature,
        meetingNumber: data.meetingNumber,
        password: data.password,
        userName: data.userName,
      });

      await enforceAudioOff(client);
      setJoined(true);
      setExpanded(true);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Meeting SDK join failed";
      setError(message);
      clientRef.current = null;
      setJoined(false);
    } finally {
      setJoining(false);
    }
  }, [enforceAudioOff, onSpeakingUserIds, tournamentId]);

  useEffect(() => {
    return () => {
      void leaveMirror();
    };
  }, [leaveMirror]);

  if (!status?.zoomJoinUrl && !status?.zoomMeetingNumber) {
    return null;
  }

  const canAttemptMirror = status.mirrorConfigured && status.canMirror;

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
              onClick={() => {
                if (expanded) {
                  setExpanded(false);
                } else {
                  setExpanded(true);
                }
              }}
            >
              {expanded ? "Hide faces" : "Show faces"}
            </button>
          ) : (
            <button
              type="button"
              disabled={joining}
              className="text-amber-300 hover:text-amber-200 underline-offset-2 hover:underline disabled:opacity-50"
              onClick={() => void startMirror()}
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
            onClick={() => void leaveMirror()}
          >
            Leave faces
          </button>
        ) : null}
      </div>
      {error ? (
        <p className="text-[11px] text-amber-300/90 mb-0.5 truncate" title={error}>
          {error}
        </p>
      ) : null}
      {/* Collapse-to-zero when hidden — never a permanent gallery band. */}
      <div
        className="overflow-hidden transition-[max-height,opacity] duration-200 ease-out"
        style={{
          maxHeight: expanded && joined ? 96 : 0,
          opacity: expanded && joined ? 1 : 0,
        }}
        aria-hidden={!expanded || !joined}
      >
        <div
          ref={rootRef}
          id="zoom-meeting-sdk-root"
          className="h-20 w-full max-w-md mx-auto rounded-md bg-slate-900/80 border border-slate-700/50 overflow-hidden [&_*]:max-h-20"
        />
      </div>
    </div>
  );
}
