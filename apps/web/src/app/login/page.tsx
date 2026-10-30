"use client";

import { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { EmailLoginForm } from "@/components/EmailLoginForm";
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
          Texas Hold&apos;em game nights with friends. Open signup isn&apos;t
          available yet — use the path that fits you.
        </p>

        {error && (
          <p className="text-red-400 text-sm text-center mb-4">{error}</p>
        )}

        <ol className="space-y-6">
          <li>
            <h2 className="text-sm font-semibold text-slate-100">
              1. Already signed up
            </h2>
            <p className="text-slate-400 text-sm mt-1 mb-3 text-balance">
              Get a magic link for the email on your account. No password.
            </p>
            <EmailLoginForm
              callbackUrl={callbackUrl}
              initialEmail={initialEmail}
            />
          </li>
          <li>
            <h2 className="text-sm font-semibold text-slate-100">
              2. You were invited
            </h2>
            <p className="text-slate-400 text-sm mt-1 text-balance">
              Sign up if you have an invite code or an invitation. Without a
              code, this path won&apos;t let you in.
            </p>
            <p className="mt-2">
              <Link
                href="/register"
                className="text-emerald-400 hover:underline text-sm"
              >
                Register with invite code
              </Link>
            </p>
          </li>
          <li>
            <h2 className="text-sm font-semibold text-slate-100">
              3. Neither of those
            </h2>
            <p className="text-slate-400 text-sm mt-1 text-balance">
              You can&apos;t access the site yet. Email{" "}
              <a
                href={`mailto:${CLUB_CONTACT_EMAIL}`}
                className="text-emerald-400 hover:underline"
              >
                {CLUB_CONTACT_EMAIL}
              </a>{" "}
              and we&apos;ll tell you how to get in.
            </p>
          </li>
        </ol>
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
