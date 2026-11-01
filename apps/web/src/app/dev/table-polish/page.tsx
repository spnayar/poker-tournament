"use client";

/**
 * Visual QA surface for live-table polish (seat pods + single-row action bar).
 * Not linked from product chrome — open /dev/table-polish locally.
 */

import { useMemo, useState } from "react";
import { PokerTable } from "@/components/table/PokerTable";
import { ActionPanel } from "@/components/table/ActionPanel";
import { ActionLogPanel } from "@/components/table/ActionLogPanel";
import type { LegalActions, SeatPublic, ShownHand } from "@poker/protocol";

const ME = "hero-user";

function mockSeats(count: number): SeatPublic[] {
  const names = [
    "You",
    "Alex",
    "Blake",
    "Casey",
    "Drew",
    "Eden",
    "Finley",
  ];
  return Array.from({ length: count }, (_, i) => {
    const isMe = i === 0;
    return {
      seatId: i,
      userId: isMe ? ME : `u-${i}`,
      displayName: names[i] ?? `P${i}`,
      avatarUrl: null,
      chipCount: 5000 - i * 250,
      betThisRound: i === 2 ? 150 : i === 0 ? 50 : 0,
      totalBet: i === 2 ? 150 : i === 0 ? 50 : 0,
      folded: i === 5,
      allIn: false,
      away: false,
      skipped: false,
      skipReason: null,
      isDealer: i === 0,
      isSmallBlind: i === 1,
      isBigBlind: i === 2,
      lastAction: i === 2 ? "Raise 150" : i === 5 ? "Fold" : i === 1 ? "Call 50" : null,
    } satisfies SeatPublic;
  });
}

const raiseLegal: LegalActions = {
  canFold: true,
  canCheck: false,
  canCall: true,
  callAmount: 100,
  canBet: false,
  minBet: 0,
  canRaise: true,
  minRaise: 100,
  minRaiseTo: 200,
  maxRaise: 5050,
  canAllIn: true,
  allInAmount: 4950,
};

export default function TablePolishPreviewPage() {
  const [seatCount, setSeatCount] = useState(7);
  const seats = useMemo(() => mockSeats(seatCount), [seatCount]);
  const shownCards: ShownHand[] = [];
  const [log] = useState(() => [
    {
      id: 1,
      seatId: 1,
      displayName: "Alex",
      avatarUrl: null,
      action: "SB 25",
      street: "preflop",
      handNumber: 12,
    },
    {
      id: 2,
      seatId: 2,
      displayName: "Blake",
      avatarUrl: null,
      action: "BB 50",
      street: "preflop",
      handNumber: 12,
    },
    {
      id: 3,
      seatId: 0,
      displayName: "You",
      avatarUrl: null,
      action: "Call 50",
      street: "preflop",
      handNumber: 12,
    },
  ]);

  return (
    <div className="table-play-shell p-2 sm:p-3 flex flex-col min-h-0">
      <div className="flex items-center gap-2 mb-1 shrink-0 text-xs text-slate-400">
        <span className="text-slate-200 font-semibold">Table polish preview</span>
        <label className="flex items-center gap-1">
          Seats
          <select
            className="bg-slate-800 border border-slate-600 rounded px-1 py-0.5"
            value={seatCount}
            onChange={(e) => setSeatCount(Number(e.target.value))}
          >
            {[2, 3, 4, 5, 6, 7].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <span className="text-slate-500 truncate">
          Dev-only mock — not a live table
        </span>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row gap-2 sm:gap-3 items-stretch justify-center max-w-7xl mx-auto w-full min-h-0 overflow-visible pb-[3.25rem]">
        <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-visible">
          <div className="flex-1 flex flex-col lg:flex-row gap-2 sm:gap-3 items-stretch min-h-0 overflow-visible">
            <div className="flex-[1.4] flex items-center justify-center min-w-0 min-h-0 overflow-visible max-sm:min-h-[46%] max-sm:flex-[1.35]">
              <div className="relative w-full h-full max-w-3xl max-h-full pb-6 sm:pb-8 overflow-visible">
                <PokerTable
                  seats={seats}
                  board={["Ah", "Kd", "7c"]}
                  pots={[{ amount: 450, eligibleSeatIds: seats.map((s) => s.seatId) }]}
                  totalPot={450}
                  myUserId={ME}
                  myCards={["As", "Qs"]}
                  shownCards={shownCards}
                  viewerSeatId={0}
                  dealerSeat={0}
                  currentActorSeat={0}
                  phase="flop"
                  animateDeal={false}
                  actionDeadlineAt={Date.now() + 18000}
                />
              </div>
            </div>
            <ActionLogPanel
              actionLog={log}
              currentActorSeat={0}
              handNumber={12}
              visibleBoard={["Ah", "Kd", "7c", undefined, undefined]}
              hideAwards={false}
            />
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 inset-x-0 z-40 border-t border-slate-700/50 bg-slate-950/97 shadow-[0_-6px_20px_rgba(0,0,0,0.4)]">
        <div className="max-w-7xl mx-auto px-2 py-1 safe-area-pb">
          <ActionPanel
            legal={raiseLegal}
            onAction={() => undefined}
            totalPot={450}
            actionDeadlineAt={Date.now() + 18000}
          />
        </div>
      </div>
    </div>
  );
}
