"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { formatCents, getAvatarUrl, LEDGER_DISCLAIMER } from "@/lib/utils";
import { BrandLockup } from "@/components/BrandMark";
import {
  createGameNightFormDefaults,
  parsePayoutPercents,
  payoutFormForPaidPlaces,
  payoutPercentsSum,
  payoutValuesForPaidPlaces,
  validatePayoutPercents,
  type LastHostedDefaults,
} from "@/lib/tournament";
import {
  nextPasscodeAfterJoinUrlChange,
  resolveZoomCreateAttach,
} from "@/lib/zoomJoinUrl";
import {
  ACTION_TIMER_SECONDS_OPTIONS,
  BLIND_LEVEL_MINUTE_OPTIONS,
  BLIND_PACE_LABELS,
  buildBlindLevels,
  formatActionTimerLabel,
  type BlindPace,
  type PaidPlaceCount,
} from "@poker/protocol";
import {
  needsProfileSetup,
  PROFILE_PROMPT_DISMISS_KEY,
} from "@/lib/profileSetup";
import { JOIN_CODE_MAX_LENGTH, JOIN_CODE_MIN_LENGTH } from "@/lib/joinNight";
import type { PastPlayer } from "@/lib/gameNightInvite";
import {
  invitePeoplePayload,
  type InviteDraft,
} from "@/lib/inviteList";
import { InviteComposeBox } from "@/components/InviteComposeBox";
import { PlayStatsPanel } from "@/components/PlayStatsPanel";
import type { PlayerDashboardStats } from "@/lib/playerDashboardStats";

interface Tournament {
  id: string;
  name: string;
  status: string;
  buyInCents: number;
  startingChips: number;
  maxPlayers: number;
  hostUserId: string;
  host: { displayName: string };
  games?: { id: string }[];
  _count: { players: number };
}

interface DashboardUser {
  displayName: string;
  displayNameSet: boolean;
  avatarUrl: string | null;
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [playStats, setPlayStats] = useState<PlayerDashboardStats | null>(
    null
  );
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [joinError, setJoinError] = useState("");
  const [joining, setJoining] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [lastHostedDefaults, setLastHostedDefaults] =
    useState<LastHostedDefaults | null>(null);
  const [form, setForm] = useState(() => createGameNightFormDefaults());
  const [dashboardUser, setDashboardUser] = useState<DashboardUser | null>(
    null
  );
  const [profilePromptDismissed, setProfilePromptDismissed] = useState(false);
  const [nightsReady, setNightsReady] = useState(false);
  const [pastPlayers, setPastPlayers] = useState<PastPlayer[]>([]);
  const [createInvites, setCreateInvites] = useState<InviteDraft[]>([]);
  const [inviteDraftEmail, setInviteDraftEmail] = useState("");
  const [inviteDraftName, setInviteDraftName] = useState("");
  const [inviteError, setInviteError] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (status === "unauthenticated") {
      setNightsReady(false);
      return;
    }
    if (status === "authenticated") {
      try {
        setProfilePromptDismissed(
          sessionStorage.getItem(PROFILE_PROMPT_DISMISS_KEY) === "1"
        );
      } catch {
        // ignore sessionStorage failures
      }
      setNightsReady(false);
      fetch("/api/tournaments")
        .then(async (r) => {
          const data = await r.json().catch(() => ({}));
          if (!r.ok) {
            console.error("Failed to load tournaments:", data.error ?? r.status);
            return;
          }
          setTournaments(data.tournaments ?? []);
          setPlayStats(data.playStats ?? null);
          setPastPlayers(data.pastPlayers ?? []);
          const defaults = data.lastHostedDefaults ?? null;
          setLastHostedDefaults(defaults);
          setForm(createGameNightFormDefaults(defaults));
          if (data.user) {
            setDashboardUser({
              displayName: data.user.displayName,
              displayNameSet: data.user.displayNameSet !== false,
              avatarUrl: data.user.avatarUrl ?? null,
            });
          }
        })
        .finally(() => setNightsReady(true));
    }
  }, [status]);

  async function createTournament() {
    const payoutValues = payoutValuesForPaidPlaces(form);
    const payoutError = validatePayoutPercents(payoutValues);
    if (payoutError) {
      alert(payoutError);
      return;
    }

    const zoomCheck = resolveZoomCreateAttach({
      zoomJoinUrl: form.zoomJoinUrl,
      zoomPasscodePlain: form.zoomPasscodePlain,
    });
    if (!zoomCheck.ok) {
      alert(zoomCheck.error);
      return;
    }

    setCreating(true);
    const res = await fetch("/api/tournaments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        buyInCents: Math.round(parseFloat(form.buyInDollars) * 100),
        startingChips: parseInt(form.startingChips, 10),
        maxPlayers: parseInt(form.maxPlayers, 10),
        blindPace: form.blindPace,
        blindLevelMinutes: form.blindLevelMinutes,
        actionTimerSeconds: form.actionTimerSeconds,
        payoutPercents: parsePayoutPercents(payoutValues) ?? [],
        zoomJoinUrl: form.zoomJoinUrl.trim() || undefined,
        zoomPasscodePlain: form.zoomPasscodePlain.trim() || undefined,
        invites: invitePeoplePayload(createInvites),
      }),
    });
    const tournament = await res.json().catch(() => ({}));
    setCreating(false);
    if (res.ok && tournament.id) {
      setCreateInvites([]);
      setInviteDraftEmail("");
      setInviteDraftName("");
      router.push(`/tournament/${tournament.id}`);
    } else alert(tournament.error || "Could not create game night");
  }

  async function joinTournament() {
    setJoining(true);
    setJoinError("");
    const res = await fetch("/api/tournaments/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ joinCode: joinCode.trim() }),
    });
    const data = await res.json();
    setJoining(false);
    if (!res.ok) {
      setJoinError(data.error || "Could not join game night");
      return;
    }
    const dest =
      data.destination === "table"
        ? `/tournament/${data.tournamentId}/table`
        : data.destination === "results"
          ? `/tournament/${data.tournamentId}/results`
          : `/tournament/${data.tournamentId}`;
    router.push(dest);
  }

  async function deleteTournament(tournamentId: string, name: string) {
    if (
      !confirm(
        `Delete "${name}"? This cannot be undone and will remove it for all players.`
      )
    ) {
      return;
    }

    setDeletingId(tournamentId);
    const res = await fetch(`/api/tournaments/${tournamentId}`, {
      method: "DELETE",
    });
    setDeletingId(null);

    if (res.ok) {
      setTournaments((prev) => prev.filter((t) => t.id !== tournamentId));
    } else {
      const data = await res.json();
      alert(data.error || "Could not delete game night");
    }
  }

  const payoutValues = payoutValuesForPaidPlaces(form);
  const payoutTotal = payoutPercentsSum(payoutValues);
  const payoutError = validatePayoutPercents(payoutValues);
  const payoutFields = (
    [
      { key: "payout1" as const, label: "1st place", place: 1 },
      { key: "payout2" as const, label: "2nd place", place: 2 },
      { key: "payout3" as const, label: "3rd place", place: 3 },
    ] as const
  ).filter((field) => field.place <= form.paidPlaces);
  const startingChipsNum = parseInt(form.startingChips, 10) || 5000;
  const blindPreview = buildBlindLevels(startingChipsNum, form.blindPace).slice(
    0,
    6
  );

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-slate-400">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 max-w-4xl mx-auto">
      <header className="mb-8">
        <div className="flex items-center justify-between gap-3 mb-6">
          <BrandLockup />
          <div className="flex gap-3 shrink-0">
            {session?.user?.isAdmin && (
              <Link
                href="/admin"
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm"
              >
                Admin
              </Link>
            )}
            <Link
              href="/profile"
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm"
            >
              Profile
            </Link>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm"
            >
              Sign Out
            </button>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <img
            src={getAvatarUrl(session?.user?.name ?? "user", session?.user?.image)}
            alt=""
            className="w-12 h-12 rounded-full bg-slate-800"
          />
          <div>
            <h1 className="text-2xl font-bold">{session?.user?.name}</h1>
            <p className="text-slate-400 text-sm">{session?.user?.email}</p>
          </div>
        </div>
      </header>

      {dashboardUser &&
        needsProfileSetup(dashboardUser) &&
        !profilePromptDismissed && (
          <div className="mb-6 rounded-xl border border-amber-500/30 bg-slate-900 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-amber-300">
                Finish your profile
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                Set a display name and avatar so friends recognize you at the
                table.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Link
                href="/profile"
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-sm font-medium"
              >
                Set up
              </Link>
              <button
                type="button"
                onClick={() => {
                  setProfilePromptDismissed(true);
                  try {
                    sessionStorage.setItem(PROFILE_PROMPT_DISMISS_KEY, "1");
                  } catch {
                    // ignore
                  }
                }}
                className="px-3 py-1.5 rounded-lg text-sm text-slate-400 hover:text-slate-200"
              >
                Later
              </button>
            </div>
          </div>
        )}

      <PlayStatsPanel playStats={playStats} ready={nightsReady} />

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">My Game Nights</h2>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setShowJoin(!showJoin);
              setShowCreate(false);
            }}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-medium"
          >
            Join with Code
          </button>
          <button
            onClick={() => {
              setShowCreate(!showCreate);
              setShowJoin(false);
              if (!showCreate) {
                setForm(createGameNightFormDefaults(lastHostedDefaults));
              }
            }}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm font-medium"
          >
            + Create Game Night
          </button>
        </div>
      </div>

      {showJoin && (
        <div className="bg-slate-900 rounded-xl p-6 mb-6 border border-slate-800">
          <h3 className="font-semibold mb-4">Join a Game Night</h3>
          <p className="text-slate-400 text-sm mb-4">
            Enter the join code shared by the game night host.
          </p>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-sm text-slate-400 mb-1">
                Join code
              </label>
              <input
                type="text"
                value={joinCode}
                onChange={(e) =>
                  setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))
                }
                placeholder="e.g. XK7M"
                maxLength={JOIN_CODE_MAX_LENGTH}
                className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 focus:border-emerald-500 focus:outline-none font-mono tracking-widest uppercase"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={joinTournament}
                disabled={
                  joining ||
                  joinCode.length < JOIN_CODE_MIN_LENGTH ||
                  joinCode.length > JOIN_CODE_MAX_LENGTH
                }
                className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg font-medium disabled:opacity-50"
              >
                {joining ? "Joining..." : "Join"}
              </button>
            </div>
          </div>
          {joinError && (
            <p className="text-red-400 text-sm mt-3">{joinError}</p>
          )}
        </div>
      )}

      {showCreate && (
        <div className="bg-slate-900 rounded-xl p-6 mb-6 border border-slate-800">
          <h3 className="font-semibold mb-4">New Game Night</h3>
          <p className="text-amber-400/80 text-xs mb-4">{LEDGER_DISCLAIMER}</p>
          <div className="grid md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">
                Game night name
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 focus:border-emerald-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">
                Buy-in (ledger, $)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.buyInDollars}
                onChange={(e) =>
                  setForm((f) => ({ ...f, buyInDollars: e.target.value }))
                }
                className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 focus:border-emerald-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">
                Starting chips
              </label>
              <input
                type="number"
                min="1"
                step="1"
                value={form.startingChips}
                onChange={(e) =>
                  setForm((f) => ({ ...f, startingChips: e.target.value }))
                }
                className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 focus:border-emerald-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">
                Blind pace
              </label>
              <select
                value={form.blindPace}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    blindPace: e.target.value as BlindPace,
                  }))
                }
                className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 focus:border-emerald-500 focus:outline-none"
              >
                {(Object.keys(BLIND_PACE_LABELS) as BlindPace[]).map((pace) => (
                  <option key={pace} value={pace}>
                    {BLIND_PACE_LABELS[pace].label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-500 mt-1">
                {BLIND_PACE_LABELS[form.blindPace].description}
              </p>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">
                Minutes per blind level
              </label>
              <select
                value={form.blindLevelMinutes}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    blindLevelMinutes: parseInt(e.target.value, 10),
                  }))
                }
                className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 focus:border-emerald-500 focus:outline-none"
              >
                {BLIND_LEVEL_MINUTE_OPTIONS.map((mins) => (
                  <option key={mins} value={mins}>
                    {mins} minutes
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">
                Action timer
              </label>
              <select
                value={form.actionTimerSeconds}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    actionTimerSeconds: parseInt(e.target.value, 10),
                  }))
                }
                className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 focus:border-emerald-500 focus:outline-none"
              >
                {ACTION_TIMER_SECONDS_OPTIONS.map((secs) => (
                  <option key={secs} value={secs}>
                    {secs === 0
                      ? "Off — no pressure"
                      : `${formatActionTimerLabel(secs)} per action`}
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-500 mt-1">
                Default 60s. Host can pause, reset, or turn off at the table.
              </p>
            </div>
          </div>
          <div className="mb-4 rounded-lg border border-slate-800 bg-slate-950/50 p-3">
            <p className="text-xs font-semibold text-slate-400 mb-2">
              Blind preview (scaled to {startingChipsNum.toLocaleString()} chips)
            </p>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-xs">
              {blindPreview.map((level) => (
                <div
                  key={level.level}
                  className="rounded-md bg-slate-900 border border-slate-800 px-2 py-1.5 text-center"
                >
                  <p className="text-slate-500">L{level.level}</p>
                  <p className="font-medium">
                    {level.sb}/{level.bb}
                  </p>
                  <p className="text-slate-600">
                    {Math.round(startingChipsNum / level.bb)} BB
                  </p>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-slate-600 mt-2">
              Level 1 big blind is ~1% of starting stack. Blinds increase when
              the timer expires; the next hand deals at the new level.
            </p>
          </div>
          <div className="mb-4">
            <label className="block text-sm text-slate-400 mb-2">
              Paid places
            </label>
            <div className="flex gap-2 mb-3">
              {([1, 2, 3] as PaidPlaceCount[]).map((count) => (
                <button
                  key={count}
                  type="button"
                  onClick={() =>
                    setForm((f) => ({ ...f, ...payoutFormForPaidPlaces(count) }))
                  }
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition ${
                    form.paidPlaces === count
                      ? "bg-emerald-600 border-emerald-500 text-white"
                      : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
                  }`}
                >
                  {count === 1 ? "1 place" : `${count} places`}
                </button>
              ))}
            </div>
            <label className="block text-sm text-slate-400 mb-2">
              Payout split (% — must total 100)
            </label>
            <div
              className={`grid gap-3 ${
                form.paidPlaces === 1
                  ? "grid-cols-1 max-w-[8rem]"
                  : form.paidPlaces === 2
                    ? "grid-cols-2"
                    : "grid-cols-3"
              }`}
            >
              {payoutFields.map(({ key, label }) => (
                <div key={key}>
                  <label className="block text-xs text-slate-500 mb-1">
                    {label}
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={form[key]}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, [key]: e.target.value }))
                    }
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              ))}
            </div>
            <p
              className={`text-xs mt-2 ${
                payoutError ? "text-red-400" : "text-slate-500"
              }`}
            >
              {payoutError ?? `Total: ${payoutTotal}%`}
            </p>
          </div>
          <div className="mb-4 rounded-lg border border-slate-800 bg-slate-950/40 p-3">
            <InviteComposeBox
              compact
              invites={createInvites}
              onChange={(next) => {
                setInviteError("");
                setCreateInvites(next);
              }}
              suggestions={pastPlayers}
              loaded={nightsReady}
              draftEmail={inviteDraftEmail}
              draftName={inviteDraftName}
              onDraftEmailChange={(value) => {
                setInviteDraftEmail(value);
                setInviteError("");
              }}
              onDraftNameChange={setInviteDraftName}
              error={inviteError}
            />
          </div>
          <div className="mb-4 rounded-lg border border-slate-800 bg-slate-950/40 p-3 space-y-3">
            <div>
              <h4 className="text-sm font-semibold text-slate-100">Zoom</h4>
              <p className="text-xs text-slate-400 mt-0.5">
                Optional — paste your recurring join link so the lobby, invite
                email, and Action Log already have Join / Copy. Different hosts
                use different links; you can still edit in the lobby.
              </p>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">
                Zoom join URL
              </label>
              <input
                type="url"
                value={form.zoomJoinUrl}
                onChange={(e) => {
                  const nextJoinUrl = e.target.value;
                  setForm((f) => ({
                    ...f,
                    zoomJoinUrl: nextJoinUrl,
                    zoomPasscodePlain: nextPasscodeAfterJoinUrlChange({
                      previousJoinUrl: f.zoomJoinUrl,
                      nextJoinUrl,
                      passcode: f.zoomPasscodePlain,
                    }),
                  }));
                }}
                placeholder="https://us04web.zoom.us/j/…?pwd=…"
                className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 focus:border-emerald-500 focus:outline-none text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">
                Passcode{" "}
                <span className="text-slate-500 font-normal">
                  (filled from URL pwd when present)
                </span>
              </label>
              <input
                type="text"
                value={form.zoomPasscodePlain}
                onChange={(e) =>
                  setForm((f) => ({ ...f, zoomPasscodePlain: e.target.value }))
                }
                placeholder="Meeting passcode from Zoom"
                autoComplete="off"
                className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 focus:border-emerald-500 focus:outline-none text-sm"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Show table faces needs the passcode people type when joining
                Zoom — replace the URL pwd blob here if they differ.
              </p>
            </div>
          </div>
          <button
            onClick={createTournament}
            disabled={creating || !!payoutError}
            className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg font-medium disabled:opacity-50"
          >
            {creating ? "Creating..." : "Create & Open Lobby"}
          </button>
        </div>
      )}

      <div className="space-y-3">
        {!nightsReady && tournaments.length === 0 && (
          <p className="text-slate-400 text-center py-8">
            Loading game nights…
          </p>
        )}
        {nightsReady && tournaments.length === 0 && (
          <p className="text-slate-400 text-center py-8">
            No game nights yet. Create one or join with a code from a friend.
          </p>
        )}
        {tournaments.map((t) => {
          const isHost = t.hostUserId === session?.user?.id;
          return (
            <div
              key={t.id}
              className="flex items-stretch gap-2 bg-slate-900 rounded-xl border border-slate-800 hover:border-emerald-600/50 transition overflow-hidden"
            >
              <Link
                href={`/tournament/${t.id}`}
                className="flex-1 p-4 min-w-0"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="font-semibold">{t.name}</h3>
                    <p className="text-slate-400 text-sm">
                      Host: {t.host.displayName} · {formatCents(t.buyInCents)}{" "}
                      buy-in · {t.startingChips.toLocaleString()} chips
                    </p>
                  </div>
                  <div className="text-right">
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
                        t.status === "LOBBY"
                          ? "bg-amber-500/20 text-amber-400"
                          : t.status === "RUNNING"
                            ? "bg-emerald-500/20 text-emerald-400"
                            : "bg-slate-700 text-slate-400"
                      }`}
                    >
                      {t.status === "LOBBY"
                        ? "Lobby"
                        : t.status === "RUNNING"
                          ? "Active"
                          : "Closed"}
                    </span>
                    <p className="text-slate-400 text-sm mt-1">
                      {t._count.players}/{t.maxPlayers} players
                      {(t.games?.length ?? 0) > 0 &&
                        ` · ${t.games!.length} tournament${t.games!.length === 1 ? "" : "s"}`}
                    </p>
                  </div>
                </div>
              </Link>
              {isHost && (
                <div className="flex flex-col border-l border-slate-800 shrink-0">
                  <Link
                    href={`/tournament/${t.id}?settings=1`}
                    className="px-4 py-3 text-sm text-emerald-400 hover:bg-slate-800/70 text-center"
                    title="Open game night settings"
                  >
                    Settings
                  </Link>
                  <button
                    type="button"
                    onClick={() => deleteTournament(t.id, t.name)}
                    disabled={deletingId === t.id}
                    className="px-4 py-3 text-sm text-red-400 hover:bg-red-950/40 border-t border-slate-800 disabled:opacity-50"
                    title="Delete game night"
                  >
                    {deletingId === t.id ? "…" : "Delete"}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
