"use client";

interface ShowCardsControlProps {
  pending: boolean;
  onShow: () => void;
}

/**
 * Optional fold-win reveal. Lives in the footer beside Deal so it never blocks
 * dealing the next hand.
 */
export function ShowCardsControl({ pending, onShow }: ShowCardsControlProps) {
  return (
    <div className="w-full max-w-2xl mx-auto flex flex-nowrap items-center justify-center gap-2 px-1 py-0.5">
      <p className="text-xs text-slate-400 text-center min-w-0 truncate">
        Won without a showdown — reveal if you want.
      </p>
      <button
        type="button"
        onClick={onShow}
        disabled={pending}
        aria-label={pending ? "Showing cards" : "Show cards"}
        className="px-3 py-1.5 rounded-lg border border-amber-500/45 bg-amber-500/10 hover:bg-amber-500/20 text-amber-200 font-semibold text-xs whitespace-nowrap disabled:opacity-50 shrink-0 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400/70"
      >
        {pending ? "Showing…" : "Show cards"}
      </button>
    </div>
  );
}
