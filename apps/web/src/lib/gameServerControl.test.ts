import { afterEach, describe, expect, it, vi } from "vitest";
import { DEV_GAME_SERVER_SECRET } from "@poker/protocol";
import { gameServerControlHeaders } from "./gameServerControl";

describe("gameServerControlHeaders", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("fails the call in production when the secret is unset", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("GAME_SERVER_SECRET", "");
    expect(gameServerControlHeaders()).toEqual({
      ok: false,
      error: "GAME_SERVER_SECRET is not set",
    });
  });

  it("sends the shared secret header when it is set", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("GAME_SERVER_SECRET", "shared-value");
    expect(gameServerControlHeaders()).toEqual({
      ok: true,
      headers: { "x-game-server-secret": "shared-value" },
    });
  });

  it("uses the local fallback outside production", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("GAME_SERVER_SECRET", "");
    expect(gameServerControlHeaders()).toEqual({
      ok: true,
      headers: { "x-game-server-secret": DEV_GAME_SERVER_SECRET },
    });
  });
});
