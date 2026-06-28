"use client";

import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { PokerTable } from "@/components/table/PokerTable";
import { ActionPanel } from "@/components/table/ActionPanel";
import { ActionLogPanel } from "@/components/table/ActionLogPanel";
import { HandResultOverlay, HandWinnerChipBurst } from "@/components/table/HandResultOverlay";
import { POST_REVEAL_PAUSE_MS } from "@/components/table/tableAnimation";
import { GameEndSidebar } from "@/components/table/GameEndSidebar";
import { DealNextHandBar } from "@/components/table/DealNextHandBar";
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
  const [tableState, setTableState] = useState<TableState | null>(null);
  const [actionLog, setActionLog] = useState<ActionLogEntry[]>([]);
  const [myCards, setMyCards] = useState<string[]>([]);
  const [legalActions, setLegalActions] = useState<LegalActions | null>(null);
  const [shownCards, setShownCards] = useState<ShownHand[]>([]);
  const [handResult, setHandResult] = useState<HandResult | null>(null);
  const [showHandResult, setShowHandResult] = useState(false);
  const [boardRevealing, setBoardRevealing] = useState(false);
  const [gameFinished, setGameFinished] = useState<GameFinished | null>(null);
  const [connected, setConnected] = useState(false);
  const [actionPending, setActionPending] = useState(false);
  const [dealNextPending, setDealNextPending] = useState(false);
  const [hostActionLoading, setHostActionLoading] = useState(false);
  const [animateDeal, setAnimateDeal] = useState(true);
  const [viewerSeatId, setViewerSeatId] = useState<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = sessionStorage.getItem(handStorageKey(tournamentId));
    handNumberRef.current = stored ? parseInt(stored, 10) : 0;
    actionLogRef.current = [];
    setActionLog([]);
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

  const handleBoardRevealChange = useCallback((revealing: boolean) => {
    setBoardRevealing(revealing);
  }, []);

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
      const previousHand = handNumberRef.current;
      const isNewHand =
        state.handNumber > previousHand &&
        previousHand > 0 &&
        state.phase !== "hand-complete" &&
        state.phase !== "showdown";

      if (isNewHand) {
        setHandResult(null);
        setShowHandResult(false);
        setShownCards([]);
        setMyCards([]);
        setAnimateDeal(true);
        setDealNextPending(false);
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

    socket.on("connect", onConnect);
    socket.on(ServerEvents.TABLE_STATE, handleTableState);
    socket.on(ServerEvents.PLAYER_CARDS, handlePlayerCards);
    socket.on(ServerEvents.ACTION_REQUIRED, handleActionRequired);
    socket.on(ServerEvents.HAND_RESULT, handleHandResult);
    socket.on(ServerEvents.GAME_FINISHED, handleGameFinished);
    socket.on(ServerEvents.GAME_STARTED, handleGameStarted);
    socket.on(ServerEvents.TOURNAMENT_FINISHED, handleTournamentFinished);
    socket.on(ServerEvents.ERROR, handleError);

    if (socket.connected) {
      onConnect();
    }

    return () => {
      socket.off("connect", onConnect);
      socket.off(ServerEvents.TABLE_STATE, handleTableState);
      socket.off(ServerEvents.PLAYER_CARDS, handlePlayerCards);
      socket.off(ServerEvents.ACTION_REQUIRED, handleActionRequired);
      socket.off(ServerEvents.HAND_RESULT, handleHandResult);
      socket.off(ServerEvents.GAME_FINISHED, handleGameFinished);
      socket.off(ServerEvents.GAME_STARTED, handleGameStarted);
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
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-slate-400">
          {connected ? "Loading table..." : "Connecting to game server..."}
        </p>
      </div>
    );
  }

  const mySeat = tableState.seats.find((s) => s.userId === session?.user?.id);
  const awaitingNextHand =
    tableState.phase === "hand-complete" && !gameFinished;
  const nextDealerSeat = tableState.nextDealerSeat ?? null;
  const nextDealer = tableState.seats.find(
    (s) => s.seatId === nextDealerSeat
  );
  const canDealNext =
    awaitingNextHand &&
    mySeat !== undefined &&
    nextDealerSeat === mySeat.seatId;
  const isBetting =
    !gameFinished &&
    !awaitingNextHand &&
    tableState.phase !== "showdown" &&
    tableState.phase !== "waiting";

  return (
    <div className="min-h-screen p-4 flex flex-col">
      <p className="text-center text-amber-400/70 text-xs mb-2">
        {LEDGER_DISCLAIMER}
      </p>

      <div className="flex-1 flex flex-col lg:flex-row gap-4 items-stretch justify-center max-w-7xl mx-auto w-full">
        {gameFinished && (
          <GameEndSidebar
            tournamentId={tournamentId}
            result={gameFinished}
            isHost={session?.user?.id === gameFinished.hostUserId}
            actionLoading={hostActionLoading}
            onPlayAnother={playAnotherGame}
            onCloseNight={closePokerNight}
          />
        )}

        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 flex flex-col lg:flex-row gap-4 items-stretch">
            <div className="flex-1 flex items-center justify-center min-w-0">
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
                  myUserId={session?.user?.id ?? ""}
                  viewerSeatId={viewerSeatId}
                  myCards={myCards}
                  shownCards={shownCards}
                  dealerSeat={tableState.dealerSeat}
                  currentActorSeat={tableState.currentActorSeat}
                  phase={tableState.phase}
                  animateDeal={animateDeal}
                  onBoardRevealChange={handleBoardRevealChange}
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
            />
          </div>

          {showHandResult && handResult && (
            <HandResultOverlay result={handResult} shownCards={shownCards} />
          )}

          {awaitingNextHand && nextDealer && (
            <DealNextHandBar
              dealerName={nextDealer.displayName}
              canDeal={canDealNext}
              pending={dealNextPending}
              onDeal={dealNextHand}
            />
          )}

          <div className="text-center text-sm text-slate-400 mt-2 mb-2">
            Level {tableState.blindLevel} · Blinds {tableState.smallBlind}/
            {tableState.bigBlind} · Hand #{tableState.handNumber}
            {gameFinished && (
              <span className="text-amber-400"> · Game over</span>
            )}
          </div>

          {isBetting && (
            <ActionPanel
              legal={legalActions}
              onAction={sendAction}
              disabled={actionPending}
            />
          )}
        </div>
      </div>
    </div>
  );
}
