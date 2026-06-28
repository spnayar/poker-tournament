"use client";

import Link from "next/link";
import { formatCents, getAvatarUrl, LEDGER_DISCLAIMER } from "@/lib/utils";
import type { GameFinished } from "@poker/protocol";

interface GameEndSidebarProps {
  tournamentId: string;
  result: GameFinished;
  isHost: boolean;
  actionLoading: boolean;
  onPlayAnother: () => void;
  onCloseNight: () => void;
}

export function GameEndSidebar({
  tournamentId,
  result,
  isHost,
  actionLoading,
  onPlayAnother,
  onCloseNight,
}: GameEndSidebarProps) {
  const sorted = [...result.finishOrder].sort(
    (a, b) => a.position - b.position
  );

  return (
    <aside className="w-full lg:w-72 shrink-0 flex flex-col gap-4">
      <div className="bg-slate-900 rounded-xl p-4 border border-amber-500/30">
        <h2 className="text-lg font-bold text-amber-400 mb-1">
          Game {result.gameNumber} over
        </h2>
        <p className="text-xs text-slate-500 mb-4">
          Prize pool {formatCents(result.prizePoolCents)} ·{" "}
          {formatCents(result.buyInCents)} buy-in each
        </p>

        <div className="space-y-2 max-h-[50vh] overflow-y-auto">
          {sorted.map((row) => {
            const netCents = row.payoutCents - result.buyInCents;
            return (
              <div
                key={row.userId}
                className={`flex items-center gap-2 p-2 rounded-lg border text-sm ${
                  row.position === 1
                    ? "bg-amber-500/10 border-amber-500/30"
                    : "bg-slate-800/50 border-slate-700"
                }`}
              >
                <span className="text-slate-500 font-bold w-6">
                  #{row.position}
                </span>
                <img
                  src={getAvatarUrl(row.displayName, null)}
                  alt=""
                  className="w-8 h-8 rounded-full"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{row.displayName}</p>
                  <p className="text-xs text-slate-500">
                    Won {formatCents(row.payoutCents)}
                  </p>
                </div>
                <p
                  className={`font-mono text-xs font-semibold shrink-0 ${
                    netCents >= 0 ? "text-emerald-400" : "text-red-400"
                  }`}
                >
                  {netCents >= 0 ? "+" : ""}
                  {formatCents(netCents)}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {isHost ? (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={onPlayAnother}
            disabled={actionLoading}
            className="w-full py-2.5 bg-amber-600 hover:bg-amber-500 rounded-lg font-semibold text-sm disabled:opacity-50"
          >
            Play another game
          </button>
          <button
            type="button"
            onClick={onCloseNight}
            disabled={actionLoading}
            className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg font-medium text-sm disabled:opacity-50"
          >
            End poker night
          </button>
        </div>
      ) : (
        <p className="text-center text-slate-400 text-sm px-2">
          Waiting for the host to start another game… you&apos;ll join the table
          automatically.
        </p>
      )}

      <Link
        href={`/tournament/${tournamentId}`}
        className="block text-center py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-sm font-medium"
      >
        Back to lobby
      </Link>

      <p className="text-[10px] text-amber-400/60 text-center">{LEDGER_DISCLAIMER}</p>
    </aside>
  );
}
