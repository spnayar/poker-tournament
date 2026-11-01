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
  seatAnchorTransformForViewer,
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
  /** Zoom active-speaker match (name-based). Emerald ring — amber stays for “to act”. */
  isSpeaking?: boolean;
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
  isSpeaking = false,
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

  // Top-half seats: cards hang below the pod (toward center).
  // Bottom/hero: cards sit above the pod (toward center / above action bar).
  const cardsBelowPod = !isMe && position.y < 58;
  const cardScale = isMe
    ? ""
    : seatCount >= 6
      ? `scale-[0.62] ${cardsBelowPod ? "origin-top" : "origin-bottom"}`
      : `scale-[0.78] ${cardsBelowPod ? "origin-top" : "origin-bottom"}`;

  const holeCardRow = (
    <div
      className={`flex gap-0.5 sm:gap-1 relative z-20 ${cardScale} ${
        cardsBelowPod ? "mt-[-0.35rem]" : "mb-[-0.35rem]"
      } ${isMe ? "mb-[-0.15rem]" : ""}`}
    >
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
  );

  const seatPod = (
      <div
        className={`relative z-10 flex items-center gap-1.5 rounded-full pl-0.5 pr-2.5 py-0.5 border shadow-[0_4px_14px_rgba(0,0,0,0.45)] ${
          isActive
            ? "bg-slate-950/95 border-amber-400 ring-2 ring-amber-400/55"
            : isSpeaking
              ? "bg-slate-950/92 border-emerald-400/80 ring-1 ring-emerald-400/40"
              : "bg-slate-950/88 border-slate-600/90"
        }`}
      >
        {isActive ? (
          <motion.span
            className="pointer-events-none absolute inset-0 rounded-full border border-amber-300/70"
            animate={{ opacity: [0.95, 0.35, 0.95] }}
            transition={{ repeat: Infinity, duration: 1.15 }}
            aria-hidden
          />
        ) : null}

        <div className="relative shrink-0">
          <img
            src={getAvatarUrl(seat.displayName, seat.avatarUrl)}
            alt=""
            className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full border-2 bg-slate-800 object-cover ${
              statusBadge === "away"
                ? "border-slate-400 grayscale"
                : statusBadge === "sit-out"
                  ? "border-orange-500 grayscale"
                  : isSpeaking
                    ? "border-emerald-400"
                    : isActive
                      ? "border-amber-300"
                      : "border-slate-500"
            }`}
          />
          {statusBadge ? (
            <span
              className={`absolute -bottom-1 left-1/2 -translate-x-1/2 z-20 px-1 py-px rounded text-[8px] font-bold text-white whitespace-nowrap ${
                statusBadge === "away" ? "bg-slate-600" : "bg-orange-600"
              }`}
            >
              {statusBadge === "away" ? "Away" : "Sit-out"}
            </span>
          ) : null}
          {seat.isDealer ? (
            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 sm:w-4 sm:h-4 bg-slate-100 text-slate-900 text-[8px] sm:text-[9px] font-bold rounded-full flex items-center justify-center z-20 shadow border border-amber-500/70">
              D
            </span>
          ) : null}
          {seat.isSmallBlind && !seat.isDealer ? (
            <span className="absolute -top-1 -left-1 w-3.5 h-3.5 sm:w-4 sm:h-4 bg-slate-700 text-sky-200 text-[7px] sm:text-[8px] font-bold rounded-full flex items-center justify-center z-20 border border-sky-400/50">
              SB
            </span>
          ) : null}
          {seat.isBigBlind ? (
            <span className="absolute -bottom-0.5 -right-1 w-3.5 h-3.5 sm:w-4 sm:h-4 bg-slate-700 text-amber-200 text-[7px] sm:text-[8px] font-bold rounded-full flex items-center justify-center z-20 border border-amber-400/50">
              BB
            </span>
          ) : null}
        </div>

        <div className="relative min-w-0 leading-tight" ref={menuRef}>
          {hostControl ? (
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              className="block text-[11px] sm:text-xs font-semibold max-w-[5.5rem] sm:max-w-[6.5rem] truncate text-slate-100 hover:text-amber-200 underline-offset-2 hover:underline"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              title="Seat options"
            >
              {seat.displayName}
            </button>
          ) : (
            <p className="text-[11px] sm:text-xs font-semibold max-w-[5.5rem] sm:max-w-[6.5rem] truncate text-slate-100">
              {seat.displayName}
            </p>
          )}
          <p className="text-[11px] sm:text-xs text-amber-400 font-mono tabular-nums font-semibold">
            {seat.chipCount.toLocaleString()}
            {seat.allIn ? (
              <span className="text-amber-300/90 font-sans text-[9px] ml-0.5">
                AI
              </span>
            ) : null}
          </p>
          {menuOpen && hostControl ? (
            <div
              role="menu"
              className="absolute left-0 top-full mt-1 z-40 min-w-[7.5rem] rounded-md border border-slate-600 bg-slate-950/95 shadow-xl py-1"
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

        {isActive && actionSecondsLeft !== null ? (
          <span
            className={`shrink-0 px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold ${
              actionSecondsLeft <= 10
                ? "bg-red-600 text-white"
                : "bg-slate-900 text-amber-300 border border-amber-500/40"
            }`}
          >
            {actionSecondsLeft}s
          </span>
        ) : null}
      </div>
  );

  return (
    <motion.div
      className={`absolute flex flex-col items-center${revealHoleCards || isMe ? " z-20" : " z-10"}`}
      style={{
        left: `${position.x}%`,
        top: `${position.y}%`,
        transform: seatAnchorTransformForViewer(visualIndex, seatCount, isMe),
      }}
      animate={{ opacity: seat.folded ? 0.38 : statusBadge ? 0.55 : 1 }}
    >
      {seat.lastAction && actionTone && cardsBelowPod ? (
        <motion.p
          key={seat.lastAction}
          initial={{ opacity: 0.4, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`mb-0.5 px-1.5 py-0.5 rounded border text-[10px] sm:text-[11px] font-semibold max-w-[7.5rem] truncate shadow-sm ${actionTone.text} ${actionTone.ring}`}
        >
          {seat.lastAction}
        </motion.p>
      ) : null}

      {cardsBelowPod ? (
        <>
          {seatPod}
          {holeCardRow}
          {seat.betThisRound > 0 ? (
            <p className="mt-0.5 px-1.5 py-0.5 rounded-full bg-slate-950/70 border border-emerald-700/40 text-[10px] sm:text-[11px] text-emerald-300 font-mono tabular-nums shadow-sm">
              {seat.betThisRound.toLocaleString()}
            </p>
          ) : null}
        </>
      ) : (
        <>
          {seat.lastAction && actionTone ? (
            <motion.p
              key={seat.lastAction}
              initial={{ opacity: 0.4, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`mb-0.5 px-1.5 py-0.5 rounded border text-[10px] sm:text-[11px] font-semibold max-w-[7.5rem] truncate shadow-sm ${actionTone.text} ${actionTone.ring}`}
            >
              {seat.lastAction}
            </motion.p>
          ) : null}
          {seat.betThisRound > 0 ? (
            <p className="mb-0.5 px-1.5 py-0.5 rounded-full bg-slate-950/70 border border-emerald-700/40 text-[10px] sm:text-[11px] text-emerald-300 font-mono tabular-nums shadow-sm">
              {seat.betThisRound.toLocaleString()}
            </p>
          ) : null}
          {holeCardRow}
          {seatPod}
        </>
      )}
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
  speakingUserIds?: string[];
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
  speakingUserIds = [],
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
    <div className="relative w-full h-full max-h-full mx-auto aspect-[4/3] max-sm:aspect-auto overflow-visible">
      {/* Soft wood floor wash behind the oval */}
      <div
        className="absolute -inset-3 sm:-inset-4 rounded-[42%] opacity-70 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at 50% 55%, rgba(68, 42, 24, 0.35), transparent 68%)",
        }}
        aria-hidden
      />
      <div
        className="absolute inset-0 rounded-[50%] bg-gradient-to-b from-felt-light via-felt to-felt-dark pointer-events-none border-[7px] sm:border-8 border-[#6b4a2a]"
        style={{
          boxShadow:
            "0 14px 42px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.08), inset 0 0 0 2px rgba(180,130,70,0.35)",
        }}
      />
      <div
        className="absolute inset-0 rounded-[50%] opacity-40 pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(ellipse at 50% 32%, rgba(255,255,255,0.11), transparent 52%)",
        }}
      />

      <div className="absolute inset-[8%] rounded-[50%] border border-emerald-950/35 pointer-events-none" />

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
          className="table-chrome table-chrome-amber rounded-full px-3.5 py-1 text-amber-300 font-mono text-xs sm:text-sm tabular-nums font-semibold tracking-tight shadow-[0_4px_16px_rgba(0,0,0,0.35)]"
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
            isSpeaking={speakingUserIds.includes(seat.userId)}
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
