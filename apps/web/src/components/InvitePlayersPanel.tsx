"use client";

import { useEffect, useState } from "react";
import type { PastPlayer, InviteEmailResult } from "@/lib/gameNightInvite";
import { invitePeoplePayload, type InviteDraft } from "@/lib/inviteList";
import { InviteComposeBox } from "@/components/InviteComposeBox";

export function InvitePlayersPanel({ tournamentId }: { tournamentId: string }) {
  const [suggestions, setSuggestions] = useState<PastPlayer[]>([]);
  const [invites, setInvites] = useState<InviteDraft[]>([]);
  const [draftEmail, setDraftEmail] = useState("");
  const [draftName, setDraftName] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState<InviteEmailResult[] | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/tournaments/${tournamentId}/invite`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.ok) {
          setSuggestions(data.suggestions ?? []);
        }
        setLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [tournamentId]);

  const inviteCount = invites.length;

  async function sendInvites() {
    const people = invitePeoplePayload(invites);
    if (people.length === 0) {
      setError("Add people to the invite list first");
      return;
    }
    setSending(true);
    setError("");
    setResults(null);
    const res = await fetch(`/api/tournaments/${tournamentId}/invite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ people }),
    });
    const data = await res.json().catch(() => ({}));
    setSending(false);
    if (!res.ok) {
      setError(data.error || "Could not send invites");
      return;
    }
    setInvites([]);
    setDraftEmail("");
    setDraftName("");
    setResults(data.results ?? []);
    setPreviewHtml(typeof data.previewHtml === "string" ? data.previewHtml : null);
  }

  const sentCount =
    results?.filter((r) => r.status === "sent" || r.status === "skipped")
      .length ?? 0;

  return (
    <div className="bg-slate-900 rounded-xl p-5 border border-slate-800 mb-6">
      <InviteComposeBox
        invites={invites}
        onChange={(next) => {
          setResults(null);
          setError("");
          setInvites(next);
        }}
        suggestions={suggestions}
        loaded={loaded}
        draftEmail={draftEmail}
        draftName={draftName}
        onDraftEmailChange={(value) => {
          setDraftEmail(value);
          setError("");
        }}
        onDraftNameChange={setDraftName}
        error={error}
      />

      <button
        type="button"
        onClick={sendInvites}
        disabled={sending || inviteCount === 0}
        className="w-full mt-3 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm font-medium disabled:opacity-50"
      >
        {sending
          ? "Sending…"
          : inviteCount === 0
            ? "Send invites"
            : `Send ${inviteCount} invite${inviteCount === 1 ? "" : "s"}`}
      </button>

      {results && (
        <div className="mt-4 text-sm">
          <p className="text-emerald-400">
            {sentCount > 0
              ? `Invites processed for ${sentCount} address${sentCount === 1 ? "" : "es"}.`
              : "No invites were sent."}
          </p>
          <ul className="mt-2 space-y-1 text-slate-400 text-xs">
            {results.map((row) => (
              <li key={row.email}>
                {row.email}:{" "}
                {row.status === "sent"
                  ? row.accountCreated
                    ? "sent (new account + magic link)"
                    : "sent (magic link)"
                  : row.status === "skipped"
                    ? "queued locally (no Resend key) — preview below"
                    : row.status === "rate_limited"
                      ? "rate limited"
                      : "skipped (that's you)"}
              </li>
            ))}
          </ul>
        </div>
      )}

      {previewHtml && (
        <div className="mt-4">
          <p className="text-xs text-slate-500 mb-2">Email preview</p>
          <iframe
            title="Invite email preview"
            className="w-full h-[420px] rounded-lg border border-slate-800 bg-slate-950"
            srcDoc={previewHtml}
          />
        </div>
      )}
    </div>
  );
}
