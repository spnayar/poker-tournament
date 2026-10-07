"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { EmailLoginForm } from "@/components/EmailLoginForm";
import { formatCents, LEDGER_DISCLAIMER } from "@/lib/utils";
import { joinPath, normalizeJoinCode, tournamentPath } from "@/lib/joinNight";
import type { JoinPreview } from "@/lib/joinNight";

function JoinLanding() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const joinCode = useMemo(
    () => normalizeJoinCode(typeof params.code === "string" ? params.code : ""),
    [params.code]
  );
  const initialEmail = useMemo(
    () => searchParams.get("email")?.trim().toLowerCase() ?? "",
    [searchParams]
  );

  const [preview, setPreview] = useState<JoinPreview | null>(null);
  const [previewError, setPreviewError] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState("");
  const joinAttempted = useRef<string | null>(null);

  useEffect(() => {
    if (!joinCode) {
      setPreviewError("Enter a valid join code.");
      return;
    }
    let cancelled = false;
    fetch(`/api/tournaments/join?code=${encodeURIComponent(joinCode)}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setPreviewError(data.error || "Invalid join code");
          setPreview(null);
          return;
        }
        setPreview(data as JoinPreview);
        setPreviewError("");
      })
      .catch(() => {
        if (!cancelled) setPreviewError("Could not load this game night");
      });
    return () => {
      cancelled = true;
    };
  }, [joinCode]);

  useEffect(() => {
    if (status !== "authenticated" || !joinCode || !session?.user?.id) return;
    if (joinAttempted.current === joinCode) return;
    joinAttempted.current = joinCode;
    let cancelled = false;
    setJoining(true);
    fetch("/api/tournaments/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ joinCode }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setJoinError(data.error || "Could not join game night");
          setJoining(false);
          return;
        }
        const dest =
          data.destination === "table" || data.destination === "results"
            ? data.destination
            : "lobby";
        router.replace(tournamentPath(data.tournamentId, dest));
      })
      .catch(() => {
        if (!cancelled) {
          setJoinError("Could not join game night");
          setJoining(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [status, joinCode, session?.user?.id, router]);

  const callbackUrl = joinCode ? joinPath(joinCode) : "/dashboard";

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900 rounded-2xl p-8 shadow-xl border border-slate-800">
        <div className="flex justify-center mb-5">
          <BrandMark size="lg" />
        </div>
        <h1 className="text-3xl font-bold text-center mb-2">Poker Night</h1>

        {preview && (
          <div className="text-center mb-6">
            <p className="text-slate-300 text-sm">
              {preview.hostDisplayName} invited you to
            </p>
            <p className="text-xl font-semibold mt-1">{preview.name}</p>
            <p className="font-mono tracking-[0.3em] text-emerald-400 text-2xl mt-4">
              {preview.joinCode}
            </p>
            <p className="text-slate-400 text-sm mt-2">
              {formatCents(preview.buyInCents)} buy-in (ledger) ·{" "}
              {preview.playerCount}/{preview.maxPlayers} players
            </p>
            <p className="text-amber-400/80 text-xs mt-3">{LEDGER_DISCLAIMER}</p>
          </div>
        )}

        {(previewError || joinError) && (
          <p className="text-red-400 text-sm text-center mb-4">
            {joinError || previewError}
          </p>
        )}

        {status === "loading" || (status === "authenticated" && joining) ? (
          <p className="text-slate-400 text-center text-sm">
            {status === "authenticated"
              ? "Taking you to the game night…"
              : "Loading…"}
          </p>
        ) : status === "unauthenticated" && joinCode && !previewError ? (
          <>
            <p className="text-slate-400 text-sm text-center mb-4">
              Sign in to join. If you&apos;re new, you&apos;ll need the club
              invite code to create an account.
            </p>
            <EmailLoginForm
              callbackUrl={callbackUrl}
              initialEmail={initialEmail}
            />
          </>
        ) : null}

        <p className="text-center mt-6 text-slate-400 text-sm">
          <Link href="/dashboard" className="text-emerald-400 hover:underline">
            Go to dashboard
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function JoinPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-slate-400">
          Loading…
        </div>
      }
    >
      <JoinLanding />
    </Suspense>
  );
}
