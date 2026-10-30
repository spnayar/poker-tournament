"use client";

import { useState } from "react";

type ZoomActionLogBannerProps = {
  zoomJoinUrl: string;
  zoomMeetingNumber?: string | null;
};

/**
 * Compact sticky-ish row at the top of Action Log / room chat.
 * Must stay short — never a full Zoom chrome band.
 */
export function ZoomActionLogBanner({
  zoomJoinUrl,
  zoomMeetingNumber,
}: ZoomActionLogBannerProps) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    await navigator.clipboard.writeText(zoomJoinUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="shrink-0 mb-1.5 flex items-center gap-1.5 rounded-md bg-slate-800/70 border border-slate-700/60 px-2 py-1">
      <span className="text-[10px] font-semibold text-emerald-400/90 uppercase tracking-wide shrink-0">
        Zoom
      </span>
      {zoomMeetingNumber ? (
        <span className="text-[10px] font-mono text-slate-400 truncate min-w-0 hidden sm:inline">
          {zoomMeetingNumber}
        </span>
      ) : (
        <span className="text-[10px] text-slate-500 truncate min-w-0">linked</span>
      )}
      <span className="flex-1" />
      <a
        href={zoomJoinUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 px-1.5 py-0.5 rounded hover:bg-emerald-500/10"
      >
        Join
      </a>
      <button
        type="button"
        onClick={() => void copyLink()}
        className="text-[11px] text-slate-300 hover:text-slate-100 px-1.5 py-0.5 rounded hover:bg-slate-700/80"
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
