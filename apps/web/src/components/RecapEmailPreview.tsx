"use client";

interface RecapEmailPreviewProps {
  html: string;
  onDismiss?: () => void;
}

/** Lobby-style local preview of the night-recap email (e.g. when Resend is unset). */
export function RecapEmailPreview({ html, onDismiss }: RecapEmailPreviewProps) {
  return (
    <div className="mt-6 mb-8">
      <div className="flex items-center justify-between gap-3 mb-2">
        <div>
          <p className="text-sm font-medium text-slate-200">Recap email preview</p>
          <p className="text-xs text-slate-500">
            Shown when mail is skipped locally — same HTML that would be sent.
          </p>
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="text-xs text-slate-400 hover:text-slate-200 shrink-0"
          >
            Dismiss
          </button>
        )}
      </div>
      <iframe
        title="Night recap email preview"
        className="w-full h-[480px] rounded-lg border border-slate-800 bg-slate-950"
        srcDoc={html}
      />
    </div>
  );
}
