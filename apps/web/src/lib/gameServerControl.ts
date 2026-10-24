import {
  GAME_SERVER_SECRET_HEADER,
  resolveGameServerSecret,
} from "@poker/protocol";

export type GameServerControlHeaders =
  | { ok: true; headers: Record<string, string> }
  | { ok: false; error: string };

/**
 * Headers for game-server start and teardown.
 * Production fails closed when GAME_SERVER_SECRET is unset.
 * Other environments use the shared local fallback.
 */
export function gameServerControlHeaders(): GameServerControlHeaders {
  const secret = resolveGameServerSecret({
    nodeEnv: process.env["NODE_ENV"],
    configured: process.env["GAME_SERVER_SECRET"],
  });
  if (!secret) {
    return { ok: false, error: "GAME_SERVER_SECRET is not set" };
  }
  return {
    ok: true,
    headers: { [GAME_SERVER_SECRET_HEADER]: secret },
  };
}
