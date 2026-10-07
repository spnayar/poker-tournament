"use client";

import { useEffect, useMemo, useState } from "react";
import { getAvatarUrl } from "@/lib/utils";
import { EMAIL_RE } from "@/lib/register";
import type { PastPlayer, InviteEmailResult } from "@/lib/gameNightInvite";

function addEmail(list: string[], raw: string): string[] {
  const email = raw.trim().toLowerCase();
  if (!email || !EMAIL_RE.test(email) || list.includes(email)) return list;
  return [...list, email];
}

export function InvitePlayersPanel({ tournamentId }: { tournamentId: string }) {
  const [suggestions, setSuggestions] = useState<PastPlayer[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
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

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  function toggleSuggestion(email: string) {
    setResults(null);
    setError("");
    setSelected((prev) =>
      prev.includes(email) ? prev.filter((e) => e !== email) : [...prev, email]
    );
  }

  function commitDraft() {
    const next = addEmail(selected, draft);
    if (next === selected && draft.trim()) {
      setError("Enter a valid email");
      return;
    }
    setDraft("");
    setError("");
    setSelected(next);
  }

  async function sendInvites() {
    const fromDraft = addEmail(selected, draft);
    const emails = fromDraft;
    if (emails.length === 0) {
      setError("Pick a past player or type an email");
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
    setSelected([]);
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
        Re-add people from nights you hosted or played, or type a new email.
        We&apos;ll send the join code and a one-click link.
      </p>

      {loaded && suggestions.length > 0 && (
        <div className="mb-4">
          <p className="text-xs text-slate-500 mb-2">Past players</p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((player) => {
              const on = selectedSet.has(player.email);
              return (
                <button
                  key={player.userId}
                  type="button"
                  onClick={() => toggleSuggestion(player.email)}
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition ${
                    on
                      ? "bg-emerald-600 border-emerald-500 text-white"
                      : "bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700"
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

      {selected.filter(
        (email) => !suggestions.some((p) => p.email === email)
      ).length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {selected
            .filter((email) => !suggestions.some((p) => p.email === email))
            .map((email) => (
              <button
                key={email}
                type="button"
                onClick={() => toggleSuggestion(email)}
                className="inline-flex items-center gap-1 rounded-full bg-emerald-600/20 border border-emerald-700/50 text-emerald-300 text-xs px-3 py-1"
              >
                {email}
                <span aria-hidden="true">×</span>
              </button>
            ))}
        </div>
      )}

      <div className="flex gap-2">
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
              commitDraft();
            }
          }}
          onBlur={() => {
            if (draft.trim()) commitDraft();
          }}
          placeholder="friend@email.com"
          className="flex-1 px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 focus:border-emerald-500 focus:outline-none text-sm"
        />
        <button
          type="button"
          onClick={sendInvites}
          disabled={sending || (selected.length === 0 && !draft.trim())}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm font-medium disabled:opacity-50 shrink-0"
        >
          {sending
            ? "Sending…"
            : selected.length > 0
              ? `Send ${selected.length + (EMAIL_RE.test(draft.trim().toLowerCase()) && !selected.includes(draft.trim().toLowerCase()) ? 1 : 0)}`
              : "Send invites"}
        </button>
      </div>
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
