"use client";

import { useSession } from "next-auth/react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { useEffect, useState, useCallback, Suspense } from "react";
import Link from "next/link";
import { formatCents, getAvatarUrl, LEDGER_DISCLAIMER } from "@/lib/utils";
import type { NightLedgerEntry } from "@poker/protocol";
import { normalizeGamePayouts } from "@poker/protocol";
import { useTournamentGameWatch } from "@/hooks/useTournamentGameWatch";
import { formatSessionLabel, formatSessionLabelShort } from "@/lib/labels";

interface GameResult {
  userId: string;
  finishPosition: number;
  payoutCents: number;
  user: { displayName: string; avatarUrl: string | null };
}

interface TournamentPlayer {
  userId: string;
  user: { displayName: string; avatarUrl: string | null };
}

interface Game {
  id: string;
  gameNumber: number;
  status: string;
  prizePoolCents: number;
  results: GameResult[];
}

interface Tournament {
  id: string;
  name: string;
  status: string;
  buyInCents: number;
  hostUserId: string;
  players: TournamentPlayer[];
  games: Game[];
}

interface GameStanding {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  finishPosition: number;
  payoutCents: number;
  netCents: number;
}

function buildGameStandings(
  game: Game,
  players: TournamentPlayer[],
  buyInCents: number
): GameStanding[] {
  const rosterUserIds = players.map((p) => p.userId);
  const normalized = normalizeGamePayouts(
    game.prizePoolCents,
    game.results.map((r) => ({
      userId: r.userId,
      finishPosition: r.finishPosition,
      payoutCents: r.payoutCents,
    })),
    rosterUserIds
  );
  const payoutByUser = new Map(normalized.map((r) => [r.userId, r.payoutCents]));
  const positionByUser = new Map(
    game.results.map((r) => [r.userId, r.finishPosition])
  );

  return players
    .map((p) => {
      const payoutCents = payoutByUser.get(p.userId) ?? 0;
      const finishPosition =
        positionByUser.get(p.userId) ?? players.length;
      return {
        userId: p.userId,
        displayName: p.user.displayName,
        avatarUrl: p.user.avatarUrl,
        finishPosition,
        payoutCents,
        netCents: payoutCents - buyInCents,
      };
    })
    .sort((a, b) => a.finishPosition - b.finishPosition);
}

function ResultsContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params.id as string;
  const justFinishedGame = searchParams.get("game");

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [ledger, setLedger] = useState<NightLedgerEntry[]>([]);
  const [actionLoading, setActionLoading] = useState(false);

  const waitingForNextGame =
    status === "authenticated" &&
    tournament !== null &&
    tournament.status !== "FINISHED" &&
    !tournament.games.some((g) => g.status === "RUNNING");

  useTournamentGameWatch(id, session?.user?.gameToken, waitingForNextGame);

  const load = useCallback(async () => {
    const res = await fetch(`/api/tournaments/${id}`);
    const data = await res.json();
    if (res.ok) {
      setTournament(data.tournament);
      setLedger(data.ledger ?? []);
      if (
        data.tournament.status !== "FINISHED" &&
        !justFinishedGame &&
        !data.runningGame
      ) {
        router.replace(`/tournament/${id}`);
      }
    }
  }, [id, justFinishedGame, router]);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (status === "authenticated") load();
  }, [status, load]);

  async function startAnother() {
    setActionLoading(true);
    const res = await fetch(`/api/tournaments/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "start" }),
    });
    if (res.ok) router.push(`/tournament/${id}/table`);
    setActionLoading(false);
  }

  async function closeNight() {
    setActionLoading(true);
    const res = await fetch(`/api/tournaments/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "close" }),
    });
    if (res.ok) {
      await load();
      router.replace(`/tournament/${id}/results`);
    }
    setActionLoading(false);
  }

  if (!tournament) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-slate-400">Loading results...</p>
      </div>
    );
  }

  const isHost = session?.user?.id === tournament.hostUserId;
  const finishedGames = tournament.games.filter((g) => g.status === "FINISHED");
  const latestGame = justFinishedGame
    ? finishedGames.find((g) => g.gameNumber === parseInt(justFinishedGame, 10))
    : finishedGames[0];
  const isClosed = tournament.status === "FINISHED";
  const gameStandings =
    latestGame && tournament.players.length > 0
      ? buildGameStandings(
          latestGame,
          tournament.players,
          tournament.buyInCents
        )
      : [];

  return (
    <div className="min-h-screen p-6 max-w-lg mx-auto">
      <h1 className="text-3xl font-bold text-center mb-2">
        {isClosed
          ? "Game Night Complete"
          : latestGame
            ? `${formatSessionLabel(latestGame.gameNumber)} Complete`
            : "Tournament Complete"}
      </h1>
      <p className="text-center text-slate-400 mb-1">{tournament.name}</p>
      <p className="text-center text-amber-400/80 text-xs mb-8">
        {LEDGER_DISCLAIMER}
      </p>

      {latestGame && gameStandings.length > 0 && (
        <div className="bg-slate-900 rounded-xl p-4 border border-slate-800 mb-6">
          <h2 className="text-sm font-semibold text-slate-400 mb-3">
            {formatSessionLabelShort(latestGame.gameNumber)} — all players
          </h2>
          <p className="text-xs text-slate-500 mb-3">
            {formatCents(tournament.buyInCents)} buy-in · net win/loss per player
          </p>
          <div className="space-y-2">
            {gameStandings.map((r) => (
              <div
                key={r.userId}
                className={`flex items-center gap-3 p-3 rounded-lg border ${
                  r.finishPosition === 1
                    ? "bg-amber-500/10 border-amber-500/30"
                    : "bg-slate-900 border-slate-800"
                }`}
              >
                <span className="text-lg font-bold text-slate-500 w-8">
                  #{r.finishPosition}
                </span>
                <img
                  src={getAvatarUrl(r.displayName, r.avatarUrl)}
                  alt=""
                  className="w-10 h-10 rounded-full"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{r.displayName}</p>
                  <p className="text-xs text-slate-500">
                    Won {formatCents(r.payoutCents)}
                  </p>
                </div>
                <p
                  className={`font-mono font-semibold shrink-0 ${
                    r.netCents >= 0 ? "text-emerald-400" : "text-red-400"
                  }`}
                >
                  {r.netCents >= 0 ? "+" : ""}
                  {formatCents(r.netCents)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {ledger.length > 0 && (
        <div className="bg-slate-900 rounded-xl p-4 border border-slate-800 mb-6">
          <h2 className="text-sm font-semibold text-slate-400 mb-3">
            Night settlement
          </h2>
          <p className="text-xs text-slate-500 mb-3">
            Net ledger across all {finishedGames.length} game
            {finishedGames.length === 1 ? "" : "s"} (
            {formatCents(tournament.buyInCents)} buy-in each)
          </p>
          <div className="space-y-2">
            {ledger.map((row) => (
              <div
                key={row.userId}
                className="flex justify-between items-center py-2 border-b border-slate-800 last:border-0"
              >
                <div>
                  <p className="font-medium">{row.displayName}</p>
                  <p className="text-xs text-slate-500">
                    Paid {formatCents(row.totalBuyInCents)} · Won{" "}
                    {formatCents(row.totalPayoutCents)}
                  </p>
                </div>
                <p
                  className={`font-mono font-semibold ${
                    row.netCents >= 0 ? "text-emerald-400" : "text-red-400"
                  }`}
                >
                  {row.netCents >= 0 ? "+" : ""}
                  {formatCents(row.netCents)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {finishedGames.length > 1 && (
        <div className="bg-slate-900 rounded-xl p-4 border border-slate-800 mb-6">
          <h2 className="text-sm font-semibold text-slate-400 mb-3">
            All tournaments tonight
          </h2>
          <div className="space-y-2 text-sm">
            {finishedGames.map((game) => {
              const winner = game.results.find((r) => r.finishPosition === 1);
              return (
                <div
                  key={game.id}
                  className="flex justify-between py-1 border-b border-slate-800 last:border-0"
                >
                  <span>{formatSessionLabelShort(game.gameNumber)}</span>
                  <span className="text-slate-400">
                    {winner?.user.displayName} won{" "}
                    {formatCents(winner?.payoutCents ?? 0)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!isClosed && isHost && (
        <div className="flex flex-col gap-3 mb-4">
          <button
            onClick={startAnother}
            disabled={actionLoading}
            className="w-full py-3 bg-amber-600 hover:bg-amber-500 rounded-lg font-semibold disabled:opacity-50"
          >
            Play Another Tournament
          </button>
          <button
            onClick={closeNight}
            disabled={actionLoading}
            className="w-full py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg font-medium disabled:opacity-50"
          >
            End Game Night
          </button>
        </div>
      )}

      {!isClosed && !isHost && (
        <p className="text-center text-slate-400 text-sm mb-4">
          Waiting for the host to start another tournament or end the game night… you&apos;ll
          join the table automatically.
        </p>
      )}

      <Link
        href={isClosed ? "/dashboard" : `/tournament/${id}`}
        className="block text-center py-3 bg-emerald-600 hover:bg-emerald-500 rounded-lg font-semibold"
      >
        {isClosed ? "Back to Dashboard" : "Back to Lobby"}
      </Link>
    </div>
  );
}

export default function ResultsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-slate-400">Loading...</p>
        </div>
      }
    >
      <ResultsContent />
    </Suspense>
  );
}
