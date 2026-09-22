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
    <div className="w-full max-w-2xl mx-auto px-1">
      <div className="bg-slate-900/90 border border-slate-700 rounded-xl px-4 py-3 flex flex-col sm:flex-row items-center justify-center gap-3">
        {canDeal ? (
          <>
            <p className="text-sm text-slate-300 text-center">
              {dealerAway
                ? `${dealerName} is away or sitting out — you can deal the next hand.`
                : "You have the button — deal when everyone is ready."}
            </p>
            <button
              type="button"
              onClick={onDeal}
              disabled={pending}
              className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg font-semibold text-sm whitespace-nowrap disabled:opacity-50"
            >
              {pending ? "Dealing…" : "Deal next hand"}
            </button>
          </>
        ) : (
          <p className="text-sm text-slate-400 text-center">
            Waiting for <span className="text-amber-400">{dealerName}</span> to
            deal the next hand…
          </p>
        )}
      </div>
    </div>
  );
}
