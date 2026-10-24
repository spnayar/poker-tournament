import { timingSafeEqual } from "node:crypto";

/** Header the web app sends on game-server start and teardown. */
export const GAME_SERVER_SECRET_HEADER = "x-game-server-secret";

/** Local-only fallback. Never accepted when NODE_ENV is production. */
export const DEV_GAME_SERVER_SECRET = "dev-game-server-secret";

/** Hard-coded signing key. Production must not boot with this value. */
export const INSECURE_JWT_SECRET = "dev-secret";

export function resolveGameServerSecret(input: {
  nodeEnv: string | undefined;
  configured: string | undefined;
}): string | null {
  const configured = input.configured?.trim() ?? "";
  if (configured) return configured;
  if (input.nodeEnv === "production") return null;
  return DEV_GAME_SERVER_SECRET;
}

export function resolveJwtSecret(input: {
  nodeEnv: string | undefined;
  jwtSecret: string | undefined;
}): string {
  const jwt = input.jwtSecret?.trim() ?? "";
  if (input.nodeEnv === "production") {
    if (!jwt || jwt === INSECURE_JWT_SECRET) {
      throw new Error(
        "JWT_SECRET must be set to a value other than dev-secret"
      );
    }
    return jwt;
  }
  return jwt || INSECURE_JWT_SECRET;
}

/** Constant-time match. Missing or different-length values do not match. */
export function secretsEqual(
  provided: string | undefined | null,
  expected: string | null
): boolean {
  if (!expected || provided == null || provided === "") return false;
  const left = Buffer.from(provided);
  const right = Buffer.from(expected);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/** Why the web process must refuse to boot, or null when it may start. */
export function webBootSecretError(input: {
  nodeEnv: string | undefined;
  jwtSecret: string | undefined;
  nextAuthSecret: string | undefined;
}): string | null {
  if (input.nodeEnv !== "production") return null;
  const problems: string[] = [];
  const jwt = input.jwtSecret?.trim() ?? "";
  if (!jwt || jwt === INSECURE_JWT_SECRET) {
    problems.push("JWT_SECRET must be set to a value other than dev-secret");
  }
  if (!input.nextAuthSecret?.trim()) {
    problems.push("NEXTAUTH_SECRET must be set");
  }
  return problems.length ? problems.join("; ") : null;
}

/** Why the game server must refuse to boot, or null when it may start. */
export function gameServerBootSecretError(input: {
  nodeEnv: string | undefined;
  jwtSecret: string | undefined;
  gameServerSecret: string | undefined;
}): string | null {
  if (input.nodeEnv !== "production") return null;
  const problems: string[] = [];
  const jwt = input.jwtSecret?.trim() ?? "";
  if (!jwt || jwt === INSECURE_JWT_SECRET) {
    problems.push("JWT_SECRET must be set to a value other than dev-secret");
  }
  if (!input.gameServerSecret?.trim()) {
    problems.push("GAME_SERVER_SECRET must be set");
  }
  return problems.length ? problems.join("; ") : null;
}
