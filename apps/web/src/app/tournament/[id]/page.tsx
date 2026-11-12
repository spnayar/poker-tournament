"use client";

import { useSession } from "next-auth/react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { formatCents, getAvatarUrl, LEDGER_DISCLAIMER } from "@/lib/utils";
import { BrandLockup } from "@/components/BrandMark";
import {
  ACTION_TIMER_SECONDS_OPTIONS,
  BLIND_PACE_LABELS,
  computePayoutsFromPercents,
  defaultPayoutPercents,
  formatActionTimerLabel,
  resolveBlindLevels,
  type BlindPace,
  type NightLedgerEntry,
} from "@poker/protocol";
import { useTournamentGameWatch } from "@/hooks/useTournamentGameWatch";
import { formatSessionLabelShort } from "@/lib/labels";
import { InvitePlayersPanel } from "@/components/InvitePlayersPanel";
import { ZoomNightPanel } from "@/components/ZoomNightPanel";
import { nightSettingsEditability } from "@/lib/tournament";

interface Player {
  userId: string;
  user: { displayName: string; avatarUrl: string | null };
}

interface GameResult {
  userId: string;
  finishPosition: number;
  payoutCents: number;
  user: { displayName: string };
}

interface Game {
  id: string;
  gameNumber: number;
  status: string;
  prizePoolCents: number;
  chopped?: boolean;
  finishedAt: string | null;
  results: GameResult[];
}

interface Tournament {
  id: string;
  name: string;
  status: string;
  buyInCents: number;
  startingChips: number;
  maxPlayers: number;
  blindPreset: string;
  blindPace?: string;
  blindLevelMinutes?: number;
  actionTimerSeconds?: number;
  blindLevels?: { level: number; sb: number; bb: number }[];
  hostUserId: string;
  inviteCode: string;
  players: Player[];
  games: Game[];
}

export default function TournamentLobbyPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params.id as string;
  const settingsMode = searchParams.get("settings") === "1";
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [runningGame, setRunningGame] = useState<{ gameNumber: number } | null>(
    null
  );
  const [payouts, setPayouts] = useState<number[]>([]);
  const [payoutPercents, setPayoutPercents] = useState<number[]>(() =>
    defaultPayoutPercents()
  );
  const [ledger, setLedger] = useState<NightLedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);

  const waitingForNextGame =
    status === "authenticated" &&
    tournament !== null &&
    tournament.status !== "FINISHED" &&
    tournament.games.some((g) => g.status === "FINISHED") &&
    runningGame === null;

  useTournamentGameWatch(id, session?.user?.gameToken, waitingForNextGame);

  const load = useCallback(async () => {
    const res = await fetch(`/api/tournaments/${id}`);
    const data = await res.json();
    if (res.status === 403) {
      router.push("/dashboard");
      return;
    }
    if (res.ok) {
      setTournament(data.tournament);
      setNameDraft((prev) =>
        prev === "" || prev === data.tournament.name
          ? data.tournament.name
          : prev
      );
      setRunningGame(data.runningGame);
      setPayoutPercents(data.payoutPercents ?? defaultPayoutPercents());
      setLedger(data.ledger ?? []);
      setPayouts(
        data.payouts ??
          computePayoutsFromPercents(
            data.tournament.buyInCents * data.tournament.players.length,
            data.payoutPercents ?? defaultPayoutPercents(),
            data.tournament.players.length
          )
      );

      // Settings mode stays on this page so hosts can edit mid-night / closed.
      if (!settingsMode) {
        if (data.runningGame) {
          router.push(`/tournament/${id}/table`);
          return;
        }
        if (data.tournament.status === "FINISHED") {
          router.push(`/tournament/${id}/results`);
          return;
        }
      }
    }
    setLoading(false);
  }, [id, router, settingsMode]);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    setNameDraft("");
  }, [id]);

  useEffect(() => {
    if (status === "authenticated") {
      load();
      const interval = setInterval(load, 3000);
      return () => clearInterval(interval);
    }
  }, [status, load]);

  async function copyJoinCode() {
    if (!tournament) return;
    await navigator.clipboard.writeText(tournament.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function openOrStart(action: "open" | "start") {
    setActionLoading(true);
    const res = await fetch(`/api/tournaments/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (res.ok) router.push(`/tournament/${id}/table`);
    else {
      const data = await res.json();
      alert(
        data.error ||
          (action === "open"
            ? "Could not open table"
            : "Could not start tournament")
      );
    }
    setActionLoading(false);
  }

  async function closeNight() {
    if (
      !confirm(
        "End this poker night? No more games can be played. Settlement will be final."
      )
    ) {
      return;
    }
    setActionLoading(true);
    const res = await fetch(`/api/tournaments/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "close" }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      const preview =
        typeof data?.recap?.previewHtml === "string"
          ? data.recap.previewHtml
          : null;
      if (preview) {
        const { storeRecapPreviewHtml } = await import("@/lib/recapPreview");
        storeRecapPreviewHtml(id, preview);
      }
      router.push(`/tournament/${id}/results`);
    } else {
      alert(data.error || "Could not close");
    }
    setActionLoading(false);
  }

  async function deleteTournament() {
    if (
      !confirm(
        `Delete this game night "${tournament?.name}"? This cannot be undone and will remove it for all players.`
      )
    ) {
      return;
    }
    setActionLoading(true);
    const res = await fetch(`/api/tournaments/${id}`, { method: "DELETE" });
    setActionLoading(false);
    if (res.ok) router.push("/dashboard");
    else {
      const data = await res.json();
      alert(data.error || "Could not delete game night");
    }
  }

  async function saveSettings(patch: {
    name?: string;
    actionTimerSeconds?: number;
  }) {
    setSavingSettings(true);
    const res = await fetch(`/api/tournaments/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "updateSettings", ...patch }),
    });
    const data = await res.json().catch(() => ({}));
    setSavingSettings(false);
    if (!res.ok) {
      alert(
        typeof data.error === "string" ? data.error : "Could not update settings"
      );
      return false;
    }
    setTournament((t) =>
      t
        ? {
            ...t,
            ...(typeof data.name === "string" ? { name: data.name } : {}),
            ...(typeof data.actionTimerSeconds === "number"
              ? { actionTimerSeconds: data.actionTimerSeconds }
              : {}),
          }
        : t
    );
    if (typeof data.name === "string") setNameDraft(data.name);
    return true;
  }

  if (loading || !tournament) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-slate-400">Loading lobby...</p>
      </div>
    );
  }

  const isHost = session?.user?.id === tournament.hostUserId;
  const editability = nightSettingsEditability(tournament.status);
  const prizePool = tournament.buyInCents * tournament.players.length;
  const finishedGames = tournament.games.filter((g) => g.status === "FINISHED");
  const gamesPlayed = finishedGames.length;
  const canJoin = tournament.status !== "FINISHED" && !runningGame;
  const blindPace = (tournament.blindPace ?? tournament.blindPreset) as BlindPace;
  const blindLevels = resolveBlindLevels(tournament.startingChips, {
    blindLevels: tournament.blindLevels,
    blindPace: tournament.blindPace,
    blindPreset: tournament.blindPreset,
  });
  const blindPreview = blindLevels.slice(0, 5);
  const startedOrClosed = tournament.status !== "LOBBY";
  const showZoom =
    editability.canEditZoom ||
    (settingsMode && tournament.status !== "FINISHED");

  return (
    <div className="min-h-screen p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between gap-3">
        <BrandLockup />
        <div className="flex flex-wrap items-center justify-end gap-3 shrink-0">
          {settingsMode && runningGame && (
            <Link
              href={`/tournament/${id}/table`}
              className="text-amber-400 text-sm hover:underline"
            >
              Back to table
            </Link>
          )}
          {settingsMode && tournament.status === "FINISHED" && (
            <Link
              href={`/tournament/${id}/results`}
              className="text-amber-400 text-sm hover:underline"
            >
              View results
            </Link>
          )}
          <Link href="/dashboard" className="text-emerald-400 text-sm hover:underline">
            ← Back to dashboard
          </Link>
        </div>
      </div>

      <h1 className="text-3xl font-bold mt-4 mb-2">{tournament.name}</h1>
      {settingsMode && (
        <p className="text-emerald-400/90 text-sm mb-2">
          Settings
          {tournament.status === "RUNNING"
            ? " · mid-night edits"
            : tournament.status === "FINISHED"
              ? " · closed night"
              : ""}
        </p>
      )}
      <p className="text-amber-400/80 text-xs mb-6">{LEDGER_DISCLAIMER}</p>

      {canJoin && (
        <div className="bg-emerald-950/40 rounded-xl p-5 border border-emerald-700/40 mb-6">
          <p className="text-sm text-slate-400 mb-2">
            Share this join code with friends
          </p>
          <div className="flex items-center gap-3">
            <span className="text-3xl font-mono font-bold tracking-[0.3em] text-emerald-400">
              {tournament.inviteCode}
            </span>
            <button
              onClick={copyJoinCode}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          {startedOrClosed && (
            <p className="text-[11px] text-slate-500 mt-2">
              Join code is fixed for this night.
            </p>
          )}
        </div>
      )}

      {settingsMode && !canJoin && (
        <div className="bg-slate-900/80 rounded-xl p-4 border border-slate-800 mb-6">
          <p className="text-sm text-slate-400 mb-1">Join code</p>
          <div className="flex items-center gap-3">
            <span className="text-xl font-mono font-bold tracking-[0.25em] text-slate-300">
              {tournament.inviteCode}
            </span>
            <button
              onClick={copyJoinCode}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">
            Locked — join code cannot change after create.
          </p>
        </div>
      )}

      {isHost && tournament.status !== "FINISHED" && (
        <InvitePlayersPanel tournamentId={tournament.id} />
      )}

      {showZoom && (
        <div className="mb-6">
          <ZoomNightPanel
            tournamentId={tournament.id}
            isHost={isHost && editability.canEditZoom}
          />
        </div>
      )}

      <div className="bg-slate-900 rounded-xl p-6 border border-slate-800 mb-6">
        <div className="flex items-baseline justify-between gap-2 mb-4">
          <h2 className="text-sm font-semibold text-slate-200">Night settings</h2>
          {startedOrClosed && (
            <span className="text-[11px] text-slate-500">
              Buy-in, chips, and structure stay locked after start
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          {isHost && editability.canEditName ? (
            <div className="col-span-2">
              <label className="text-slate-400 block mb-1">Display name</label>
              <div className="flex flex-wrap gap-2">
                <input
                  type="text"
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  maxLength={80}
                  disabled={savingSettings}
                  className="flex-1 min-w-[12rem] px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-sm font-semibold focus:border-emerald-500 focus:outline-none disabled:opacity-50"
                />
                <button
                  type="button"
                  disabled={
                    savingSettings ||
                    nameDraft.trim() === "" ||
                    nameDraft.trim() === tournament.name
                  }
                  onClick={() => void saveSettings({ name: nameDraft })}
                  className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-sm font-medium disabled:opacity-40"
                >
                  Save name
                </button>
              </div>
            </div>
          ) : (
            <div className="col-span-2">
              <p className="text-slate-400">Display name</p>
              <p className="font-semibold">{tournament.name}</p>
            </div>
          )}
          <div>
            <p className="text-slate-400">Buy-in (ledger)</p>
            <p className="font-semibold text-slate-300">
              {formatCents(tournament.buyInCents)}
            </p>
            {startedOrClosed && (
              <p className="text-[11px] text-slate-500 mt-0.5">Locked</p>
            )}
          </div>
          <div>
            <p className="text-slate-400">Starting chips</p>
            <p className="font-semibold text-slate-300">
              {tournament.startingChips.toLocaleString()}
            </p>
            {startedOrClosed && (
              <p className="text-[11px] text-slate-500 mt-0.5">Locked</p>
            )}
          </div>
          <div>
            <p className="text-slate-400">Prize pool per game</p>
            <p className="font-semibold">{formatCents(prizePool)}</p>
          </div>
          <div>
            <p className="text-slate-400">Games played</p>
            <p className="font-semibold">{gamesPlayed}</p>
          </div>
          <div>
            <p className="text-slate-400">Blind pace</p>
            <p className="font-semibold text-slate-300">
              {BLIND_PACE_LABELS[blindPace]?.label ?? blindPace}
            </p>
            {startedOrClosed && (
              <p className="text-[11px] text-slate-500 mt-0.5">
                Locked — change next level at the table
              </p>
            )}
          </div>
          <div>
            <p className="text-slate-400">Level length</p>
            <p className="font-semibold text-slate-300">
              {tournament.blindLevelMinutes ?? 12} min
            </p>
            {startedOrClosed && (
              <p className="text-[11px] text-slate-500 mt-0.5">Locked</p>
            )}
          </div>
          <div className="col-span-2 sm:col-span-1">
            <p className="text-slate-400">Action timer</p>
            {isHost && editability.canEditActionTimer ? (
              <select
                value={tournament.actionTimerSeconds ?? 60}
                disabled={savingSettings}
                onChange={(e) => {
                  const next = parseInt(e.target.value, 10);
                  void saveSettings({ actionTimerSeconds: next });
                }}
                className="mt-1 w-full max-w-[12rem] px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-sm font-semibold focus:border-emerald-500 focus:outline-none disabled:opacity-50"
              >
                {ACTION_TIMER_SECONDS_OPTIONS.map((secs) => (
                  <option key={secs} value={secs}>
                    {secs === 0
                      ? "Off"
                      : `${formatActionTimerLabel(secs)} per action`}
                  </option>
                ))}
              </select>
            ) : (
              <p className="font-semibold">
                {(tournament.actionTimerSeconds ?? 60) === 0
                  ? "Off"
                  : `${formatActionTimerLabel(tournament.actionTimerSeconds ?? 60)} per action`}
              </p>
            )}
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-slate-800">
          <p className="text-slate-400 text-xs mb-2">Blind structure</p>
          <div className="flex flex-wrap gap-2">
            {blindPreview.map((level) => (
              <span
                key={level.level}
                className="text-xs bg-slate-800 px-2 py-1 rounded-md"
              >
                L{level.level}: {level.sb}/{level.bb}
              </span>
            ))}
            {blindLevels.length > blindPreview.length && (
              <span className="text-xs text-slate-500">+ more</span>
            )}
          </div>
        </div>
      </div>

      <h2 className="text-lg font-semibold mb-3">
        Players ({tournament.players.length}/{tournament.maxPlayers})
      </h2>
      <div className="space-y-2 mb-6">
        {tournament.players.map((p) => (
          <div
            key={p.userId}
            className="flex items-center gap-3 bg-slate-900 rounded-lg p-3 border border-slate-800"
          >
            <img
              src={getAvatarUrl(p.user.displayName, p.user.avatarUrl)}
              alt=""
              className="w-10 h-10 rounded-full"
            />
            <span className="font-medium">{p.user.displayName}</span>
            {p.userId === tournament.hostUserId && (
              <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full">
                Host
              </span>
            )}
          </div>
        ))}
      </div>

      {payouts.length > 0 && (
        <div className="bg-slate-900 rounded-xl p-4 border border-slate-800 mb-6">
          <h3 className="text-sm font-semibold text-slate-400 mb-2">
            Payout per tournament (ledger)
          </h3>
          <div className="flex gap-4 flex-wrap">
            {payouts.map((amount, i) => (
              <div key={i} className="text-sm">
                <span className="text-slate-400">
                  {i + 1}
                  {i === 0 ? "st" : i === 1 ? "nd" : i === 2 ? "rd" : "th"} (
                  {payoutPercents[i]}%):
                </span>{" "}
                <span className="font-semibold">{formatCents(amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {finishedGames.length > 0 && (
        <div className="bg-slate-900 rounded-xl p-4 border border-slate-800 mb-6">
          <h3 className="text-sm font-semibold text-slate-400 mb-3">
            Completed tournaments
          </h3>
          <div className="space-y-4">
            {finishedGames.map((game) => {
              const itm = game.results.filter((r) => r.payoutCents > 0);
              return (
                <div
                  key={game.id}
                  className="border border-slate-800 rounded-lg p-3"
                >
                  <p className="font-medium text-sm mb-2">
                    {formatSessionLabelShort(game.gameNumber)}
                    {game.chopped ? " · chopped" : ""} ·{" "}
                    {formatCents(game.prizePoolCents)} pool
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {itm.map((r) => (
                      <span
                        key={r.userId}
                        className="text-xs bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded-full"
                      >
                        #{r.finishPosition} {r.user.displayName}{" "}
                        {formatCents(r.payoutCents)}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {ledger.length > 0 && (
        <div className="bg-slate-900 rounded-xl p-4 border border-slate-800 mb-6">
          <h3 className="text-sm font-semibold text-slate-400 mb-3">
            Night ledger (who&apos;s up / down)
          </h3>
          <div className="space-y-2">
            {ledger.map((row) => (
              <div
                key={row.userId}
                className="flex justify-between text-sm py-1 border-b border-slate-800 last:border-0"
              >
                <span>
                  {row.displayName}{" "}
                  <span className="text-slate-500">
                    ({row.gamesPlayed} game{row.gamesPlayed === 1 ? "" : "s"})
                  </span>
                </span>
                <span
                  className={
                    row.netCents >= 0 ? "text-emerald-400" : "text-red-400"
                  }
                >
                  {row.netCents >= 0 ? "+" : ""}
                  {formatCents(row.netCents)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        {isHost && !runningGame && tournament.players.length >= 1 && (
          <button
            onClick={() =>
              openOrStart(tournament.players.length >= 2 ? "start" : "open")
            }
            disabled={actionLoading}
            className="flex-1 py-3 bg-amber-600 hover:bg-amber-500 rounded-lg font-semibold disabled:opacity-50 min-w-[140px]"
          >
            {tournament.players.length < 2
              ? "Sit at table"
              : gamesPlayed === 0
                ? "Start Tournament 1"
                : `Start Tournament ${gamesPlayed + 1}`}
          </button>
        )}
        {isHost && gamesPlayed > 0 && !runningGame && (
          <button
            onClick={closeNight}
            disabled={actionLoading}
            className="px-6 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg font-medium disabled:opacity-50"
          >
            End Game Night
          </button>
        )}
        {isHost && (
          <button
            onClick={deleteTournament}
            disabled={actionLoading || !!runningGame}
            className="px-6 py-3 bg-slate-800 hover:bg-red-950/60 text-red-400 border border-slate-700 rounded-lg font-medium disabled:opacity-50"
          >
            Delete
          </button>
        )}
      </div>

      {tournament.players.length < 2 && isHost && gamesPlayed === 0 && (
        <p className="text-slate-400 text-sm text-center mt-4">
          You can sit at the table alone and wait. Invite friends or share the
          join code — Start randomizes seats once two or more are in.
        </p>
      )}

      {gamesPlayed > 0 && !isHost && !runningGame && (
        <p className="text-slate-400 text-sm text-center mt-4">
          Waiting for the host to start the next tournament… you&apos;ll join the
          table automatically.
        </p>
      )}
    </div>
  );
}
