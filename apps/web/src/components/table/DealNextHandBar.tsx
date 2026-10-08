"use client";

interface DealNextHandBarProps {
  dealerName: string;
  canDeal: boolean;
  pending: boolean;
  onDeal: () => void;
  dealerAway?: boolean;
}

export function DealNextHandBar({
  dealerName,
  canDeal,
  pending,
  onDeal,
  dealerAway = false,
}: DealNextHandBarProps) {
  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="flex flex-nowrap items-center justify-center gap-2 px-1 py-0.5">
        {canDeal ? (
          <>
            <p className="text-xs text-slate-300 text-center min-w-0 truncate">
              {dealerAway
                ? `${dealerName} away — you can deal.`
                : "Your button — deal when ready."}
            </p>
            <button
              type="button"
              onClick={onDeal}
              disabled={pending}
              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 rounded-md font-semibold text-xs whitespace-nowrap disabled:opacity-50 shrink-0"
            >
              {pending ? "Dealing…" : "Deal next hand"}
            </button>
          </>
        ) : (
          <p className="text-xs text-slate-400 text-center truncate">
            Waiting for <span className="text-amber-400">{dealerName}</span> to
            deal…
          </p>
        )}
      </div>
    </div>
  );
}
