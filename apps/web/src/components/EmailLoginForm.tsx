"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { CLUB_CONTACT_EMAIL } from "@/lib/clubContact";
import {
  MAGIC_LINK_SEND_ERROR,
  magicLinkSendFailed,
} from "@/lib/magicLinkUi";

export function EmailLoginForm({
  callbackUrl,
  initialEmail = "",
  initialNeedsInvite = false,
}: {
  callbackUrl: string;
  initialEmail?: string;
  /** Shows the unknown-email invite step. Used to render that state directly. */
  initialNeedsInvite?: boolean;
}) {
  const [email, setEmail] = useState(initialEmail);
  const [inviteCode, setInviteCode] = useState("");
  const [needsInvite, setNeedsInvite] = useState(initialNeedsInvite);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const joiningNight = callbackUrl.startsWith("/join/");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setError("Enter your email");
      return;
    }
    if (needsInvite && !inviteCode.trim()) {
      setError("Enter your invite code");
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
        <label htmlFor="login-email" className="block text-sm text-slate-400 mb-1">
          Email
        </label>
        <input
          id="login-email"
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
          <p
            id="login-invite-notice"
            role="status"
            className="text-sm text-amber-300 mb-3 text-balance"
          >
            This email isn&apos;t signed up, so a login link won&apos;t get you
            in. You need an invite code — without one, you can&apos;t access
            the site yet. No code? Email{" "}
            <a
              href={`mailto:${CLUB_CONTACT_EMAIL}`}
              className="underline hover:text-amber-200"
            >
              {CLUB_CONTACT_EMAIL}
            </a>
            .
          </p>
          <label
            htmlFor="login-invite-code"
            className="block text-sm text-slate-400 mb-1"
          >
            Invite Code
          </label>
          <input
            id="login-invite-code"
            type="text"
            value={inviteCode}
            onChange={(e) => {
              setInviteCode(e.target.value);
              setError("");
            }}
            className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 focus:border-emerald-500 focus:outline-none"
            autoComplete="off"
            aria-describedby="login-invite-notice"
            required
            autoFocus
          />
          <p className="text-slate-400 text-sm mt-2">
            {joiningNight
              ? "Enter the code and we'll email a login link. After you sign in, you'll join this game night."
              : "Enter the code and we'll email a login link."}
          </p>
        </div>
      )}
      {error && (
        <p className="text-red-400 text-sm text-center" role="alert">
          {error}
        </p>
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
          : needsInvite
            ? "Create account and send link"
            : "Email me a login link"}
      </button>
    </form>
  );
}
