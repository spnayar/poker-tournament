"use client";

import { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { BrandMark } from "@/components/BrandMark";
import { EmailLoginForm } from "@/components/EmailLoginForm";
import { InstagramFollowLink } from "@/components/InstagramFollowLink";
import { CLUB_CONTACT_EMAIL } from "@/lib/clubContact";
import { MAGIC_LINK_SEND_ERROR } from "@/lib/magicLinkUi";

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
  const callbackUrl = useMemo(
    () => searchParams.get("callbackUrl") || "/dashboard",
    [searchParams]
  );
  const initialEmail = useMemo(
    () => searchParams.get("email")?.trim().toLowerCase() ?? "",
    [searchParams]
  );
  const error = loginErrorMessage(searchParams.get("error"));

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900 rounded-2xl p-8 shadow-xl border border-slate-800">
        <div className="flex justify-center mb-5">
          <BrandMark size="lg" />
        </div>
        <h1 className="text-3xl font-bold text-center mb-2">Poker Night</h1>
        <p className="text-slate-400 text-center mb-6 text-sm text-balance">
          Texas Hold&apos;em with friends. Friends-only — we email a login
          link. No password.
        </p>

        {error && (
          <p className="text-red-400 text-sm text-center mb-4">{error}</p>
        )}

        <EmailLoginForm
          callbackUrl={callbackUrl}
          initialEmail={initialEmail}
        />

        <p className="mt-5 text-center text-slate-500 text-xs text-balance">
          New here? Try your email first — if you don&apos;t have an account
          yet, we&apos;ll ask for a club invite code. No code? Email{" "}
          <a
            href={`mailto:${CLUB_CONTACT_EMAIL}`}
            className="text-emerald-400/90 hover:text-emerald-300 hover:underline"
          >
            {CLUB_CONTACT_EMAIL}
          </a>
          .
        </p>

        <div className="mt-6 pt-4 border-t border-slate-800/80 flex justify-center">
          <InstagramFollowLink />
        </div>
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
