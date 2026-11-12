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
import { BlindsUpToast } from "@/components/table/BlindsUpToast";
import { ActionTimerControls } from "@/components/table/ActionTimerControls";
import { ActionTimerNudge } from "@/components/table/ActionTimerNudge";
import { DealNextHandBar } from "@/components/table/DealNextHandBar";
import { SoundToggle } from "@/components/table/SoundToggle";
import { DashboardLink } from "@/components/table/DashboardLink";
import { HostMenu } from "@/components/table/HostMenu";
import { ChopDialog } from "@/components/table/ChopDialog";
import { ZoomMirrorStrip } from "@/components/table/ZoomMirrorStrip";
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
  type BlindsUp,
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
  const [chopOpen, setChopOpen] = useState(false);
  const [chopSubmitting, setChopSubmitting] = useState(false);
  const [chopError, setChopError] = useState("");
  const chopOpenRef = useRef(false);
  chopOpenRef.current = chopOpen;
  const [blindTimer, setBlindTimer] = useState<
    (BlindTimerState & { hostUserId?: string }) | null
  >(null);
  const [blindsUpEvent, setBlindsUpEvent] = useState<BlindsUp | null>(null);
  const [timerActionLoading, setTimerActionLoading] = useState(false);
  const [animateDeal, setAnimateDeal] = useState(true);
  const [viewerSeatId, setViewerSeatId] = useState<number | null>(null);
  const { enabled: soundEnabled, toggle: toggleSound } = useSoundPreference();
  const cheeredHandRef = useRef<number | null>(null);
  const [speakingUserIds, setSpeakingUserIds] = useState<string[]>([]);
  const [zoomJoinUrl, setZoomJoinUrl] = useState<string | null>(null);
  const [zoomMeetingNumber, setZoomMeetingNumber] = useState<string | null>(
    null
  );
  const [hostUserId, setHostUserId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = sessionStorage.getItem(handStorageKey(tournamentId));
    handNumberRef.current = stored ? parseInt(stored, 10) : 0;
    actionLogRef.current = [];
    setActionLog([]);
    cheeredHandRef.current = null;
  }, [tournamentId]);

  useEffect(() => {
    if (status !== "authenticated") return;
    let cancelled = false;
    void (async () => {
      try {
        const [zoomRes, tournamentRes] = await Promise.all([
          fetch(`/api/tournaments/${tournamentId}/zoom`),
          fetch(`/api/tournaments/${tournamentId}`),
        ]);
        if (cancelled) return;
        if (zoomRes.ok) {
          const data = await zoomRes.json();
          if (cancelled) return;
          const url =
            typeof data?.zoom?.zoomJoinUrl === "string"
              ? data.zoom.zoomJoinUrl
              : null;
          setZoomJoinUrl(url);
          setZoomMeetingNumber(
            typeof data?.zoom?.zoomMeetingNumber === "string"
              ? data.zoom.zoomMeetingNumber
              : null
          );
        }
        if (tournamentRes.ok) {
          const data = await tournamentRes.json();
          if (cancelled) return;
          if (typeof data?.tournament?.hostUserId === "string") {
            setHostUserId(data.tournament.hostUserId);
          }
        }
      } catch {
        // Zoom banner / host hint are optional; table still works without them.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status, tournamentId]);

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
  }, [
    tableState?.phase,
    tableState?.currentActorSeat,
    legalActions,
    handResult,
    boardRevealing,
  ]);

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

    const handleBlindsUp = (payload: BlindsUp) => {
      setBlindsUpEvent({ ...payload });
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
      if (err.message.includes("No game in progress")) {
        watchTournament(socket!);
        // Between tournaments / after a chop, restore results so reload
        // is not stuck on "Loading table…".
        if (!gameFinishedRef.current) {
          void (async () => {
            try {
              const res = await fetch(`/api/tournaments/${tournamentId}`);
              if (!res.ok) return;
              const data = await res.json();
              if (data?.tournament?.status === "FINISHED") {
                router.push(`/tournament/${tournamentId}/results`);
                return;
              }
              const finished = (data?.tournament?.games ?? []).find(
                (g: { status: string }) => g.status === "FINISHED"
              );
              if (!finished || !Array.isArray(finished.results)) return;
              const buyInCents =
                typeof data.tournament?.buyInCents === "number"
                  ? data.tournament.buyInCents
                  : 0;
              setGameFinished({
                gameId: finished.id,
                gameNumber: finished.gameNumber,
                buyInCents,
                hostUserId: data.tournament?.hostUserId ?? "",
                finishOrder: finished.results.map(
                  (r: {
                    userId: string;
                    finishPosition: number;
                    payoutCents: number;
                    user?: {
                      displayName?: string;
                      avatarUrl?: string | null;
                    };
                  }) => ({
                    userId: r.userId,
                    position: r.finishPosition,
                    payoutCents: r.payoutCents,
                    displayName: r.user?.displayName ?? "Player",
                    avatarUrl: r.user?.avatarUrl ?? null,
                  })
                ),
                prizePoolCents: finished.prizePoolCents ?? 0,
                chopped: Boolean(finished.chopped),
              });
            } catch {
              // Keep watching; host may start another tournament.
            }
          })();
        }
        return;
      }
      console.error("Game error:", err.message);
      setActionPending(false);
      setDealNextPending(false);
      setChopSubmitting(false);
      if (chopOpenRef.current) setChopError(err.message);
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
    socket.on(ServerEvents.BLINDS_UP, handleBlindsUp);
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
      socket.off(ServerEvents.BLINDS_UP, handleBlindsUp);
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

  function readySeating() {
    if (!socketRef.current || hostActionLoading || gameFinished) return;
    setHostActionLoading(true);
    socketRef.current.emit(ClientEvents.READY_SEATING);
    window.setTimeout(() => setHostActionLoading(false), 800);
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

  function advanceBlindToLevel(targetLevelIndex: number) {
    if (!socketRef.current || timerActionLoading) return;
    setTimerActionLoading(true);
    socketRef.current.emit(ClientEvents.ADVANCE_BLIND_LEVEL, {
      targetLevelIndex,
    });
    setTimeout(() => setTimerActionLoading(false), 300);
  }

  function pauseActionTimer() {
    if (!socketRef.current || timerActionLoading) return;
    setTimerActionLoading(true);
    socketRef.current.emit(ClientEvents.PAUSE_ACTION_TIMER);
    setTimeout(() => setTimerActionLoading(false), 300);
  }

  function resumeActionTimer() {
    if (!socketRef.current || timerActionLoading) return;
    setTimerActionLoading(true);
    socketRef.current.emit(ClientEvents.RESUME_ACTION_TIMER);
    setTimeout(() => setTimerActionLoading(false), 300);
  }

  function resetActionTimer() {
    if (!socketRef.current || timerActionLoading) return;
    setTimerActionLoading(true);
    socketRef.current.emit(ClientEvents.RESET_ACTION_TIMER);
    setTimeout(() => setTimerActionLoading(false), 300);
  }

  function disableActionTimer() {
    if (!socketRef.current || timerActionLoading) return;
    setTimerActionLoading(true);
    socketRef.current.emit(ClientEvents.DISABLE_ACTION_TIMER);
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
      const data = await res.json().catch(() => ({}));
      const preview =
        typeof data?.recap?.previewHtml === "string"
          ? data.recap.previewHtml
          : null;
      if (preview) {
        const { storeRecapPreviewHtml } = await import("@/lib/recapPreview");
        storeRecapPreviewHtml(tournamentId, preview);
      }
      router.push(`/tournament/${tournamentId}/results`);
    }
    setHostActionLoading(false);
  }

  // After a tournament ends the live room is gone; still show results on reload.
  if (gameFinished && !tableState) {
    const isHostOnly =
      session?.user?.id === gameFinished.hostUserId;
    return (
      <div className="min-h-screen flex flex-col">
        <div className="p-4">
          <DashboardLink />
        </div>
        <div className="flex-1 flex items-start justify-center p-4">
          <GameEndSidebar
            tournamentId={tournamentId}
            result={gameFinished}
            isHost={isHostOnly}
            actionLoading={hostActionLoading}
            onPlayAnother={playAnotherGame}
            onCloseNight={closePokerNight}
          />
        </div>
      </div>
    );
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
    (gameFinished?.hostUserId ??
      blindTimer?.hostUserId ??
      hostUserId ??
      undefined);
  // Phase may reach hand-complete during an all-in runout — wait for board + result.
  const handCompletePhase =
    tableState.phase === "hand-complete" && !gameFinished;
  const seatingReady = tableState.seatingReady === true;
  const seatedWithChips = tableState.seats.filter(
    (seat) => seat.userId && seat.chipCount > 0
  ).length;
  const awaitingFirstDeal =
    !gameFinished &&
    tableState.phase === "waiting" &&
    tableState.handNumber === 0 &&
    seatingReady;
  const awaitingHostReady =
    !gameFinished &&
    tableState.phase === "waiting" &&
    tableState.handNumber === 0 &&
    !seatingReady;
  const awaitingNextHand =
    handCompletePhase && !boardRevealing && handResult !== null;
  const nextDealerSeat = tableState.nextDealerSeat ?? null;
  const nextDealer = tableState.seats.find(
    (s) => s.seatId === nextDealerSeat
  );
  const nextDealerSkipped = nextDealer?.skipped === true;
  const nextDealerAway = nextDealer?.away === true;
  const nextDealerUnavailable = nextDealerSkipped || nextDealerAway;
  const canDealNext =
    (awaitingNextHand || awaitingFirstDeal) &&
    mySeat !== undefined &&
    (nextDealerSeat === mySeat.seatId ||
      (Boolean(isHost) && nextDealerUnavailable));
  const isBetting =
    !gameFinished &&
    !handCompletePhase &&
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
  const iAmSatOut = Boolean(mySeat?.skipped) && !gameFinished;
  const showFooter =
    isBetting ||
    (awaitingNextHand && Boolean(nextDealer)) ||
    awaitingFirstDeal ||
    awaitingHostReady ||
    iAmSatOut;
  const footerPad = showFooter ? Math.max(footerH, 52) + 8 : 0;

  return (
    <div
      className="table-play-shell p-2 sm:p-3 flex flex-col min-h-0"
      style={{
        ...(showFooter ? { paddingBottom: footerPad } : {}),
        ["--table-footer-h" as string]: showFooter
          ? `${Math.max(footerH, 52)}px`
          : "0px",
      }}
      onPointerDownCapture={unlockTableSounds}
    >
      <div className="flex items-center gap-2 mb-1 shrink-0">
        <DashboardLink />
        <p className="flex-1 text-center text-amber-400/60 text-[10px] sm:text-xs min-w-0 truncate">
          {LEDGER_DISCLAIMER}
          <span className="text-slate-500">
            {" "}
            · H#{tableState.handNumber} · {tableState.smallBlind}/
            {tableState.bigBlind}
          </span>
          {gameFinished ? (
            <span className="text-amber-400"> · Tournament over</span>
          ) : null}
        </p>
        {isHost && !gameFinished && (
          <HostMenu
            disabledReason={
              tableState.seats.filter((seat) => seat.chipCount > 0).length < 2
                ? "At least two players need chips"
                : tableState.phase !== "waiting" &&
                    tableState.phase !== "hand-complete"
                  ? "Finish this hand first"
                  : null
            }
            onChop={() => {
              setChopError("");
              setChopOpen(true);
            }}
          />
        )}
        <SoundToggle enabled={soundEnabled} onToggle={toggleSound} />
      </div>
      <ZoomMirrorStrip
        tournamentId={tournamentId}
        seats={tableState.seats}
        onSpeakingUserIds={setSpeakingUserIds}
      />
      {tableState && !connected && (
        <p className="text-center text-amber-300 text-xs mb-1 shrink-0">
          Connection lost — reconnecting…
        </p>
      )}

      <div className="flex-1 flex flex-col lg:flex-row gap-2 sm:gap-3 items-stretch justify-center max-w-7xl mx-auto w-full min-h-0 overflow-visible">
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

        <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-visible">
          {blindTimer && !gameFinished && (
            <BlindTimerBar
              timer={blindTimer}
              myUserId={session?.user?.id ?? ""}
              onPause={pauseBlindTimer}
              onResume={resumeBlindTimer}
              onAdvanceToLevel={advanceBlindToLevel}
              actionLoading={timerActionLoading}
            />
          )}
          <BlindsUpToast event={blindsUpEvent} />
          {isHost && !gameFinished && isBetting && (
            <ActionTimerControls
              actionTimerSeconds={tableState.actionTimerSeconds ?? 60}
              actionTimerPaused={tableState.actionTimerPaused === true}
              actionDeadlineAt={tableState.actionDeadlineAt ?? null}
              actionTimerPausedRemainingMs={
                tableState.actionTimerPausedRemainingMs ?? null
              }
              onPause={pauseActionTimer}
              onResume={resumeActionTimer}
              onReset={resetActionTimer}
              onDisable={disableActionTimer}
              actionLoading={timerActionLoading}
            />
          )}
          <div className="flex-1 flex flex-col lg:flex-row gap-2 sm:gap-3 items-stretch min-h-0 overflow-visible">
            <div className="flex-[1.4] flex items-center justify-center min-w-0 min-h-0 overflow-visible max-sm:min-h-[46%] max-sm:flex-[1.35]">
              <div className="relative w-full h-full max-w-3xl max-h-full pb-6 sm:pb-8 overflow-visible">
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
                  actionTimerPaused={tableState.actionTimerPaused === true}
                  actionTimerPausedRemainingMs={
                    tableState.actionTimerPausedRemainingMs ?? null
                  }
                  speakingUserIds={speakingUserIds}
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
                {showHandResult && handResult && (
                  <HandResultOverlay
                    result={handResult}
                    shownCards={shownCards}
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
              zoomJoinUrl={zoomJoinUrl}
              zoomMeetingNumber={zoomMeetingNumber}
            />
          </div>
        </div>
      </div>

      {showFooter && (
        <div
          ref={footerRef}
          className="fixed bottom-0 inset-x-0 z-40 border-t border-slate-700/50 bg-slate-950/97 backdrop-blur-[2px] shadow-[0_-6px_20px_rgba(0,0,0,0.4)]"
        >
          <div className="max-w-7xl mx-auto px-2 py-1 safe-area-pb">
            {awayBanner && awaitingNextHand ? (
              <p className="text-center text-amber-300 text-xs font-medium mb-1">
                {awayBanner}
              </p>
            ) : null}
            {awaitingHostReady && (
              <div className="w-full max-w-2xl mx-auto flex flex-nowrap items-center justify-center gap-2 px-1 py-0.5">
                {isHost && seatedWithChips >= 2 ? (
                  <>
                    <p className="text-xs text-slate-300 text-center min-w-0 truncate">
                      Everyone seated? Start randomizes seats and the button.
                    </p>
                    <button
                      type="button"
                      onClick={readySeating}
                      disabled={hostActionLoading}
                      className="px-3 py-1 bg-amber-600 hover:bg-amber-500 rounded-md font-semibold text-xs whitespace-nowrap disabled:opacity-50 shrink-0"
                    >
                      {hostActionLoading ? "Starting…" : "Start"}
                    </button>
                  </>
                ) : (
                  <p className="text-xs text-slate-400 text-center truncate">
                    {seatedWithChips < 2
                      ? "Waiting for more players — you can sit alone until friends join."
                      : "Waiting for the host to Start (randomize seats + dealer)…"}
                  </p>
                )}
              </div>
            )}
            {(awaitingNextHand || awaitingFirstDeal) && nextDealer && (
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
            {iAmSatOut && mySeat ? (
              <div className="flex items-center justify-center gap-3 py-1.5">
                <p className="text-sm text-slate-300">
                  You&apos;re away — hands auto check/fold until you return.
                </p>
                <button
                  type="button"
                  onClick={() => unskipPlayer(mySeat.seatId)}
                  className="h-8 px-4 rounded-full bg-emerald-600 hover:bg-emerald-500 text-sm font-semibold text-white"
                >
                  I&apos;m back
                </button>
              </div>
            ) : null}
            {isBetting && !iAmSatOut && (
              <ActionPanel
                legal={legalActions}
                onAction={sendAction}
                disabled={actionPending}
                waitingLabel={waitingLabel}
                awayBanner={awayBanner}
                totalPot={tableState.totalPot}
                bigBlind={tableState.bigBlind}
                actionDeadlineAt={
                  mySeat &&
                  mySeat.seatId === tableState.currentActorSeat &&
                  !tableState.actionTimerPaused
                    ? (tableState.actionDeadlineAt ?? null)
                    : null
                }
              />
            )}
          </div>
        </div>
      )}
      {isBetting &&
      !iAmSatOut &&
      mySeat &&
      mySeat.seatId === tableState.currentActorSeat &&
      !tableState.actionTimerPaused ? (
        <ActionTimerNudge
          actionDeadlineAt={tableState.actionDeadlineAt ?? null}
          soundEnabled={soundEnabled}
        />
      ) : null}
      <ChopDialog
        open={chopOpen && !gameFinished}
        tournamentId={tournamentId}
        seats={tableState.seats}
        submitting={chopSubmitting}
        serverError={chopError}
        onClose={() => {
          if (chopSubmitting) return;
          setChopOpen(false);
          setChopError("");
        }}
        onConfirm={(shares) => {
          if (!socketRef.current || chopSubmitting) return;
          setChopSubmitting(true);
          setChopError("");
          socketRef.current.emit(ClientEvents.CHOP_TOURNAMENT, {
            shares,
            confirm: true,
          });
        }}
      />
    </div>
  );
}
