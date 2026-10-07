export function normalizeJoinCode(raw: string | null | undefined): string | null {
  const code = (raw ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (code.length < 4 || code.length > 8) return null;
  return code;
}

export function joinPath(code: string): string {
  return `/join/${encodeURIComponent(code)}`;
}

export type JoinNightState = {
  status: "LOBBY" | "RUNNING" | "FINISHED" | string;
  hasRunningGame: boolean;
  alreadyJoined: boolean;
  isFull: boolean;
};

export type JoinNightDecision =
  | {
      ok: true;
      alreadyJoined: boolean;
      destination: "lobby" | "table" | "results";
    }
  | { ok: false; error: string; status: number };

export function decideJoinNight(state: JoinNightState): JoinNightDecision {
  if (state.alreadyJoined) {
    if (state.status === "FINISHED") {
      return { ok: true, alreadyJoined: true, destination: "results" };
    }
    if (state.hasRunningGame) {
      return { ok: true, alreadyJoined: true, destination: "table" };
    }
    return { ok: true, alreadyJoined: true, destination: "lobby" };
  }

  if (state.status === "FINISHED") {
    return { ok: false, error: "This game night has ended", status: 400 };
  }
  if (state.hasRunningGame) {
    return {
      ok: false,
      error: "A tournament is in progress — join between tournaments",
      status: 400,
    };
  }
  if (state.isFull) {
    return { ok: false, error: "Game night is full", status: 400 };
  }

  return { ok: true, alreadyJoined: false, destination: "lobby" };
}

export function tournamentPath(
  id: string,
  destination: "lobby" | "table" | "results"
): string {
  if (destination === "table") return `/tournament/${id}/table`;
  if (destination === "results") return `/tournament/${id}/results`;
  return `/tournament/${id}`;
}

export type JoinPreview = {
  name: string;
  hostDisplayName: string;
  buyInCents: number;
  status: string;
  joinCode: string;
  playerCount: number;
  maxPlayers: number;
};

/** Public join preview must never include hole cards, emails, or other players' private fields. */
export function publicJoinPreview(opts: {
  name: string;
  hostDisplayName: string;
  buyInCents: number;
  status: string;
  joinCode: string;
  playerCount: number;
  maxPlayers: number;
}): JoinPreview {
  return {
    name: opts.name,
    hostDisplayName: opts.hostDisplayName,
    buyInCents: opts.buyInCents,
    status: opts.status,
    joinCode: opts.joinCode,
    playerCount: opts.playerCount,
    maxPlayers: opts.maxPlayers,
  };
}
