"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PlayingCard } from "./PlayingCard";
import {
  getSeatPositionForViewer,
  getViewerSortedSeatIndex,
} from "./tableLayout";
import { getAvatarUrl } from "@/lib/utils";
import type { HandResult, SeatPublic, ShownHand } from "@poker/protocol";

interface HandResultOverlayProps {
  result: HandResult;
  shownCards: ShownHand[];
}

interface AggregatedWinner {
  seatId: number;
  displayName: string;
  avatarUrl: string | null;
  amount: number;
  handName?: string;
  wonByFold?: boolean;
  bestHand?: string[];
}

function aggregateWinners(
  result: HandResult,
  shownCards: ShownHand[]
): AggregatedWinner[] {
  const map = new Map<number, AggregatedWinner>();

  for (const w of result.winners) {
    const bestHand = shownCards.find((s) => s.seatId === w.seatId)?.bestHand;
    const existing = map.get(w.seatId);
    if (existing) {
      existing.amount += w.amount;
      if (w.handName) existing.handName = w.handName;
    } else {
      map.set(w.seatId, {
        seatId: w.seatId,
        displayName: w.displayName,
        avatarUrl: w.avatarUrl,
        amount: w.amount,
        handName: w.handName,
        wonByFold: w.wonByFold,
        bestHand,
      });
    }
  }

  return [...map.values()].sort((a, b) => b.amount - a.amount);
}

function ChipBurst({
  targetX,
  targetY,
  delay,
}: {
  targetX: number;
  targetY: number;
  delay: number;
}) {
  return (
    <motion.div
      className="absolute w-5 h-5 rounded-full bg-gradient-to-br from-amber-300 to-amber-600 border border-amber-200 shadow-lg z-30 pointer-events-none"
      initial={{ left: "50%", top: "50%", x: "-50%", y: "-50%", scale: 0, opacity: 0 }}
      animate={{
        left: `${targetX}%`,
        top: `${targetY}%`,
        x: "-50%",
        y: "-50%",
        scale: [0, 1.2, 1],
        opacity: [0, 1, 1],
      }}
      transition={{ delay, duration: 1.2, ease: "easeOut" }}
    />
  );
}

/** Chip fly animation over the table (does not block the felt). */
export function HandWinnerChipBurst({
  result,
  seats,
  myUserId,
  viewerSeatId = null,
}: {
  result: HandResult;
  seats: SeatPublic[];
  myUserId: string;
  viewerSeatId?: number | null;
}) {
  const [phase, setPhase] = useState<"chips" | "done">("chips");
  const winners = useMemo(() => aggregateWinners(result, []), [result]);
  const primary = winners[0];

  const sortedSeats = [...seats].sort((a, b) => a.seatId - b.seatId);
  const viewerSeatIndex = getViewerSortedSeatIndex(
    sortedSeats,
    myUserId,
    viewerSeatId
  );
  const winnerSortedIndex = sortedSeats.findIndex(
    (s) => s.seatId === primary?.seatId
  );
  const targetPos =
    primary && winnerSortedIndex >= 0
      ? getSeatPositionForViewer(
          winnerSortedIndex,
          sortedSeats.length,
          viewerSeatIndex
        )
      : { x: 50, y: 50 };

  useEffect(() => {
    const t = setTimeout(() => setPhase("done"), 2800);
    return () => clearTimeout(t);
  }, [result]);

  if (!primary || phase === "done") return null;

  return (
    <>
      {[0, 0.15, 0.3, 0.45, 0.6].map((d, i) => (
        <ChipBurst
          key={i}
          targetX={targetPos.x}
          targetY={targetPos.y}
          delay={d}
        />
      ))}
    </>
  );
}

/** Hand result banner shown below the table so the board stays visible. */
export function HandResultOverlay({
  result,
  shownCards,
}: HandResultOverlayProps) {
  const winners = useMemo(
    () => aggregateWinners(result, shownCards),
    [result, shownCards]
  );
  const primary = winners[0];

  if (!primary) return null;

  const subtitle = primary.wonByFold
    ? "Everyone else folded"
    : primary.handName ?? "Winner";

  return (
    <AnimatePresence>
      <motion.div
        className="w-full max-w-3xl mx-auto mt-6 bg-slate-900/95 border border-amber-500/40 rounded-2xl px-6 py-5 shadow-2xl"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 8 }}
        transition={{ duration: 0.45, type: "spring", stiffness: 260, damping: 24 }}
      >
        <p className="text-amber-400 text-xs font-semibold uppercase tracking-wider mb-3 text-center sm:text-left">
          {winners.length > 1 ? "Pot Winners" : "Hand Winner"}
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-4">
          <img
            src={getAvatarUrl(primary.displayName, primary.avatarUrl)}
            alt=""
            className="w-16 h-16 rounded-full border-4 border-amber-400 shadow-lg shrink-0"
          />

          <div className="flex-1 text-center sm:text-left min-w-0">
            <h2 className="text-xl font-bold text-white truncate">
              {primary.displayName}
            </h2>
            <p className="text-emerald-400 text-lg font-semibold">
              +{primary.amount.toLocaleString()} chips
            </p>
            <p className="text-slate-300 text-sm">{subtitle}</p>
          </div>

          {primary.bestHand && primary.bestHand.length > 0 && !primary.wonByFold && (
            <div className="shrink-0">
              <p className="text-xs text-slate-500 mb-1.5 text-center">
                Winning hand
              </p>
              <div className="flex justify-center gap-1 flex-wrap">
                {primary.bestHand.map((card, i) => (
                  <PlayingCard
                    key={`${card}-${i}`}
                    card={card}
                    delay={i * 0.08}
                    className="scale-90 origin-center"
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {winners.length > 1 && (
          <div className="border-t border-slate-700 pt-3 mt-4 space-y-1">
            {winners.slice(1).map((w) => (
              <p key={w.seatId} className="text-sm text-slate-400 text-center sm:text-left">
                {w.displayName}: +{w.amount.toLocaleString()}
                {w.handName ? ` · ${w.handName}` : ""}
              </p>
            ))}
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
