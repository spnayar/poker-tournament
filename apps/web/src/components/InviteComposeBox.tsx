"use client";

import { getAvatarUrl } from "@/lib/utils";
import type { PastPlayer } from "@/lib/gameNightInvite";
import {
  addInvite,
  addInviteFromEmail,
  hasInvite,
  inviteFromPastPlayer,
  removeInvite,
  type InviteDraft,
} from "@/lib/inviteList";

type InviteComposeBoxProps = {
  invites: InviteDraft[];
  onChange: (invites: InviteDraft[]) => void;
  suggestions: PastPlayer[];
  loaded?: boolean;
  /** Compact copy for the create form. */
  compact?: boolean;
  draftEmail: string;
  draftName: string;
  onDraftEmailChange: (value: string) => void;
  onDraftNameChange: (value: string) => void;
  error?: string;
};

export function InviteComposeBox({
  invites,
  onChange,
  suggestions,
  loaded = true,
  compact = false,
  draftEmail,
  draftName,
  onDraftEmailChange,
  onDraftNameChange,
  error,
}: InviteComposeBoxProps) {
  const inviteCount = invites.length;

  function queuePastPlayer(player: PastPlayer) {
    onChange(addInvite(invites, inviteFromPastPlayer(player)));
  }

  function queueDraft() {
    const { list, ok } = addInviteFromEmail(
      invites,
      draftEmail,
      suggestions,
      draftName
    );
    if (!ok) return false;
    onChange(list);
    onDraftEmailChange("");
    onDraftNameChange("");
    return true;
  }

  return (
    <div className={compact ? "" : ""}>
      {!compact && (
        <>
          <h3 className="font-semibold mb-1">Invite players</h3>
          <p className="text-slate-400 text-sm mb-4">
            Emails preferred; names optional. Past players are one click. New
            players get a magic login link plus the join code.
          </p>
        </>
      )}
      {compact && (
        <div className="mb-3">
          <h4 className="text-sm font-semibold text-slate-100">
            Invite players
          </h4>
          <p className="text-xs text-slate-400 mt-0.5">
            Optional — add emails (and names) now. We create accounts for new
            friends and email a magic login link with the join code.
          </p>
        </div>
      )}

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
            {inviteCount === 0 ? "None yet" : `${inviteCount} queued`}
          </p>
        </div>
        {inviteCount === 0 ? (
          <p className="px-3 py-4 text-sm text-slate-500">
            Click a past player or add an email. Nothing is sent until you create
            or hit Send.
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
                  onClick={() => onChange(removeInvite(invites, row.email))}
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

      <div className="grid sm:grid-cols-[1fr_1fr_auto] gap-2 mb-1">
        <input
          type="email"
          value={draftEmail}
          onChange={(e) => onDraftEmailChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              queueDraft();
            }
          }}
          placeholder="friend@email.com"
          className="px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 focus:border-emerald-500 focus:outline-none text-sm"
        />
        <input
          type="text"
          value={draftName}
          onChange={(e) => onDraftNameChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              queueDraft();
            }
          }}
          placeholder="Name (optional)"
          className="px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 focus:border-emerald-500 focus:outline-none text-sm"
        />
        <button
          type="button"
          onClick={() => queueDraft()}
          disabled={!draftEmail.trim()}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg text-sm font-medium disabled:opacity-50 shrink-0"
        >
          Add
        </button>
      </div>
      {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
    </div>
  );
}
