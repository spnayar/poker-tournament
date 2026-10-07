"use client";

import { Suspense, useMemo, useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import {
  MAGIC_LINK_SEND_ERROR,
  magicLinkSendFailed,
} from "@/lib/magicLinkUi";

function loginErrorMessage(code: string | null): string {
  if (code === "Verification") {
    return "That login link is invalid or expired. Request a new one.";
  }
  if (code === "AccessDenied") {
    return "Could not sign you in. Request a new login link.";
  }
  if (code === "EmailSignin") {
    return MAGIC_LINK_SEND_ERROR;
  }
  if (code) {
    return "Could not sign you in. Request a new login link.";
  }
  return "";
}

function LoginForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [needsInvite, setNeedsInvite] = useState(false);
  const [error, setError] = useState(() =>
    loginErrorMessage(searchParams.get("error"))
  );
  const [loading, setLoading] = useState(false);

  const callbackUrl = useMemo(
    () => searchParams.get("callbackUrl") || "/dashboard",
    [searchParams]
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setError("Enter your email");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const startRes = await fetch("/api/login/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: normalizedEmail,
          inviteCode: needsInvite ? inviteCode : undefined,
        }),
      });
      const startData = (await startRes.json().catch(() => ({}))) as {
        status?: string;
        error?: string;
      };

      if (startData.status === "needs_invite") {
        setNeedsInvite(true);
        return;
      }

      if (!startRes.ok) {
        setError(startData.error || "Could not start login");
        return;
      }

      const signInResult = await signIn("email", {
        email: normalizedEmail,
        callbackUrl,
        redirect: false,
      });

      if (magicLinkSendFailed(signInResult)) {
        setError(MAGIC_LINK_SEND_ERROR);
        return;
      }

      const next = new URL("/check-email", window.location.origin);
      next.searchParams.set("email", normalizedEmail);
      window.location.assign(next.toString());
    } catch {
      setError("Could not start login");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900 rounded-2xl p-8 shadow-xl border border-slate-800">
        <div className="flex justify-center mb-5">
          <BrandMark size="lg" />
        </div>
        <h1 className="text-3xl font-bold text-center mb-2">Poker Night</h1>
        <p className="text-slate-400 text-center mb-8 text-sm">
          Texas Hold&apos;em game nights with friends
        </p>

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError("");
              }}
              className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 focus:border-emerald-500 focus:outline-none"
              autoComplete="email"
              required
            />
          </div>
          {needsInvite && (
            <div>
              <label className="block text-sm text-slate-400 mb-1">
                Invite Code
              </label>
              <input
                type="text"
                value={inviteCode}
                onChange={(e) => {
                  setInviteCode(e.target.value);
                  setError("");
                }}
                className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 focus:border-emerald-500 focus:outline-none"
                autoComplete="off"
                required
                autoFocus
              />
              <p className="text-slate-500 text-xs mt-2">
                New here? Enter the invite code and we&apos;ll create your
                account, then email a login link. You can set your name after
                you sign in.
              </p>
            </div>
          )}
          {error && (
            <p className="text-red-400 text-sm text-center">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 rounded-lg font-semibold transition disabled:opacity-50"
          >
            {loading
              ? needsInvite
                ? "Creating account..."
                : "Sending link..."
              : "Email me a login link"}
          </button>
        </form>

        <p className="text-center mt-6 text-slate-400 text-sm">
          No account?{" "}
          <Link href="/register" className="text-emerald-400 hover:underline">
            Register with invite code
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-slate-400">
          Loading…
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
