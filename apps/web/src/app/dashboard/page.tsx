"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { formatCents, getAvatarUrl, LEDGER_DISCLAIMER } from "@/lib/utils";
import {
  createGameNightFormDefaults,
  payoutPercentsSum,
  validatePayoutPercents,
  type LastHostedDefaults,
} from "@/lib/tournament";
import {
  BLIND_LEVEL_MINUTE_OPTIONS,
  BLIND_PACE_LABELS,
  buildBlindLevels,
  type BlindPace,
} from "@poker/protocol";

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

interface Stats {
  tournamentsPlayed: number;
  wins: number;
  itmCount: number;
  totalBuyInCents: number;
  totalPayoutCents: number;
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
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

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (status === "authenticated") {
      fetch("/api/tournaments")
        .then(async (r) => {
          const data = await r.json().catch(() => ({}));
          if (!r.ok) {
            console.error("Failed to load tournaments:", data.error ?? r.status);
            return;
          }
          setTournaments(data.tournaments ?? []);
          setStats(data.stats);
          const defaults = data.lastHostedDefaults ?? null;
          setLastHostedDefaults(defaults);
          setForm(createGameNightFormDefaults(defaults));
        });
    }
  }, [status]);

  async function createTournament() {
    const payoutValues = [form.payout1, form.payout2, form.payout3];
    const payoutError = validatePayoutPercents(payoutValues);
    if (payoutError) {
      alert(payoutError);
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
        payoutPercents: [
          parseInt(form.payout1, 10),
          parseInt(form.payout2, 10),
          parseInt(form.payout3, 10),
        ],
      }),
    });
    const tournament = await res.json().catch(() => ({}));
    setCreating(false);
    if (res.ok && tournament.id) router.push(`/tournament/${tournament.id}`);
    else alert(tournament.error || "Could not create game night");
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
    router.push(`/tournament/${data.tournamentId}`);
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

  const payoutValues = [form.payout1, form.payout2, form.payout3];
  const payoutTotal = payoutPercentsSum(payoutValues);
  const payoutError = validatePayoutPercents(payoutValues);
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

  const net =
    (stats?.totalPayoutCents ?? 0) - (stats?.totalBuyInCents ?? 0);
  const itmPct =
    stats && stats.tournamentsPlayed > 0
      ? Math.round((stats.itmCount / stats.tournamentsPlayed) * 100)
      : 0;

  return (
    <div className="min-h-screen p-6 max-w-4xl mx-auto">
      <header className="flex items-center justify-between mb-8">
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
        <div className="flex gap-3">
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
      </header>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Played", value: stats.tournamentsPlayed },
            { label: "Wins", value: stats.wins },
            { label: "ITM %", value: `${itmPct}%` },
            { label: "Net", value: formatCents(net) },
          ].map((s) => (
            <div
              key={s.label}
              className="bg-slate-900 rounded-xl p-4 border border-slate-800"
            >
              <p className="text-slate-400 text-sm">{s.label}</p>
              <p className="text-2xl font-bold">{s.value}</p>
            </div>
          ))}
        </div>
      )}

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
                maxLength={4}
                className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 focus:border-emerald-500 focus:outline-none font-mono tracking-widest uppercase"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={joinTournament}
                disabled={joining || joinCode.length !== 4}
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
              Payout split (% — must total 100)
            </label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { key: "payout1" as const, label: "1st place" },
                { key: "payout2" as const, label: "2nd place" },
                { key: "payout3" as const, label: "3rd place" },
              ].map(({ key, label }) => (
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
        {tournaments.length === 0 && (
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
                <button
                  type="button"
                  onClick={() => deleteTournament(t.id, t.name)}
                  disabled={deletingId === t.id}
                  className="px-4 text-sm text-red-400 hover:bg-red-950/40 border-l border-slate-800 disabled:opacity-50 shrink-0"
                  title="Delete game night"
                >
                  {deletingId === t.id ? "…" : "Delete"}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
