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
import { lastActionTone } from "@/lib/lastActionStyle";
import {
  getSeatPositionForViewer,
  getViewerSortedSeatIndex,
  seatAnchorTransform,
} from "./tableLayout";
import type { SeatPublic, ShownHand } from "@poker/protocol";
import { hostSeatControl } from "@poker/protocol";

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
  visualIndex: number;
  seatCount: number;
  isActive: boolean;
  animateDeal?: boolean;
  revealHoleCards?: boolean;
  isHost?: boolean;
  actionSecondsLeft?: number | null;
  onSkip?: (seatId: number) => void;
  onUnskip?: (seatId: number) => void;
}

export function PlayerSeat({
  seat,
  isMe,
  myCards,
  showCards,
  position,
  visualIndex,
  seatCount,
  isActive,
  animateDeal = true,
  revealHoleCards = false,
  isHost = false,
  actionSecondsLeft = null,
  onSkip,
  onUnskip,
}: PlayerSeatProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onDoc(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const holeCards = myCards ?? [];
  const cardsToShow =
    isMe && holeCards.length > 0
      ? holeCards
      : showCards && holeCards.length > 0
        ? holeCards
        : [undefined, undefined];

  const statusBadge =
    seat.skipReason === "host" || seat.skipReason === "timeout"
      ? "sit-out"
      : seat.away
        ? "away"
        : seat.skipped
          ? "sit-out"
          : null;

  const actionTone = seat.lastAction ? lastActionTone(seat.lastAction) : null;
  const hostControl = isHost && !isMe ? hostSeatControl(seat) : null;

  return (
    <motion.div
      className={`absolute flex flex-col items-center${revealHoleCards ? " z-20" : ""}`}
      style={{
        left: `${position.x}%`,
        top: `${position.y}%`,
        transform: seatAnchorTransform(visualIndex, seatCount),
      }}
      animate={{ opacity: seat.folded ? 0.4 : statusBadge ? 0.55 : 1 }}
    >
      <div className="relative">
        {isActive && (
          <motion.div
            className="absolute -inset-1 rounded-full border-2 border-amber-400"
            animate={{ opacity: [1, 0.5, 1] }}
            transition={{ repeat: Infinity, duration: 1.2 }}
          />
        )}
        <img
          src={getAvatarUrl(seat.displayName, seat.avatarUrl)}
          alt={seat.displayName}
          className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2 bg-slate-800 relative z-10 ${
            statusBadge === "away"
              ? "border-slate-400 grayscale"
              : statusBadge === "sit-out"
                ? "border-orange-500 grayscale"
                : "border-slate-600"
          }`}
        />
        {statusBadge ? (
          <span
            className={`absolute -bottom-1 left-1/2 -translate-x-1/2 z-20 px-1.5 py-0.5 rounded text-[9px] font-bold text-white whitespace-nowrap ${
              statusBadge === "away" ? "bg-slate-600" : "bg-orange-600"
            }`}
          >
            {statusBadge === "away" ? "Away" : "Sit-out"}
          </span>
        ) : null}
        {isActive && actionSecondsLeft !== null && (
          <span
            className={`absolute -top-2 left-1/2 -translate-x-1/2 z-30 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
              actionSecondsLeft <= 10
                ? "bg-red-600 text-white"
                : "bg-slate-900/90 text-amber-300"
            }`}
          >
            {actionSecondsLeft}s
          </span>
        )}
        {seat.isDealer && (
          <span className="absolute -top-1 -right-1 w-4 h-4 sm:w-5 sm:h-5 bg-white text-slate-900 text-[10px] sm:text-xs font-bold rounded-full flex items-center justify-center z-20">
            D
          </span>
        )}
        {seat.isSmallBlind && !seat.isDealer && (
          <span className="absolute -top-1 -left-1 w-4 h-4 sm:w-5 sm:h-5 bg-sky-500 text-white text-[9px] sm:text-[10px] font-bold rounded-full flex items-center justify-center z-20">
            SB
          </span>
        )}
        {seat.isBigBlind && (
          <span className="absolute -bottom-1 -right-1 w-4 h-4 sm:w-5 sm:h-5 bg-rose-500 text-white text-[9px] sm:text-[10px] font-bold rounded-full flex items-center justify-center z-20">
            BB
          </span>
        )}
      </div>

      <div className="relative mt-0.5" ref={menuRef}>
        {hostControl ? (
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            className="text-[11px] sm:text-xs font-semibold max-w-[88px] truncate text-slate-100 hover:text-amber-200 underline-offset-2 hover:underline"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            title="Seat options"
          >
            {seat.displayName}
          </button>
        ) : (
          <p className="text-[11px] sm:text-xs font-semibold max-w-[88px] truncate text-slate-100">
            {seat.displayName}
          </p>
        )}
        {menuOpen && hostControl ? (
          <div
            role="menu"
            className="absolute left-1/2 -translate-x-1/2 top-full mt-1 z-40 min-w-[7.5rem] rounded-md border border-slate-600 bg-slate-950/95 shadow-xl py-1"
          >
            <button
              type="button"
              role="menuitem"
              className="w-full px-3 py-1.5 text-left text-xs text-slate-200 hover:bg-slate-800"
              onClick={() => {
                if (hostControl === "unskip") onUnskip?.(seat.seatId);
                else onSkip?.(seat.seatId);
                setMenuOpen(false);
              }}
            >
              {hostControl === "unskip" ? "Unskip player" : "Skip player"}
            </button>
          </div>
        ) : null}
      </div>

      {seat.lastAction && actionTone ? (
        <motion.p
          key={seat.lastAction}
          initial={{ opacity: 0.4, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`mt-0.5 px-1.5 py-0.5 rounded border text-[10px] sm:text-[11px] font-semibold max-w-[96px] truncate ${actionTone.text} ${actionTone.ring}`}
        >
          {seat.lastAction}
        </motion.p>
      ) : null}

      <p className="text-[11px] sm:text-xs text-amber-400 font-mono tabular-nums font-semibold leading-tight">
        {seat.chipCount.toLocaleString()}
        {seat.allIn && " (AI)"}
      </p>

      {seat.betThisRound > 0 && (
        <p className="text-[10px] sm:text-[11px] text-emerald-400 font-mono tabular-nums">
          Bet {seat.betThisRound.toLocaleString()}
        </p>
      )}

      <div className="flex gap-0.5 sm:gap-1 mt-1">
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
  uncalledAmount?: number;
  myUserId: string;
  myCards: string[];
  shownCards: ShownHand[];
  viewerSeatId?: number | null;
  dealerSeat: number;
  currentActorSeat: number | null;
  phase: string;
  animateDeal?: boolean;
  onBoardRevealChange?: (revealing: boolean) => void;
  onVisibleBoardChange?: (board: (string | undefined)[]) => void;
  isHost?: boolean;
  actionDeadlineAt?: number | null;
  onSkipPlayer?: (seatId: number) => void;
  onUnskipPlayer?: (seatId: number) => void;
}

export function PokerTable({
  seats,
  board,
  pots,
  totalPot,
  uncalledAmount = 0,
  myUserId,
  myCards,
  shownCards,
  viewerSeatId = null,
  dealerSeat: _dealerSeat,
  currentActorSeat,
  phase,
  animateDeal = true,
  onBoardRevealChange,
  onVisibleBoardChange,
  isHost = false,
  actionDeadlineAt = null,
  onSkipPlayer,
  onUnskipPlayer,
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
  const [compactSeats, setCompactSeats] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 640px)");
    const apply = () => setCompactSeats(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    onVisibleBoardChange?.(visibleBoard);
  }, [visibleBoard, onVisibleBoardChange]);

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

  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (!actionDeadlineAt) return;
    setNowMs(Date.now());
    const id = setInterval(() => setNowMs(Date.now()), 250);
    return () => clearInterval(id);
  }, [actionDeadlineAt, currentActorSeat]);

  const actionSecondsLeft =
    actionDeadlineAt && currentActorSeat !== null
      ? Math.max(0, Math.ceil((actionDeadlineAt - nowMs) / 1000))
      : null;

  return (
    <div className="relative w-full h-full max-h-full mx-auto aspect-[4/3] max-sm:aspect-auto">
      <div className="absolute inset-0 rounded-[50%] bg-gradient-to-b from-felt-light via-felt to-felt-dark border-[6px] sm:border-8 border-amber-900/55 shadow-[0_12px_40px_rgba(0,0,0,0.55)]" />
      <div
        className="absolute inset-0 rounded-[50%] opacity-30 pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(ellipse at 50% 35%, rgba(255,255,255,0.08), transparent 55%)",
        }}
      />

      <div className="absolute inset-[7%] rounded-[50%] border border-emerald-900/40" />

      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-10">
        <div className="flex gap-1 sm:gap-1.5 mb-2 min-h-[3.5rem] sm:min-h-[4.5rem]">
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
          initial={{ scale: 1.12 }}
          animate={{ scale: 1 }}
          className="bg-slate-950/55 border border-amber-500/25 rounded-full px-3 py-0.5 text-amber-300 font-mono text-xs sm:text-sm tabular-nums font-semibold tracking-tight"
        >
          Pot {totalPot.toLocaleString()}
        </motion.div>

        {pots.length > 1 || uncalledAmount > 0 ? (
          <div className="flex gap-1.5 mt-1 flex-wrap justify-center max-w-[15rem]">
            {pots.map((pot, i) => (
              <span
                key={i}
                className="text-[10px] bg-slate-950/45 px-1.5 py-0.5 rounded text-slate-300 font-mono"
              >
                {i === 0 ? "Main" : `Side ${i}`}: {pot.amount.toLocaleString()}
              </span>
            ))}
            {uncalledAmount > 0 ? (
              <span className="text-[10px] bg-slate-950/45 px-1.5 py-0.5 rounded text-amber-300/90 font-mono">
                Uncalled: {uncalledAmount.toLocaleString()}
              </span>
            ) : null}
          </div>
        ) : null}

        <p className="text-[10px] text-slate-400/90 mt-1 capitalize tracking-wide">
          {phase.replace(/-/g, " ")}
        </p>
      </div>

      {sortedSeats.map((seat, i) => {
        const pos = getSeatPositionForViewer(
          i,
          sortedSeats.length,
          viewerSeatIndex,
          compactSeats
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
            position={{ x: pos.x, y: pos.y }}
            visualIndex={pos.visualIndex}
            seatCount={sortedSeats.length}
            isActive={seat.seatId === currentActorSeat}
            animateDeal={animateDeal}
            isHost={isHost}
            actionSecondsLeft={
              seat.seatId === currentActorSeat ? actionSecondsLeft : null
            }
            onSkip={onSkipPlayer}
            onUnskip={onUnskipPlayer}
          />
        );
      })}
    </div>
  );
}
