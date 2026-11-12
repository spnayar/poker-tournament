"use client";

import {
  Fragment,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useCallback,
} from "react";
import { formatRankDisplay } from "@/lib/cardDisplay";
import { getAvatarUrl } from "@/lib/utils";
import { InstagramFollowLink } from "@/components/InstagramFollowLink";
import type { ActionLogEntry } from "@poker/protocol";
import { ZoomActionLogBanner } from "./ZoomActionLogBanner";
import { groupActionLogNewestFirst } from "./actionLogView";

interface ActionLogPanelProps {
  actionLog: ActionLogEntry[];
  currentActorSeat: number | null;
  handNumber: number;
  visibleBoard?: (string | undefined)[];
  hideAwards?: boolean;
  zoomJoinUrl?: string | null;
  zoomMeetingNumber?: string | null;
}

/** Stick to latest when within this many px of the top (newest-first log). */
const STICK_TO_LATEST_THRESHOLD_PX = 48;

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
  if (action.startsWith("Bet") || action.startsWith("Raise"))
    return "text-emerald-400";
  if (action.startsWith("All-in") || action.startsWith("Wins"))
    return "text-amber-400";
  if (action === "Shows") return "text-amber-300";
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

function communityStreetShown(
  entry: ActionLogEntry,
  visibleBoard?: (string | undefined)[]
): number {
  if (!entry.cards || entry.cards.length === 0) return 0;
  const revealedCount = visibleBoard
    ? visibleBoard.filter(Boolean).length
    : entry.cards.length;
  if (entry.street === "flop") {
    return Math.min(entry.cards.length, revealedCount);
  }
  if (entry.street === "turn") {
    return revealedCount >= 4 ? entry.cards.length : 0;
  }
  if (entry.street === "river") {
    return revealedCount >= 5 ? entry.cards.length : 0;
  }
  return entry.cards.length;
}

function LogPlayingCard({ card }: { card: string }) {
  const rank = formatRankDisplay(card[0]!);
  const suit = card[1]!;
  const suitSymbol = SUIT_SYMBOLS[suit] ?? suit;
  const colorClass = SUIT_COLORS[suit] ?? "text-slate-300";

  return (
    <span
      className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-white border border-slate-600 text-xs font-bold font-mono tabular-nums ${colorClass}`}
    >
      <span>{rank}</span>
      <span>{suitSymbol}</span>
    </span>
  );
}

function HandSeparator({
  handNumber,
  isLatestHand,
}: {
  handNumber: number;
  isLatestHand: boolean;
}) {
  return (
    <li className="list-none" aria-label={`Hand ${handNumber}`}>
      <div
        className={`flex items-center gap-2 py-2 ${
          isLatestHand ? "pt-0.5" : "pt-3"
        }`}
      >
        <div
          className={`h-px flex-1 ${
            isLatestHand
              ? "bg-gradient-to-r from-transparent via-emerald-500/50 to-emerald-500/20"
              : "bg-gradient-to-r from-transparent via-slate-600 to-slate-700/40"
          }`}
        />
        <span
          className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] font-mono tabular-nums ${
            isLatestHand
              ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/35"
              : "bg-slate-800/80 text-slate-400 border border-slate-700"
          }`}
        >
          Hand #{handNumber}
        </span>
        <div
          className={`h-px flex-1 ${
            isLatestHand
              ? "bg-gradient-to-l from-transparent via-emerald-500/50 to-emerald-500/20"
              : "bg-gradient-to-l from-transparent via-slate-600 to-slate-700/40"
          }`}
        />
      </div>
    </li>
  );
}

export function ActionLogPanel({
  actionLog,
  currentActorSeat,
  handNumber,
  visibleBoard,
  hideAwards = false,
  zoomJoinUrl = null,
  zoomMeetingNumber = null,
}: ActionLogPanelProps) {
  const scrollRef = useRef<HTMLUListElement>(null);
  const stickToLatestRef = useRef(true);

  const handGroups = useMemo(
    () => groupActionLogNewestFirst(actionLog),
    [actionLog]
  );

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    // Newest-first: "following latest" means near the top.
    stickToLatestRef.current = el.scrollTop <= STICK_TO_LATEST_THRESHOLD_PX;
  }, []);

  const scrollToLatest = useCallback(() => {
    const el = scrollRef.current;
    if (!el || !stickToLatestRef.current) return;
    // Panel-only scroll — avoid scrollIntoView so the page/table shell stays put.
    el.scrollTop = 0;
  }, []);

  useLayoutEffect(() => {
    scrollToLatest();
  }, [actionLog, handNumber, scrollToLatest]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      scrollToLatest();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [actionLog.length, scrollToLatest]);

  return (
    <aside className="table-chrome w-full lg:w-64 xl:w-72 shrink-0 rounded-md p-2 sm:p-2.5 flex flex-col min-h-0 max-h-full max-sm:flex-none max-sm:max-h-[26%] overflow-hidden relative z-0">
      <div className="mb-1.5 shrink-0 flex items-baseline justify-between gap-2">
        <h2 className="text-xs font-semibold text-slate-200 tracking-tight">
          Action Log
        </h2>
        {handNumber > 0 ? (
          <p className="text-[10px] text-slate-500 font-mono tabular-nums">
            #{handNumber}
          </p>
        ) : null}
      </div>

      {zoomJoinUrl ? (
        <ZoomActionLogBanner
          zoomJoinUrl={zoomJoinUrl}
          zoomMeetingNumber={zoomMeetingNumber}
        />
      ) : null}

      {handGroups.length === 0 ? (
        <p className="text-sm text-slate-500 flex-1">Waiting for action...</p>
      ) : (
        <ul
          ref={scrollRef}
          onScroll={handleScroll}
          className="table-scroll space-y-0.5 overflow-y-auto flex-1 min-h-0 overscroll-contain"
        >
          {handGroups.map((group, groupIndex) => {
            const isLatestHand = groupIndex === 0;
            return (
              <Fragment key={`hand-group-${group.handNumber}`}>
                <HandSeparator
                  handNumber={group.handNumber}
                  isLatestHand={isLatestHand}
                />
                {group.entries.map((entry, index) => {
                  if (hideAwards && entry.action.startsWith("Wins")) {
                    return null;
                  }

                  if (entry.seatId === -2 && entry.cards && entry.cards.length > 0) {
                    const streetShown = communityStreetShown(
                      entry,
                      visibleBoard
                    );
                    if (streetShown <= 0) return null;
                    const cardsToShow = entry.cards.slice(0, streetShown);

                    return (
                      <li key={entry.id}>
                        <div className="py-1.5 px-2 rounded-lg bg-slate-800/40">
                          <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1.5">
                            {entry.action}
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {cardsToShow.map((card, i) => (
                              <LogPlayingCard
                                key={`${card}-${i}`}
                                card={card}
                              />
                            ))}
                          </div>
                        </div>
                      </li>
                    );
                  }

                  // Newer entry is above (lower index) in reverse-chrono list.
                  const newerStreet =
                    index > 0 ? group.entries[index - 1]!.street : null;
                  const showStreetHeader =
                    entry.street !== "hand" &&
                    (index === 0 || entry.street !== newerStreet);

                  return (
                    <li key={entry.id}>
                      {showStreetHeader && (
                        <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold py-1.5 px-1">
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
              </Fragment>
            );
          })}
        </ul>
      )}

      <div className="mt-1.5 pt-1.5 border-t border-slate-800/80 shrink-0 flex justify-center">
        <InstagramFollowLink variant="chrome" />
      </div>
    </aside>
  );
}
