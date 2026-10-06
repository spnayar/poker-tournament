"use client";

import { Suspense, useMemo, useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";

function CheckEmailForm() {
  const searchParams = useSearchParams();
  const email = useMemo(
    () => searchParams.get("email")?.trim().toLowerCase() ?? "",
    [searchParams]
  );
  const [sending, setSending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [message, setMessage] = useState("");

  async function resend() {
    if (!email || sending || cooldown > 0) return;
    setSending(true);
    setMessage("");
    await signIn("email", {
      email,
      callbackUrl: "/dashboard",
      redirect: false,
    });
    setSending(false);
    setMessage("If that email is registered, we sent another link.");
    setCooldown(60);
    const started = Date.now();
    const tick = window.setInterval(() => {
      const left = 60 - Math.floor((Date.now() - started) / 1000);
      if (left <= 0) {
        window.clearInterval(tick);
        setCooldown(0);
      } else {
        setCooldown(left);
      }
    }, 1000);
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900 rounded-2xl p-8 shadow-xl border border-slate-800">
        <div className="flex justify-center mb-5">
          <BrandMark size="lg" />
        </div>
        <h1 className="text-3xl font-bold text-center mb-2">Check your email</h1>
        <p className="text-slate-400 text-center mb-6 text-sm">
          If that email is registered, we sent a login link. It expires in 15
          minutes and can only be used once.
        </p>
        {email && (
          <p className="text-center text-emerald-400 text-sm mb-6 break-all">
            {email}
          </p>
        )}
        <p className="text-slate-500 text-center text-xs mb-8">
          After you click the link, this browser stays signed in for about a
          year. A new device or cleared cookies needs a new link.
        </p>
        {message && (
          <p className="text-amber-300 text-sm text-center mb-4">{message}</p>
        )}
        <button
          type="button"
          onClick={resend}
          disabled={!email || sending || cooldown > 0}
          className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 rounded-lg font-semibold transition disabled:opacity-50"
        >
          {sending
            ? "Sending..."
            : cooldown > 0
              ? `Resend in ${cooldown}s`
              : "Resend login link"}
        </button>
        <p className="text-center mt-6 text-slate-400 text-sm">
          Wrong address?{" "}
          <Link href="/login" className="text-emerald-400 hover:underline">
            Use a different email
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function CheckEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-slate-400">
          Loading…
        </div>
      }
    >
      <CheckEmailForm />
    </Suspense>
  );
}
