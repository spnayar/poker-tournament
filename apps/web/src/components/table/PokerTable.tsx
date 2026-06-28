"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  PlayingCard,
} from "./PlayingCard";
import {
  getBoardRevealSchedule,
  getBoardRevealTotalMs,
  HOLE_CARD_DELAY_SEC,
} from "./tableAnimation";
import { getAvatarUrl } from "@/lib/utils";
import {
  getSeatPositionForViewer,
  getViewerSortedSeatIndex,
} from "./tableLayout";
import type { HandResult, SeatPublic, ShownHand } from "@poker/protocol";

function emptyBoard(): (string | undefined)[] {
  return [undefined, undefined, undefined, undefined, undefined];
}

function padBoard(board: string[]): (string | undefined)[] {
  const slots = emptyBoard();
  for (let i = 0; i < Math.min(5, board.length); i++) {
    slots[i] = board[i];
  }
  return slots;
}

interface PlayerSeatProps {
  seat: SeatPublic;
  isMe: boolean;
  myCards?: string[];
  showCards?: boolean;
  position: { x: number; y: number };
  isActive: boolean;
  animateDeal?: boolean;
  revealHoleCards?: boolean;
}

export function PlayerSeat({
  seat,
  isMe,
  myCards,
  showCards,
  position,
  isActive,
  animateDeal = true,
  revealHoleCards = false,
}: PlayerSeatProps) {
  const holeCards = myCards ?? [];
  const cardsToShow =
    isMe && holeCards.length > 0
      ? holeCards
      : showCards && holeCards.length > 0
        ? holeCards
        : [undefined, undefined];

  return (
    <motion.div
      className={`absolute flex flex-col items-center${revealHoleCards ? " z-20" : ""}`}
      style={{
        left: `${position.x}%`,
        top: `${position.y}%`,
        transform: "translate(-50%, -50%)",
      }}
      animate={{ opacity: seat.folded ? 0.4 : 1 }}
    >
      <div className="relative">
        {isActive && (
          <motion.div
            className="absolute -inset-1 rounded-full border-2 border-amber-400"
            animate={{ opacity: [1, 0.5, 1] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
          />
        )}
        <img
          src={getAvatarUrl(seat.displayName, seat.avatarUrl)}
          alt={seat.displayName}
          className="w-14 h-14 rounded-full border-2 border-slate-600 bg-slate-800 relative z-10"
        />
        {seat.isDealer && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-white text-slate-900 text-xs font-bold rounded-full flex items-center justify-center z-20">
            D
          </span>
        )}
      </div>

      <p className="text-xs font-medium mt-1 max-w-[80px] truncate">
        {seat.displayName}
      </p>
      <p className="text-xs text-amber-400 font-mono">
        {seat.chipCount.toLocaleString()}
        {seat.allIn && " (AI)"}
      </p>

      {seat.betThisRound > 0 && (
        <p className="text-xs text-emerald-400">Bet: {seat.betThisRound}</p>
      )}

      <div className="flex gap-1 mt-2">
        {cardsToShow.map((card, i) => (
          <PlayingCard
            key={i}
            card={card}
            faceDown={!card || (!isMe && !showCards)}
            delay={i * HOLE_CARD_DELAY_SEC}
            animateDeal={animateDeal}
          />
        ))}
      </div>
    </motion.div>
  );
}

interface PokerTableProps {
  seats: SeatPublic[];
  board: string[];
  pots: { amount: number; eligibleSeatIds: number[] }[];
  totalPot: number;
  myUserId: string;
  myCards: string[];
  shownCards: ShownHand[];
  viewerSeatId?: number | null;
  dealerSeat: number;
  currentActorSeat: number | null;
  phase: string;
  animateDeal?: boolean;
  onBoardRevealChange?: (revealing: boolean) => void;
}

export function PokerTable({
  seats,
  board,
  pots,
  totalPot,
  myUserId,
  myCards,
  shownCards,
  viewerSeatId = null,
  dealerSeat,
  currentActorSeat,
  phase,
  animateDeal = true,
  onBoardRevealChange,
}: PokerTableProps) {
  const sortedSeats = [...seats].sort((a, b) => a.seatId - b.seatId);
  const viewerSeatIndex = getViewerSortedSeatIndex(
    sortedSeats,
    myUserId,
    viewerSeatId
  );
  const [visibleBoard, setVisibleBoard] =
    useState<(string | undefined)[]>(emptyBoard);
  const prevBoardRef = useRef<string[]>([]);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useLayoutEffect(() => {
    for (const t of timersRef.current) clearTimeout(t);
    timersRef.current = [];

    const prev = prevBoardRef.current;
    const next = board;

    if (next.length === 0) {
      setVisibleBoard(emptyBoard());
      prevBoardRef.current = [];
      onBoardRevealChange?.(false);
      return;
    }

    if (next.length <= prev.length) {
      setVisibleBoard(padBoard(next));
      prevBoardRef.current = next;
      onBoardRevealChange?.(false);
      return;
    }

    const scheduleReveal = (fn: () => void, ms: number) => {
      const t = setTimeout(fn, ms);
      timersRef.current.push(t);
    };

    setVisibleBoard(prev.length === 0 ? emptyBoard() : padBoard(prev));

    const totalMs = getBoardRevealTotalMs(prev.length, next);
    onBoardRevealChange?.(totalMs > 0);

    const schedule = getBoardRevealSchedule(prev.length, next);
    for (const { slot, delayMs } of schedule) {
      scheduleReveal(() => {
        setVisibleBoard((slots) => {
          const updated = [...slots];
          updated[slot] = next[slot];
          return updated;
        });
      }, delayMs);
    }

    scheduleReveal(() => {
      setVisibleBoard(padBoard(next));
      prevBoardRef.current = next;
      onBoardRevealChange?.(false);
    }, totalMs);
  }, [board, onBoardRevealChange]);

  useEffect(() => {
    return () => {
      for (const t of timersRef.current) clearTimeout(t);
    };
  }, []);

  return (
    <div className="relative w-full max-w-3xl mx-auto aspect-[4/3]">
      <div className="absolute inset-0 rounded-[50%] bg-gradient-to-b from-felt-light to-felt-dark border-8 border-amber-900/60 shadow-2xl shadow-black/50" />

      <div className="absolute inset-[8%] rounded-[50%] border-2 border-felt/50" />

      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-10">
        <div className="flex gap-2 mb-3 min-h-[5rem]">
          {[0, 1, 2, 3, 4].map((slot) => (
            <PlayingCard
              key={slot}
              card={visibleBoard[slot]}
              faceDown={!visibleBoard[slot]}
              variant="community"
            />
          ))}
        </div>

        <motion.div
          key={totalPot}
          initial={{ scale: 1.2 }}
          animate={{ scale: 1 }}
          className="bg-black/40 rounded-full px-4 py-1 text-amber-400 font-mono text-sm"
        >
          Pot: {totalPot.toLocaleString()}
        </motion.div>

        {pots.length > 1 && (
          <div className="flex gap-2 mt-2 flex-wrap justify-center">
            {pots.map((pot, i) => (
              <span
                key={i}
                className="text-xs bg-black/30 px-2 py-0.5 rounded text-slate-300"
              >
                {i === 0 ? "Main" : `Side ${i}`}: {pot.amount}
              </span>
            ))}
          </div>
        )}

        <p className="text-xs text-slate-400 mt-2 capitalize">{phase}</p>
      </div>

      {sortedSeats.map((seat, i) => {
        const pos = getSeatPositionForViewer(
          i,
          sortedSeats.length,
          viewerSeatIndex
        );
        const shown = shownCards.find((s) => s.seatId === seat.seatId);
        const isMe = seat.userId === myUserId;
        const holeCardsForSeat = isMe
          ? myCards.length > 0
            ? myCards
            : (shown?.holeCards ?? [])
          : (shown?.holeCards ?? []);
        const showHoleCards =
          isMe ? holeCardsForSeat.length > 0 : !!shown;
        return (
          <PlayerSeat
            key={seat.seatId}
            seat={seat}
            isMe={isMe}
            myCards={holeCardsForSeat}
            showCards={showHoleCards}
            revealHoleCards={showHoleCards && holeCardsForSeat.length > 0}
            position={pos}
            isActive={seat.seatId === currentActorSeat}
            animateDeal={animateDeal}
          />
        );
      })}
    </div>
  );
}
