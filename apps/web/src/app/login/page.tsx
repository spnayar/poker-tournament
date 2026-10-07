"use client";

import { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { EmailLoginForm } from "@/components/EmailLoginForm";
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
        <p className="text-slate-400 text-center mb-8 text-sm">
          Texas Hold&apos;em game nights with friends
        </p>

        {error && (
          <p className="text-red-400 text-sm text-center mb-4">{error}</p>
        )}

        <EmailLoginForm
          callbackUrl={callbackUrl}
          initialEmail={initialEmail}
        />

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
