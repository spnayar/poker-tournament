"use client";

import Link from "next/link";

export function DashboardLink() {
  return (
    <Link
      href="/dashboard"
      aria-label="Back to dashboard"
      className="shrink-0 text-[11px] leading-none text-slate-500 hover:text-slate-300 hover:underline transition-colors"
    >
      Dashboard
    </Link>
  );
}
