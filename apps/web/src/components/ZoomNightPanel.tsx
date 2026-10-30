"use client";

import { useCallback, useEffect, useState } from "react";

type ZoomStatus = {
  videoMode: string;
  zoomJoinUrl: string | null;
  zoomMeetingNumber: string | null;
  hasPwdQuery: boolean;
  hasPasscodePlain: boolean;
  mirrorConfigured: boolean;
  canMirror: boolean;
};

type ZoomNightPanelProps = {
  tournamentId: string;
  isHost: boolean;
};

/**
 * Host attaches Zoom to the night. Phase 1 owns richer link surfaces (email, Action Log);
 * this panel is the shared persistence UI so Phase 2 mirror can run.
 */
export function ZoomNightPanel({ tournamentId, isHost }: ZoomNightPanelProps) {
  const [zoom, setZoom] = useState<ZoomStatus | null>(null);
  const [joinUrl, setJoinUrl] = useState("");
  const [passcode, setPasscode] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/tournaments/${tournamentId}/zoom`);
    if (!res.ok) return;
    const data = await res.json();
    setZoom(data.zoom ?? null);
  }, [tournamentId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    setSaving(true);
    setError(null);
    setMessage(null);
    const trimmedUrl = joinUrl.trim();
    const trimmedPass = passcode.trim();
    if (!trimmedUrl && !trimmedPass && !zoom?.zoomJoinUrl) {
      setSaving(false);
      setError("Paste a Zoom join URL first");
      return;
    }
    const res = await fetch(`/api/tournaments/${tournamentId}/zoom`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(trimmedUrl ? { zoomJoinUrl: trimmedUrl } : {}),
        ...(trimmedPass ? { zoomPasscodePlain: trimmedPass } : {}),
        enableMirror: Boolean(trimmedPass || zoom?.hasPasscodePlain),
      }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Could not save Zoom");
      return;
    }
    setZoom(data.zoom ?? null);
    setJoinUrl("");
    setPasscode("");
    setMessage(
      data.zoom?.canMirror
        ? "Zoom linked — table faces available when Meeting SDK is configured"
        : "Zoom linked — open Zoom for audio; add plain passcode for in-app faces"
    );
  }

  async function clearZoom() {
    setSaving(true);
    setError(null);
    setMessage(null);
    const res = await fetch(`/api/tournaments/${tournamentId}/zoom`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clear: true }),
    });
    setSaving(false);
    if (!res.ok) {
      setError("Could not clear Zoom");
      return;
    }
    setZoom(null);
    setMessage("Zoom cleared");
  }

  if (!isHost && !zoom?.zoomJoinUrl) return null;

  return (
    <section className="rounded-lg border border-slate-700/80 bg-slate-900/60 p-3 sm:p-4 space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-100">Zoom</h2>
        {zoom?.zoomMeetingNumber ? (
          <span className="text-[11px] font-mono text-emerald-400/90">
            Linked · {zoom.zoomMeetingNumber}
          </span>
        ) : (
          <span className="text-[11px] text-slate-500">Optional</span>
        )}
      </div>
      <p className="text-xs text-slate-400">
        Paste a recurring personal join link. Zoom stays the call for audio; the table
        can mirror faces later without a second audio session.
      </p>

      {!isHost && zoom?.zoomJoinUrl ? (
        <div className="flex flex-wrap gap-2 text-xs">
          <a
            href={zoom.zoomJoinUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-2.5 py-1.5 rounded bg-emerald-600/90 text-white font-medium hover:bg-emerald-500"
          >
            Join Zoom
          </a>
          <button
            type="button"
            className="px-2.5 py-1.5 rounded border border-slate-600 text-slate-200 hover:bg-slate-800"
            onClick={() => void navigator.clipboard?.writeText(zoom.zoomJoinUrl!)}
          >
            Copy link
          </button>
        </div>
      ) : null}

      {isHost ? (
        <div className="space-y-2">
          <label className="block text-xs text-slate-400">
            Join URL
            <input
              type="url"
              value={joinUrl}
              onChange={(e) => setJoinUrl(e.target.value)}
              placeholder="https://us04web.zoom.us/j/…?pwd=…"
              className="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-2 py-1.5 text-sm text-slate-100 placeholder:text-slate-600"
            />
          </label>
          <label className="block text-xs text-slate-400">
            Plain passcode (for in-app faces — not the URL pwd token)
            <input
              type="text"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              placeholder="Meeting passcode from Zoom"
              autoComplete="off"
              className="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-2 py-1.5 text-sm text-slate-100 placeholder:text-slate-600"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={saving || (!joinUrl.trim() && !passcode.trim() && !zoom?.zoomJoinUrl)}
              onClick={() => void save()}
              className="px-2.5 py-1.5 rounded bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-500 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save Zoom"}
            </button>
            {zoom?.zoomJoinUrl ? (
              <>
                <a
                  href={zoom.zoomJoinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1.5 rounded bg-emerald-600/90 text-white text-xs font-medium hover:bg-emerald-500"
                >
                  Join Zoom
                </a>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void clearZoom()}
                  className="px-2.5 py-1.5 rounded border border-slate-700 text-xs text-slate-400 hover:text-slate-200"
                >
                  Clear
                </button>
              </>
            ) : null}
          </div>
          {zoom?.mirrorConfigured === false ? (
            <p className="text-[11px] text-slate-500">
              Meeting SDK credentials are not set on the server yet — Join Zoom still works.
            </p>
          ) : null}
        </div>
      ) : null}

      {error ? <p className="text-xs text-amber-300">{error}</p> : null}
      {message ? <p className="text-xs text-emerald-400/90">{message}</p> : null}
    </section>
  );
}
