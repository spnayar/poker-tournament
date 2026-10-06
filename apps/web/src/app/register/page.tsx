"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { REGISTER_SEND_ERROR, magicLinkSendFailed } from "@/lib/magicLinkUi";

export default function RegisterPage() {
  const [form, setForm] = useState({
    email: "",
    inviteCode: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    const data = await res.json();
    if (!res.ok) {
      setLoading(false);
      setError(data.error || "Registration failed");
      return;
    }

    const email = data.email as string;
    const signInResult = await signIn("email", {
      email,
      callbackUrl: "/dashboard",
      redirect: false,
    });

    if (magicLinkSendFailed(signInResult)) {
      setLoading(false);
      setError(REGISTER_SEND_ERROR);
      return;
    }

    const next = new URL("/check-email", window.location.origin);
    next.searchParams.set("email", email);
    window.location.assign(next.toString());
  }

  const fields = [
    { key: "email" as const, label: "Email", type: "email" },
    { key: "inviteCode" as const, label: "Invite Code", type: "text" },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900 rounded-2xl p-8 shadow-xl border border-slate-800">
        <div className="flex justify-center mb-5">
          <BrandMark size="lg" />
        </div>
        <h1 className="text-3xl font-bold text-center mb-2">Join Poker Night</h1>
        <p className="text-slate-400 text-center mb-8 text-sm">
          Invite-only registration for friends. We&apos;ll email you a login
          link — no password. You can set your name and avatar after you sign
          in.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {fields.map((field) => (
            <div key={field.key}>
              <label className="block text-sm text-slate-400 mb-1">
                {field.label}
              </label>
              <input
                type={field.type}
                value={form[field.key]}
                onChange={(e) =>
                  setForm((f) => ({ ...f, [field.key]: e.target.value }))
                }
                className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 focus:border-emerald-500 focus:outline-none"
                autoComplete={field.key === "email" ? "email" : "off"}
                required
              />
            </div>
          ))}
          {error && (
            <p className="text-red-400 text-sm text-center">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 rounded-lg font-semibold transition disabled:opacity-50"
          >
            {loading ? "Creating account..." : "Create Account"}
          </button>
        </form>

        <p className="text-center mt-6 text-slate-400 text-sm">
          Already have an account?{" "}
          <Link href="/login" className="text-emerald-400 hover:underline">
            Email me a login link
          </Link>
        </p>
      </div>
    </div>
  );
}
