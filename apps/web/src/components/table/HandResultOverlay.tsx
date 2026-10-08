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

/** How long the winner modal stays fully visible before fading. */
const WINNER_HOLD_MS = 2800;
/** Fade-out duration. */
const WINNER_FADE_MS = 700;

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
      className="absolute w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-gradient-to-br from-amber-300 to-amber-600 border border-amber-200 shadow-lg z-30 pointer-events-none"
      initial={{ left: "50%", top: "50%", x: "-50%", y: "-50%", scale: 0, opacity: 0 }}
      animate={{
        left: `${targetX}%`,
        top: `${targetY}%`,
        x: "-50%",
        y: "-50%",
        scale: [0, 1.2, 1],
        opacity: [0, 1, 1],
      }}
      transition={{ delay, duration: 0.9, ease: "easeOut" }}
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
    const t = setTimeout(() => setPhase("done"), 2200);
    return () => clearTimeout(t);
  }, [result]);

  if (!primary || phase === "done") return null;

  return (
    <>
      {[0, 0.12, 0.24, 0.36, 0.48].map((d, i) => (
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

/** Centered winner modal over the table; holds briefly then fades away. */
export function HandResultOverlay({
  result,
  shownCards,
}: HandResultOverlayProps) {
  const winners = useMemo(
    () => aggregateWinners(result, shownCards),
    [result, shownCards]
  );
  const primary = winners[0];
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    setVisible(true);
    const t = setTimeout(() => setVisible(false), WINNER_HOLD_MS);
    return () => clearTimeout(t);
  }, [result]);

  if (!primary) return null;

  const subtitle = primary.wonByFold
    ? "Everyone else folded"
    : primary.handName ?? "Winner";

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          key={`winner-${result.handNumber ?? primary.seatId}-${primary.amount}`}
          className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center p-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: WINNER_FADE_MS / 1000, ease: "easeOut" }}
        >
          <div className="w-full max-w-sm bg-slate-950/92 border border-amber-500/45 rounded-xl px-4 py-3 shadow-2xl backdrop-blur-sm">
            <p className="text-amber-400 text-[10px] font-semibold uppercase tracking-[0.14em] mb-2 text-center">
              {winners.length > 1 ? "Pot Winners" : "Hand Winner"}
            </p>

            <div className="flex items-center gap-3">
              <img
                src={getAvatarUrl(primary.displayName, primary.avatarUrl)}
                alt=""
                className="w-12 h-12 rounded-full border-2 border-amber-400 shadow-md shrink-0"
              />

              <div className="flex-1 min-w-0 text-left">
                <h2 className="text-base sm:text-lg font-bold text-white truncate">
                  {primary.displayName}
                </h2>
                <p className="text-emerald-400 text-sm sm:text-base font-semibold font-mono tabular-nums">
                  +{primary.amount.toLocaleString()} chips
                </p>
                <p className="text-slate-300 text-xs sm:text-sm truncate">
                  {subtitle}
                </p>
              </div>

              {primary.bestHand &&
                primary.bestHand.length > 0 &&
                !primary.wonByFold && (
                  <div className="shrink-0 flex gap-0.5 scale-75 origin-right">
                    {primary.bestHand.slice(0, 5).map((card, i) => (
                      <PlayingCard
                        key={`${card}-${i}`}
                        card={card}
                        delay={0}
                        animateDeal={false}
                      />
                    ))}
                  </div>
                )}
            </div>

            {winners.length > 1 && (
              <div className="border-t border-slate-700/80 pt-2 mt-2 space-y-0.5">
                {winners.slice(1).map((w) => (
                  <p
                    key={w.seatId}
                    className="text-xs text-slate-400 text-center"
                  >
                    {w.displayName}: +{w.amount.toLocaleString()}
                    {w.handName ? ` · ${w.handName}` : ""}
                  </p>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
