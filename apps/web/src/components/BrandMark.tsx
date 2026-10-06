import Link from "next/link";

export const CLUB_LOGO_SRC = "/poker-table-club-logo.png";
export const CLUB_LOGO_ALT = "Poker Table Club chip logo";

const SIZE_CLASS = {
  xs: "h-5 w-5",
  sm: "h-9 w-9",
  md: "h-16 w-16",
  lg: "h-28 w-28",
} as const;

type BrandSize = keyof typeof SIZE_CLASS;

export function BrandMark({
  size = "md",
  className = "",
}: {
  size?: BrandSize;
  className?: string;
}) {
  return (
    <img
      src={CLUB_LOGO_SRC}
      alt={CLUB_LOGO_ALT}
      className={`${SIZE_CLASS[size]} shrink-0 object-contain rounded-full ${className}`.trim()}
    />
  );
}

export function BrandLockup({
  href = "/dashboard",
  size = "sm",
}: {
  href?: string;
  size?: "xs" | "sm";
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 min-w-0 rounded-lg hover:opacity-90 transition-opacity"
    >
      <BrandMark size={size} />
      <span className="font-semibold text-slate-100 truncate">Poker Night</span>
    </Link>
  );
}
