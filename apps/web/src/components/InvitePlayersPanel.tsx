"use client";

import { useEffect, useState } from "react";
import { getAvatarUrl } from "@/lib/utils";
import type { PastPlayer, InviteEmailResult } from "@/lib/gameNightInvite";
import {
  addInvite,
  addInviteFromEmail,
  hasInvite,
  inviteEmails,
  inviteFromPastPlayer,
  removeInvite,
  type InviteDraft,
} from "@/lib/inviteList";

export function InvitePlayersPanel({ tournamentId }: { tournamentId: string }) {
  const [suggestions, setSuggestions] = useState<PastPlayer[]>([]);
  const [invites, setInvites] = useState<InviteDraft[]>([]);
  const [draft, setDraft] = useState("");
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

  function queuePastPlayer(player: PastPlayer) {
    setResults(null);
    setError("");
    setInvites((prev) => addInvite(prev, inviteFromPastPlayer(player)));
  }

  function queueDraft() {
    const { list, ok } = addInviteFromEmail(invites, draft, suggestions);
    if (!ok) {
      setError("Enter a valid email");
      return;
    }
    setDraft("");
    setError("");
    setResults(null);
    setInvites(list);
  }

  function dropInvite(email: string) {
    setResults(null);
    setError("");
    setInvites((prev) => removeInvite(prev, email));
  }

  async function sendInvites() {
    const emails = inviteEmails(invites);
    if (emails.length === 0) {
      setError("Add people to the invite list first");
      return;
    }
    setSending(true);
    setError("");
    setResults(null);
    const res = await fetch(`/api/tournaments/${tournamentId}/invite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emails }),
    });
    const data = await res.json().catch(() => ({}));
    setSending(false);
    if (!res.ok) {
      setError(data.error || "Could not send invites");
      return;
    }
    setInvites([]);
    setDraft("");
    setResults(data.results ?? []);
    setPreviewHtml(typeof data.previewHtml === "string" ? data.previewHtml : null);
  }

  const sentCount =
    results?.filter((r) => r.status === "sent" || r.status === "skipped")
      .length ?? 0;

  return (
    <div className="bg-slate-900 rounded-xl p-5 border border-slate-800 mb-6">
      <h3 className="font-semibold mb-1">Invite players</h3>
      <p className="text-slate-400 text-sm mb-4">
        Build the invite list, then send once. We email the join code and a
        one-click link.
      </p>

      {loaded && suggestions.length > 0 && (
        <div className="mb-4">
          <p className="text-xs text-slate-500 mb-2">Past players</p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((player) => {
              const queued = hasInvite(invites, player.email);
              return (
                <button
                  key={player.userId}
                  type="button"
                  onClick={() => queuePastPlayer(player)}
                  disabled={queued}
                  title={
                    queued
                      ? `${player.displayName} is already on the invite list`
                      : `Add ${player.displayName} to the invite list`
                  }
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition ${
                    queued
                      ? "bg-slate-800/60 border-slate-700 text-slate-500 cursor-default"
                      : "bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700 hover:border-emerald-600/60"
                  }`}
                >
                  <img
                    src={getAvatarUrl(player.displayName, player.avatarUrl)}
                    alt=""
                    className="w-5 h-5 rounded-full"
                  />
                  <span>{player.displayName}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {loaded && suggestions.length === 0 && (
        <p className="text-xs text-slate-500 mb-3">
          No past players yet. Type emails below.
        </p>
      )}

      <div className="rounded-lg border border-slate-700 bg-slate-950/70 mb-3">
        <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Invites
          </p>
          <p className="text-xs text-slate-500">
            {inviteCount === 0
              ? "None yet"
              : `${inviteCount} to email`}
          </p>
        </div>
        {inviteCount === 0 ? (
          <p className="px-3 py-4 text-sm text-slate-500">
            Click a past player or add an email. Nothing is sent until you hit
            Send.
          </p>
        ) : (
          <ul className="divide-y divide-slate-800">
            {invites.map((row) => (
              <li
                key={row.email}
                className="flex items-center gap-3 px-3 py-2"
              >
                <img
                  src={getAvatarUrl(row.displayName ?? row.email, row.avatarUrl)}
                  alt=""
                  className="w-7 h-7 rounded-full shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-slate-100 truncate">
                    {row.displayName ?? row.email}
                  </p>
                  {row.displayName && (
                    <p className="text-xs text-slate-500 truncate">{row.email}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => dropInvite(row.email)}
                  className="text-slate-500 hover:text-red-400 text-sm px-2 py-1 rounded-md"
                  aria-label={`Remove ${row.displayName ?? row.email}`}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex gap-2 mb-3">
        <input
          type="email"
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setError("");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              queueDraft();
            }
          }}
          placeholder="friend@email.com"
          className="flex-1 px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 focus:border-emerald-500 focus:outline-none text-sm"
        />
        <button
          type="button"
          onClick={queueDraft}
          disabled={!draft.trim()}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg text-sm font-medium disabled:opacity-50 shrink-0"
        >
          Add
        </button>
      </div>

      <button
        type="button"
        onClick={sendInvites}
        disabled={sending || inviteCount === 0}
        className="w-full px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm font-medium disabled:opacity-50"
      >
        {sending
          ? "Sending…"
          : inviteCount === 0
            ? "Send invites"
            : `Send ${inviteCount} invite${inviteCount === 1 ? "" : "s"}`}
      </button>
      {error && <p className="text-red-400 text-sm mt-2">{error}</p>}

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
                  ? "sent"
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
