"use client";

import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState, useRef, useCallback, useLayoutEffect } from "react";
import { io, Socket } from "socket.io-client";
import { PokerTable } from "@/components/table/PokerTable";
import { ActionPanel } from "@/components/table/ActionPanel";
import { ActionLogPanel } from "@/components/table/ActionLogPanel";
import { HandResultOverlay, HandWinnerChipBurst } from "@/components/table/HandResultOverlay";
import { POST_REVEAL_PAUSE_MS } from "@/components/table/tableAnimation";
import { GameEndSidebar } from "@/components/table/GameEndSidebar";
import { BlindTimerBar } from "@/components/table/BlindTimerBar";
import { DealNextHandBar } from "@/components/table/DealNextHandBar";
import { SoundToggle } from "@/components/table/SoundToggle";
import { DashboardLink } from "@/components/table/DashboardLink";
import { useSoundPreference } from "@/hooks/useSoundPreference";
import {
  playHandEndCheer,
  playNewHandSounds,
  unlockTableSounds,
} from "@/lib/sounds";
import { LEDGER_DISCLAIMER } from "@/lib/utils";
import {
  ServerEvents,
  ClientEvents,
  type TableState,
  type LegalActions,
  type HandResult,
  type GameFinished,
  type GameStarted,
  type ActionLogEntry,
  type ShownHand,
  type BlindTimerState,
  awayDisplayNames,
  formatActorWaitingLabel,
  formatAwayBanner,
} from "@poker/protocol";

const GAME_SERVER_WS =
  process.env.NEXT_PUBLIC_GAME_SERVER_WS ?? "http://localhost:3001";

function handStorageKey(tournamentId: string): string {
  return `poker-hand-${tournamentId}`;
}

const MAX_ACTION_LOG_ENTRIES = 400;

function mergeActionLog(
  previous: ActionLogEntry[],
  incoming: ActionLogEntry[]
): ActionLogEntry[] {
  const byId = new Map(previous.map((e) => [e.id, e]));
  for (const entry of incoming) {
    byId.set(entry.id, entry);
  }
  const merged = [...byId.values()].sort((a, b) => a.id - b.id);
  if (merged.length > MAX_ACTION_LOG_ENTRIES) {
    return merged.slice(merged.length - MAX_ACTION_LOG_ENTRIES);
  }
  return merged;
}

export default function TablePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const tournamentId = params.id as string;
  const gameToken = session?.user?.gameToken;

  const socketRef = useRef<Socket | null>(null);
  const handNumberRef = useRef(0);
  const gameFinishedRef = useRef(false);
  const viewerSeatIdRef = useRef<number | null>(null);
  const tableStateRef = useRef<TableState | null>(null);
  const actionLogRef = useRef<ActionLogEntry[]>([]);
  const syncSeqRef = useRef(0);
  const footerRef = useRef<HTMLDivElement>(null);
  const [tableState, setTableState] = useState<TableState | null>(null);
  const [actionLog, setActionLog] = useState<ActionLogEntry[]>([]);
  const [myCards, setMyCards] = useState<string[]>([]);
  const [legalActions, setLegalActions] = useState<LegalActions | null>(null);
  const [shownCards, setShownCards] = useState<ShownHand[]>([]);
  const [handResult, setHandResult] = useState<HandResult | null>(null);
  const [showHandResult, setShowHandResult] = useState(false);
  const [boardRevealing, setBoardRevealing] = useState(false);
  const [visibleBoard, setVisibleBoard] = useState<(string | undefined)[]>([]);
  const [footerH, setFooterH] = useState(0);
  const [gameFinished, setGameFinished] = useState<GameFinished | null>(null);
  const [connected, setConnected] = useState(false);
  const [actionPending, setActionPending] = useState(false);
  const [dealNextPending, setDealNextPending] = useState(false);
  const [hostActionLoading, setHostActionLoading] = useState(false);
  const [blindTimer, setBlindTimer] = useState<
    (BlindTimerState & { hostUserId?: string }) | null
  >(null);
  const [timerActionLoading, setTimerActionLoading] = useState(false);
  const [animateDeal, setAnimateDeal] = useState(true);
  const [viewerSeatId, setViewerSeatId] = useState<number | null>(null);
  const { enabled: soundEnabled, toggle: toggleSound } = useSoundPreference();
  const cheeredHandRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = sessionStorage.getItem(handStorageKey(tournamentId));
    handNumberRef.current = stored ? parseInt(stored, 10) : 0;
    actionLogRef.current = [];
    setActionLog([]);
    cheeredHandRef.current = null;
  }, [tournamentId]);

  useEffect(() => {
    if (!handResult) {
      setShowHandResult(false);
      return;
    }
    if (boardRevealing) {
      setShowHandResult(false);
      return;
    }
    const t = setTimeout(() => setShowHandResult(true), POST_REVEAL_PAUSE_MS);
    return () => clearTimeout(t);
  }, [handResult, boardRevealing]);

  useEffect(() => {
    if (!showHandResult || !handResult) return;
    const handKey = handResult.handNumber ?? handNumberRef.current;
    if (cheeredHandRef.current === handKey) return;
    cheeredHandRef.current = handKey;
    playHandEndCheer();
  }, [showHandResult, handResult]);

  const handleBoardRevealChange = useCallback((revealing: boolean) => {
    setBoardRevealing(revealing);
  }, []);

  const handleVisibleBoardChange = useCallback(
    (next: (string | undefined)[]) => {
      setVisibleBoard(next);
    },
    []
  );

  useLayoutEffect(() => {
    const el = footerRef.current;
    if (!el) {
      setFooterH(0);
      return;
    }
    const update = () => setFooterH(el.getBoundingClientRect().height);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [tableState?.phase, tableState?.currentActorSeat, legalActions]);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  const joinTournament = useCallback(
    (socket: Socket) => {
      socket.emit(ClientEvents.JOIN_TOURNAMENT, tournamentId);
    },
    [tournamentId]
  );

  const watchTournament = useCallback(
    (socket: Socket) => {
      socket.emit(ClientEvents.WATCH_TOURNAMENT, tournamentId);
    },
    [tournamentId]
  );

  const syncTournamentConnection = useCallback(
    (socket: Socket) => {
      if (gameFinishedRef.current) {
        watchTournament(socket);
      } else {
        joinTournament(socket);
      }
    },
    [joinTournament, watchTournament]
  );

  useEffect(() => {
    gameFinishedRef.current = gameFinished !== null;
  }, [gameFinished]);

  useEffect(() => {
    if (status !== "authenticated" || !gameToken) return;

    const handleTableState = (state: TableState) => {
      if (
        typeof state.syncSeq === "number" &&
        state.syncSeq < syncSeqRef.current
      ) {
        return;
      }
      if (typeof state.syncSeq === "number") {
        syncSeqRef.current = state.syncSeq;
      }

      const previousHand = handNumberRef.current;
      const handAdvanced = state.handNumber > previousHand;
      const isActivePhase =
        state.phase !== "hand-complete" &&
        state.phase !== "showdown" &&
        state.phase !== "waiting";
      // Mid-join: storage empty / 0 but table already past hand 1 — don't re-animate.
      const joinedMidHand = previousHand === 0 && state.handNumber > 1;
      const isNewHand = handAdvanced && isActivePhase && !joinedMidHand;

      if (isNewHand) {
        setHandResult(null);
        setShowHandResult(false);
        setShownCards([]);
        setMyCards([]);
        setAnimateDeal(true);
        setDealNextPending(false);
        cheeredHandRef.current = null;
        const activePlayers = state.seats.filter(
          (s) => s.userId && !s.folded && (s.chipCount > 0 || s.allIn)
        ).length;
        playNewHandSounds(Math.max(activePlayers, 2));
      } else if (handAdvanced && joinedMidHand) {
        setAnimateDeal(false);
      } else if (state.handNumber === previousHand && previousHand > 0) {
        setAnimateDeal(false);
      }

      if (state.phase === "waiting" && state.handNumber === 0) {
        actionLogRef.current = [];
      } else {
        actionLogRef.current = mergeActionLog(
          actionLogRef.current,
          state.actionLog
        );
      }
      setActionLog(actionLogRef.current);

      handNumberRef.current = state.handNumber;
      if (typeof window !== "undefined") {
        sessionStorage.setItem(
          handStorageKey(tournamentId),
          String(state.handNumber)
        );
      }

      const isActiveBetting =
        state.currentActorSeat !== null &&
        state.phase !== "hand-complete" &&
        state.phase !== "showdown" &&
        state.phase !== "waiting";
      if (isActiveBetting) {
        setHandResult(null);
        setShowHandResult(false);
      }

      tableStateRef.current = state;
      const mySeatInState = state.seats.find(
        (s) => s.userId === session?.user?.id
      );
      if (mySeatInState) {
        viewerSeatIdRef.current = mySeatInState.seatId;
        setViewerSeatId(mySeatInState.seatId);
      }
      if (
        !mySeatInState ||
        mySeatInState.skipped ||
        mySeatInState.seatId !== state.currentActorSeat
      ) {
        setLegalActions(null);
      }
      setTableState(state);
      setActionPending(false);
    };

    const handlePlayerCards = (cards: string[]) => {
      setMyCards(cards);
    };

    const handleActionRequired = (legal: LegalActions) => {
      setLegalActions(legal);
      setActionPending(false);
      setHandResult(null);
    };

    const handleHandResult = (result: HandResult) => {
      const state = tableStateRef.current;
      if (
        state &&
        state.phase !== "hand-complete" &&
        state.phase !== "showdown" &&
        state.currentActorSeat !== null
      ) {
        return;
      }
      if (
        result.handNumber !== undefined &&
        handNumberRef.current > 0 &&
        result.handNumber !== handNumberRef.current
      ) {
        return;
      }
      setHandResult(result);
      setShownCards(result.shownCards);
      const viewerSeatId = viewerSeatIdRef.current;
      if (viewerSeatId !== null) {
        const mine = result.shownCards.find((s) => s.seatId === viewerSeatId);
        if (mine && mine.holeCards.length > 0) {
          setMyCards(mine.holeCards);
        }
      }
      setLegalActions(null);
      setActionPending(false);
    };

    const handleBlindTimer = (
      payload: BlindTimerState & { hostUserId?: string }
    ) => {
      setBlindTimer(payload);
    };

    const handleGameStarted = (_payload: GameStarted) => {
      gameFinishedRef.current = false;
      setGameFinished(null);
      setHandResult(null);
      setShowHandResult(false);
      setShownCards([]);
      setMyCards([]);
      setDealNextPending(false);
      handNumberRef.current = 0;
      actionLogRef.current = [];
      setActionLog([]);
      syncSeqRef.current = 0;
      joinTournament(socket!);
    };

    const handleGameFinished = (result: GameFinished) => {
      gameFinishedRef.current = true;
      setGameFinished(result);
      setLegalActions(null);
      setActionPending(false);
      setDealNextPending(false);
      socketRef.current?.emit(ClientEvents.WATCH_TOURNAMENT, tournamentId);
    };

    const handleTournamentFinished = () => {
      router.push(`/tournament/${tournamentId}/results`);
    };

    const handleError = (err: { message: string }) => {
      if (
        err.message.includes("No game in progress") &&
        gameFinishedRef.current
      ) {
        watchTournament(socket!);
        return;
      }
      console.error("Game error:", err.message);
      setActionPending(false);
      setDealNextPending(false);
      if (err.message.includes("deleted")) {
        router.push("/dashboard");
      }
    };

    let socket = socketRef.current;
    if (!socket) {
      socket = io(GAME_SERVER_WS, {
        auth: { token: gameToken },
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
      });
      socketRef.current = socket;
    }

    const onConnect = () => {
      setConnected(true);
      syncTournamentConnection(socket!);
    };

    const onDisconnect = () => {
      setConnected(false);
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on(ServerEvents.TABLE_STATE, handleTableState);
    socket.on(ServerEvents.PLAYER_CARDS, handlePlayerCards);
    socket.on(ServerEvents.ACTION_REQUIRED, handleActionRequired);
    socket.on(ServerEvents.HAND_RESULT, handleHandResult);
    socket.on(ServerEvents.GAME_FINISHED, handleGameFinished);
    socket.on(ServerEvents.GAME_STARTED, handleGameStarted);
    socket.on(ServerEvents.BLIND_TIMER, handleBlindTimer);
    socket.on(ServerEvents.TOURNAMENT_FINISHED, handleTournamentFinished);
    socket.on(ServerEvents.ERROR, handleError);

    if (socket.connected) {
      onConnect();
    }

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off(ServerEvents.TABLE_STATE, handleTableState);
      socket.off(ServerEvents.PLAYER_CARDS, handlePlayerCards);
      socket.off(ServerEvents.ACTION_REQUIRED, handleActionRequired);
      socket.off(ServerEvents.HAND_RESULT, handleHandResult);
      socket.off(ServerEvents.GAME_FINISHED, handleGameFinished);
      socket.off(ServerEvents.GAME_STARTED, handleGameStarted);
      socket.off(ServerEvents.BLIND_TIMER, handleBlindTimer);
      socket.off(ServerEvents.TOURNAMENT_FINISHED, handleTournamentFinished);
      socket.off(ServerEvents.ERROR, handleError);
    };
  }, [status, tournamentId, gameToken, router, syncTournamentConnection, watchTournament]);

  useEffect(() => {
    return () => {
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [tournamentId]);

  function sendAction(action: unknown) {
    if (!socketRef.current || actionPending || handResult || gameFinished) return;
    setActionPending(true);
    setLegalActions(null);
    socketRef.current.emit(ClientEvents.ACTION, action);
  }

  function dealNextHand() {
    if (!socketRef.current || dealNextPending || gameFinished) return;
    setDealNextPending(true);
    socketRef.current.emit(ClientEvents.START_NEXT_HAND);
  }

  function pauseBlindTimer() {
    if (!socketRef.current || timerActionLoading) return;
    setTimerActionLoading(true);
    socketRef.current.emit(ClientEvents.PAUSE_BLIND_TIMER);
    setTimeout(() => setTimerActionLoading(false), 300);
  }

  function resumeBlindTimer() {
    if (!socketRef.current || timerActionLoading) return;
    setTimerActionLoading(true);
    socketRef.current.emit(ClientEvents.RESUME_BLIND_TIMER);
    setTimeout(() => setTimerActionLoading(false), 300);
  }

  function advanceBlindLevel() {
    if (!socketRef.current || timerActionLoading) return;
    setTimerActionLoading(true);
    socketRef.current.emit(ClientEvents.ADVANCE_BLIND_LEVEL);
    setTimeout(() => setTimerActionLoading(false), 300);
  }

  function skipPlayer(seatId: number) {
    socketRef.current?.emit(ClientEvents.SKIP_PLAYER, { seatId });
  }

  function unskipPlayer(seatId: number) {
    socketRef.current?.emit(ClientEvents.UNSKIP_PLAYER, { seatId });
  }

  async function playAnotherGame() {
    setHostActionLoading(true);
    const res = await fetch(`/api/tournaments/${tournamentId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "start" }),
    });
    if (res.ok) {
      // GAME_STARTED broadcast will resync all players at the table.
    }
    setHostActionLoading(false);
  }

  async function closePokerNight() {
    setHostActionLoading(true);
    const res = await fetch(`/api/tournaments/${tournamentId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "close" }),
    });
    if (res.ok) {
      router.push(`/tournament/${tournamentId}/results`);
    }
    setHostActionLoading(false);
  }

  if (!tableState) {
    return (
      <div className="min-h-screen flex flex-col">
        <div className="p-4">
          <DashboardLink />
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <p className="text-slate-400">
            {connected ? "Loading table..." : "Connecting to game server..."}
          </p>
        </div>
      </div>
    );
  }

  const mySeat = tableState.seats.find((s) => s.userId === session?.user?.id);
  const isHost =
    session?.user?.id ===
    (gameFinished?.hostUserId ?? blindTimer?.hostUserId ?? undefined);
  const awaitingNextHand =
    tableState.phase === "hand-complete" && !gameFinished;
  const nextDealerSeat = tableState.nextDealerSeat ?? null;
  const nextDealer = tableState.seats.find(
    (s) => s.seatId === nextDealerSeat
  );
  const nextDealerSkipped = nextDealer?.skipped === true;
  const nextDealerAway = nextDealer?.away === true;
  const nextDealerUnavailable = nextDealerSkipped || nextDealerAway;
  const canDealNext =
    awaitingNextHand &&
    mySeat !== undefined &&
    (nextDealerSeat === mySeat.seatId ||
      (Boolean(isHost) && nextDealerUnavailable));
  const isBetting =
    !gameFinished &&
    !awaitingNextHand &&
    tableState.phase !== "showdown" &&
    tableState.phase !== "waiting";
  const actorSeat = tableState.seats.find(
    (s) => s.seatId === tableState.currentActorSeat
  );
  const actorName = actorSeat?.displayName ?? null;
  const awayBanner = formatAwayBanner(awayDisplayNames(tableState.seats));
  const waitingLabel = formatActorWaitingLabel({
    isViewerActor: Boolean(
      mySeat && mySeat.seatId === tableState.currentActorSeat
    ),
    actorName,
    actorAway: actorSeat?.away === true,
    actorSkipped: actorSeat?.skipped === true,
  });
  const showFooter = isBetting || (awaitingNextHand && nextDealer);
  const footerPad = showFooter ? Math.max(footerH, 96) + 12 : 0;

  return (
      <div
        className="min-h-screen p-4 flex flex-col max-sm:h-[100dvh] max-sm:min-h-0 max-sm:overflow-hidden"
        style={{
          ...(showFooter ? { paddingBottom: footerPad } : {}),
          ["--table-footer-h" as string]: showFooter
            ? `${Math.max(footerH, 96)}px`
            : "0px",
        }}
        onPointerDownCapture={unlockTableSounds}
      >
      <div className="flex items-center gap-2 mb-2 max-sm:mb-1">
        <DashboardLink />
        <p className="flex-1 text-center text-amber-400/70 text-xs min-w-0 truncate">
          {LEDGER_DISCLAIMER}
        </p>
        <SoundToggle enabled={soundEnabled} onToggle={toggleSound} />
      </div>
      {tableState && !connected && (
        <p className="text-center text-amber-300 text-sm mb-2">
          Connection lost — reconnecting…
        </p>
      )}

      <div className="flex-1 flex flex-col lg:flex-row gap-4 items-stretch justify-center max-w-7xl mx-auto w-full min-h-0">
        {gameFinished && (
          <GameEndSidebar
            tournamentId={tournamentId}
            result={gameFinished}
            isHost={session?.user?.id === gameFinished.hostUserId}
            actionLoading={hostActionLoading}
            onPlayAnother={playAnotherGame}
            onCloseNight={closePokerNight}
            seatAvatars={tableState?.seats}
          />
        )}

        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          {blindTimer && !gameFinished && (
            <BlindTimerBar
              timer={blindTimer}
              myUserId={session?.user?.id ?? ""}
              onPause={pauseBlindTimer}
              onResume={resumeBlindTimer}
              onAdvance={advanceBlindLevel}
              actionLoading={timerActionLoading}
            />
          )}
          <div className="flex-1 flex flex-col lg:flex-row gap-4 items-stretch min-h-0">
            <div className="flex-1 flex items-center justify-center min-w-0 min-h-0 lg:min-h-0 max-sm:flex-none max-sm:h-[min(26dvh,170px)] max-sm:max-h-[min(26dvh,170px)] max-sm:overflow-hidden">
              <div
                className={`relative w-full max-w-3xl${
                  shownCards.length > 0 ? " mb-4" : ""
                }`}
              >
                <PokerTable
                  seats={tableState.seats}
                  board={tableState.board}
                  pots={tableState.pots}
                  totalPot={tableState.totalPot}
                  uncalledAmount={tableState.uncalledAmount ?? 0}
                  myUserId={session?.user?.id ?? ""}
                  viewerSeatId={viewerSeatId}
                  myCards={myCards}
                  shownCards={shownCards}
                  dealerSeat={tableState.dealerSeat}
                  currentActorSeat={tableState.currentActorSeat}
                  phase={tableState.phase}
                  animateDeal={animateDeal}
                  onBoardRevealChange={handleBoardRevealChange}
                  onVisibleBoardChange={handleVisibleBoardChange}
                  isHost={Boolean(isHost)}
                  actionDeadlineAt={tableState.actionDeadlineAt ?? null}
                  onSkipPlayer={skipPlayer}
                  onUnskipPlayer={unskipPlayer}
                />
                {showHandResult && handResult && (
                  <HandWinnerChipBurst
                    result={handResult}
                    seats={tableState.seats}
                    myUserId={session?.user?.id ?? ""}
                    viewerSeatId={viewerSeatId}
                  />
                )}
              </div>
            </div>

            <ActionLogPanel
              actionLog={actionLog}
              currentActorSeat={tableState.currentActorSeat}
              handNumber={tableState.handNumber}
              visibleBoard={visibleBoard}
              hideAwards={boardRevealing}
            />
          </div>

          {showHandResult && handResult && (
            <HandResultOverlay result={handResult} shownCards={shownCards} />
          )}

          <div className="text-center text-sm text-slate-400 mt-2 mb-2 shrink-0 max-sm:hidden">
            Level {tableState.blindLevel} · Blinds {tableState.smallBlind}/
            {tableState.bigBlind} · Hand #{tableState.handNumber}
            {gameFinished && (
              <span className="text-amber-400"> · Tournament over</span>
            )}
          </div>
        </div>
      </div>

      {showFooter && (
        <div
          ref={footerRef}
          className="fixed bottom-0 inset-x-0 z-40 border-t border-slate-700/80 bg-slate-950/95 backdrop-blur-md shadow-[0_-8px_24px_rgba(0,0,0,0.45)]"
        >
          <div className="max-w-7xl mx-auto px-3 py-2 safe-area-pb">
            {awayBanner && awaitingNextHand ? (
              <p className="text-center text-amber-300 text-sm font-medium mb-2">
                {awayBanner}
              </p>
            ) : null}
            {awaitingNextHand && nextDealer && (
              <DealNextHandBar
                dealerName={nextDealer.displayName}
                canDeal={canDealNext}
                pending={dealNextPending}
                onDeal={dealNextHand}
                dealerAway={
                  Boolean(isHost) &&
                  nextDealerUnavailable &&
                  nextDealerSeat !== mySeat?.seatId
                }
              />
            )}
            {isBetting && (
              <ActionPanel
                legal={legalActions}
                onAction={sendAction}
                disabled={actionPending}
                waitingLabel={waitingLabel}
                awayBanner={awayBanner}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
