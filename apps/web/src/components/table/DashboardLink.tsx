"use client";

import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";

export function DashboardLink() {
  return (
    <Link
      href="/dashboard"
      aria-label="Back to dashboard"
      className="shrink-0 inline-flex items-center gap-1.5 text-[11px] leading-none text-slate-500 hover:text-slate-300 hover:underline transition-colors"
    >
      <BrandMark size="xs" />
      Dashboard
    </Link>
  );
}
