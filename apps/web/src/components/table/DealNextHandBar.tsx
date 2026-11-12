"use client";

interface DealNextHandBarProps {
  dealerName: string;
  canDeal: boolean;
  pending: boolean;
  onDeal: () => void;
  dealerAway?: boolean;
}

/**
 * Between-hands deal control. When it is your button, a floating toast plus a
 * pulsing Deal button make the next action unmistakable; everyone else sees
 * whose deal it is in the same narrow footer row.
 */
export function DealNextHandBar({
  dealerName,
  canDeal,
  pending,
  onDeal,
  dealerAway = false,
}: DealNextHandBarProps) {
  return (
    <>
      {canDeal && !pending ? (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none fixed bottom-[4.25rem] sm:bottom-20 left-1/2 z-[60] -translate-x-1/2 max-w-[min(22rem,92vw)] px-3"
        >
          <div className="deal-prompt-toast rounded-lg border border-emerald-500/45 bg-slate-950/95 px-3 py-2 shadow-xl text-center">
            <p className="text-sm text-emerald-300 font-semibold">
              {dealerAway
                ? `${dealerName} is away — you can deal`
                : "Your turn to deal"}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Tap <span className="text-emerald-400 font-medium">Deal</span>{" "}
              below when everyone is ready.
            </p>
          </div>
        </div>
      ) : null}

      {!canDeal ? (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none fixed bottom-[4.25rem] sm:bottom-20 left-1/2 z-[60] -translate-x-1/2 max-w-[min(22rem,92vw)] px-3"
        >
          <div className="deal-prompt-toast rounded-lg border border-amber-500/35 bg-slate-950/95 px-3 py-2 shadow-xl text-center">
            <p className="text-sm text-amber-200 font-semibold">
              {dealerName}&apos;s deal
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Waiting for them to deal the next hand.
            </p>
          </div>
        </div>
      ) : null}

      <div className="w-full max-w-2xl mx-auto">
        <div className="flex flex-nowrap items-center justify-center gap-2 px-1 py-0.5">
          {canDeal ? (
            <>
              <p className="text-xs text-emerald-200/95 text-center min-w-0 truncate font-medium">
                {dealerAway
                  ? `${dealerName} away — deal when ready.`
                  : "Your button — deal when ready."}
              </p>
              <button
                type="button"
                onClick={onDeal}
                disabled={pending}
                aria-label={pending ? "Dealing next hand" : "Deal next hand"}
                className={`px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 rounded-lg font-semibold text-xs text-white whitespace-nowrap disabled:opacity-50 shrink-0 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400/70 ${
                  pending ? "" : "deal-btn-pulse"
                }`}
              >
                {pending ? "Dealing…" : "Deal"}
              </button>
            </>
          ) : (
            <p className="text-xs text-slate-300 text-center truncate">
              Waiting for{" "}
              <span className="inline-flex items-center gap-1 align-middle">
                <span
                  aria-hidden
                  className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-slate-100 text-slate-900 text-[8px] font-bold border border-amber-500/70"
                >
                  D
                </span>
                <span className="text-amber-300 font-semibold">
                  {dealerName}
                </span>
              </span>{" "}
              to deal…
            </p>
          )}
        </div>
      </div>
    </>
  );
}
