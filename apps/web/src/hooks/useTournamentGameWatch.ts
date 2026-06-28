"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { io } from "socket.io-client";
import { ClientEvents, ServerEvents } from "@poker/protocol";

const GAME_SERVER_WS =
  process.env.NEXT_PUBLIC_GAME_SERVER_WS ?? "http://localhost:3001";

/** Listen for a new game starting and navigate to the table. */
export function useTournamentGameWatch(
  tournamentId: string,
  gameToken: string | undefined,
  enabled: boolean
): void {
  const router = useRouter();

  useEffect(() => {
    if (!enabled || !gameToken) return;

    const socket = io(GAME_SERVER_WS, {
      auth: { token: gameToken },
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    const onConnect = () => {
      socket.emit(ClientEvents.WATCH_TOURNAMENT, tournamentId);
    };

    const onGameStarted = () => {
      router.push(`/tournament/${tournamentId}/table`);
    };

    socket.on("connect", onConnect);
    socket.on(ServerEvents.GAME_STARTED, onGameStarted);

    if (socket.connected) {
      onConnect();
    }

    return () => {
      socket.off("connect", onConnect);
      socket.off(ServerEvents.GAME_STARTED, onGameStarted);
      socket.disconnect();
    };
  }, [tournamentId, gameToken, enabled, router]);
}
