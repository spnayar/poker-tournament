"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import {
  MAGIC_LINK_SEND_ERROR,
  magicLinkSendFailed,
} from "@/lib/magicLinkUi";

export function EmailLoginForm({
  callbackUrl,
  initialEmail = "",
}: {
  callbackUrl: string;
  initialEmail?: string;
}) {
  const [email, setEmail] = useState(initialEmail);
  const [inviteCode, setInviteCode] = useState("");
  const [needsInvite, setNeedsInvite] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
      if (callbackUrl && callbackUrl !== "/dashboard") {
        next.searchParams.set("callbackUrl", callbackUrl);
      }
      window.location.assign(next.toString());
    } catch {
      setError("Could not start login");
    } finally {
      setLoading(false);
    }
  }

  return (
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
            New here? Enter the club invite code and we&apos;ll create your
            account, then email a login link. After you sign in you&apos;ll
            land in this game night.
          </p>
        </div>
      )}
      {error && <p className="text-red-400 text-sm text-center">{error}</p>}
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
  );
}
