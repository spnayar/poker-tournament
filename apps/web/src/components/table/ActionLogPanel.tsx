"use client";

import { useEffect, useRef, useCallback } from "react";
import { getAvatarUrl } from "@/lib/utils";
import type { ActionLogEntry } from "@poker/protocol";

interface ActionLogPanelProps {
  actionLog: ActionLogEntry[];
  currentActorSeat: number | null;
  handNumber: number;
}

const STICK_TO_BOTTOM_THRESHOLD_PX = 48;

const SUIT_SYMBOLS: Record<string, string> = {
  c: "♣",
  d: "♦",
  h: "♥",
  s: "♠",
};

const SUIT_COLORS: Record<string, string> = {
  c: "text-slate-300",
  d: "text-red-400",
  h: "text-red-400",
  s: "text-slate-300",
};

function actionColor(action: string): string {
  if (action === "Fold") return "text-red-400";
  if (action === "Check") return "text-slate-300";
  if (action.startsWith("Call")) return "text-blue-400";
  if (action.startsWith("Bet") || action.startsWith("Raise")) return "text-emerald-400";
  if (action.startsWith("All-in") || action.startsWith("Wins")) return "text-amber-400";
  if (action.startsWith("SB") || action.startsWith("BB")) return "text-slate-400";
  return "text-slate-300";
}

function streetLabel(street: string): string {
  switch (street) {
    case "hand":
      return "Hand";
    case "preflop":
      return "Preflop";
    case "flop":
      return "Flop";
    case "turn":
      return "Turn";
    case "river":
      return "River";
    case "showdown":
      return "Showdown";
    default:
      return street;
  }
}

function LogPlayingCard({ card }: { card: string }) {
  const rank = card[0]!;
  const suit = card[1]!;
  const suitSymbol = SUIT_SYMBOLS[suit] ?? suit;
  const colorClass = SUIT_COLORS[suit] ?? "text-slate-300";

  return (
    <span
      className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-white border border-slate-600 text-xs font-bold font-mono ${colorClass}`}
    >
      <span>{rank}</span>
      <span>{suitSymbol}</span>
    </span>
  );
}

export function ActionLogPanel({
  actionLog,
  currentActorSeat,
  handNumber,
}: ActionLogPanelProps) {
  const scrollRef = useRef<HTMLUListElement>(null);
  const stickToBottomRef = useRef(true);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottomRef.current = distanceFromBottom <= STICK_TO_BOTTOM_THRESHOLD_PX;
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (stickToBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [actionLog]);

  return (
    <aside className="w-full lg:w-72 shrink-0 bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col max-h-[min(70vh,520px)] min-h-[240px] overflow-hidden">
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-slate-200">Action Log</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Scroll up for earlier hands · Hand #{handNumber}
        </p>
      </div>

      {actionLog.length === 0 ? (
        <p className="text-sm text-slate-500 flex-1">Waiting for action...</p>
      ) : (
        <ul
          ref={scrollRef}
          onScroll={handleScroll}
          className="space-y-1 overflow-y-auto flex-1 min-h-0 overscroll-contain"
        >
          {actionLog.map((entry, index) => {
            if (entry.seatId === -1) {
              return (
                <li key={entry.id}>
                  <p className="text-xs font-semibold text-amber-400/90 py-2 px-1 border-t border-slate-800 first:border-t-0">
                    {entry.action}
                  </p>
                </li>
              );
            }

            if (entry.seatId === -2 && entry.cards && entry.cards.length > 0) {
              return (
                <li key={entry.id}>
                  <div className="py-1.5 px-2 rounded-lg bg-slate-800/40">
                    <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1.5">
                      {entry.action}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {entry.cards.map((card, i) => (
                        <LogPlayingCard key={`${card}-${i}`} card={card} />
                      ))}
                    </div>
                  </div>
                </li>
              );
            }

            const prevStreet = index > 0 ? actionLog[index - 1]!.street : null;
            const showStreetHeader =
              index === 0 || entry.street !== prevStreet;

            return (
              <li key={entry.id}>
                {showStreetHeader && entry.street !== "hand" && (
                  <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold py-2 px-1">
                    {streetLabel(entry.street)}
                  </p>
                )}
                <div
                  className={`flex items-start gap-2 rounded-lg px-2 py-1.5 ${
                    entry.seatId === currentActorSeat
                      ? "bg-amber-500/10"
                      : "hover:bg-slate-800/50"
                  }`}
                >
                  <img
                    src={getAvatarUrl(entry.displayName, entry.avatarUrl)}
                    alt=""
                    className="w-6 h-6 rounded-full shrink-0 mt-0.5"
                  />
                  <div className="min-w-0 flex-1">
                    <span className="text-xs font-medium text-slate-300">
                      {entry.displayName}
                    </span>
                    <p
                      className={`text-sm font-mono ${actionColor(entry.action)}`}
                    >
                      {entry.action}
                    </p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}
