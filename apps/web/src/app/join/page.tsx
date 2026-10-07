"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { joinPath, normalizeJoinCode } from "@/lib/joinNight";

function JoinIndexRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const code = normalizeJoinCode(searchParams.get("code"));
    if (code) {
      const email = searchParams.get("email")?.trim();
      const next = email
        ? `${joinPath(code)}?email=${encodeURIComponent(email)}`
        : joinPath(code);
      router.replace(next);
      return;
    }
    router.replace("/dashboard");
  }, [router, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center text-slate-400">
      Loading…
    </div>
  );
}

export default function JoinIndexPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-slate-400">
          Loading…
        </div>
      }
    >
      <JoinIndexRedirect />
    </Suspense>
  );
}
