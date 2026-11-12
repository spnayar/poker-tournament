import {
  CLUB_INSTAGRAM_HANDLE,
  CLUB_INSTAGRAM_URL,
} from "@/lib/clubContact";

type InstagramFollowLinkProps = {
  /** Compact chrome for table / action-log footers. */
  variant?: "login" | "chrome";
  className?: string;
};

function InstagramGlyph({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Discreet Instagram follow promo — never a hero or felt overlay. */
export function InstagramFollowLink({
  variant = "login",
  className = "",
}: InstagramFollowLinkProps) {
  const handle = `@${CLUB_INSTAGRAM_HANDLE}`;

  if (variant === "chrome") {
    return (
      <a
        href={CLUB_INSTAGRAM_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-300 transition-colors ${className}`.trim()}
        aria-label={`Follow Poker Table Club on Instagram, ${handle}`}
      >
        <InstagramGlyph className="h-3 w-3 shrink-0 opacity-80" />
        <span className="truncate">{handle}</span>
      </a>
    );
  }

  return (
    <a
      href={CLUB_INSTAGRAM_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center justify-center gap-1.5 text-sm text-slate-500 hover:text-slate-300 transition-colors ${className}`.trim()}
      aria-label={`Follow Poker Table Club on Instagram, ${handle}`}
    >
      <InstagramGlyph className="h-3.5 w-3.5 shrink-0 opacity-80" />
      <span>
        Follow {handle}{" "}
        <span className="text-slate-600">on Instagram</span>
      </span>
    </a>
  );
}
