import { describe, expect, it } from "vitest";
import {
  DEV_GAME_SERVER_SECRET,
  GAME_SERVER_SECRET_HEADER,
  INSECURE_JWT_SECRET,
  gameServerBootSecretError,
  resolveGameServerSecret,
  resolveJwtSecret,
  secretsEqual,
  webBootSecretError,
} from "./serverSecrets";

describe("resolveGameServerSecret", () => {
  it("uses a local fallback only outside production", () => {
    expect(
      resolveGameServerSecret({ nodeEnv: "development", configured: "" })
    ).toBe(DEV_GAME_SERVER_SECRET);
    expect(
      resolveGameServerSecret({ nodeEnv: "test", configured: undefined })
    ).toBe(DEV_GAME_SERVER_SECRET);
    expect(
      resolveGameServerSecret({ nodeEnv: "production", configured: "  " })
    ).toBeNull();
  });

  it("prefers a configured value in every environment", () => {
    expect(
      resolveGameServerSecret({
        nodeEnv: "production",
        configured: "  from-env  ",
      })
    ).toBe("from-env");
    expect(
      resolveGameServerSecret({
        nodeEnv: "development",
        configured: "from-env",
      })
    ).toBe("from-env");
  });
});

describe("secretsEqual", () => {
  it("matches the shared header value and rejects mismatches", () => {
    expect(GAME_SERVER_SECRET_HEADER).toBe("x-game-server-secret");
    expect(secretsEqual("same-secret", "same-secret")).toBe(true);
    expect(secretsEqual("same-secret", "other-secret")).toBe(false);
    expect(secretsEqual(undefined, "same-secret")).toBe(false);
    expect(secretsEqual("", "same-secret")).toBe(false);
    expect(secretsEqual("same-secret", null)).toBe(false);
    expect(secretsEqual("short", "same-secret")).toBe(false);
  });
});

describe("resolveJwtSecret", () => {
  it("falls back to dev-secret outside production", () => {
    expect(
      resolveJwtSecret({ nodeEnv: "development", jwtSecret: undefined })
    ).toBe(INSECURE_JWT_SECRET);
    expect(
      resolveJwtSecret({ nodeEnv: "test", jwtSecret: "  custom  " })
    ).toBe("custom");
  });

  it("refuses a missing or dev-secret value in production", () => {
    expect(() =>
      resolveJwtSecret({ nodeEnv: "production", jwtSecret: undefined })
    ).toThrow(/dev-secret/);
    expect(() =>
      resolveJwtSecret({ nodeEnv: "production", jwtSecret: "dev-secret" })
    ).toThrow(/dev-secret/);
    expect(
      resolveJwtSecret({ nodeEnv: "production", jwtSecret: "real-secret" })
    ).toBe("real-secret");
  });
});

describe("boot secret errors", () => {
  it("lets non-production boot with nothing set", () => {
    expect(
      webBootSecretError({
        nodeEnv: "development",
        jwtSecret: undefined,
        nextAuthSecret: undefined,
      })
    ).toBeNull();
    expect(
      gameServerBootSecretError({
        nodeEnv: "test",
        jwtSecret: undefined,
        gameServerSecret: undefined,
      })
    ).toBeNull();
  });

  it("requires JWT and NextAuth secrets on the web in production", () => {
    expect(
      webBootSecretError({
        nodeEnv: "production",
        jwtSecret: "",
        nextAuthSecret: "",
      })
    ).toMatch(/JWT_SECRET/);
    expect(
      webBootSecretError({
        nodeEnv: "production",
        jwtSecret: "dev-secret",
        nextAuthSecret: "next-auth",
      })
    ).toMatch(/JWT_SECRET/);
    expect(
      webBootSecretError({
        nodeEnv: "production",
        jwtSecret: "real",
        nextAuthSecret: "  ",
      })
    ).toMatch(/NEXTAUTH_SECRET/);
    expect(
      webBootSecretError({
        nodeEnv: "production",
        jwtSecret: "real",
        nextAuthSecret: "next-auth",
      })
    ).toBeNull();
  });

  it("requires JWT and the game-server secret in production", () => {
    expect(
      gameServerBootSecretError({
        nodeEnv: "production",
        jwtSecret: "real",
        gameServerSecret: "",
      })
    ).toMatch(/GAME_SERVER_SECRET/);
    expect(
      gameServerBootSecretError({
        nodeEnv: "production",
        jwtSecret: "dev-secret",
        gameServerSecret: "shared",
      })
    ).toMatch(/JWT_SECRET/);
    expect(
      gameServerBootSecretError({
        nodeEnv: "production",
        jwtSecret: "real",
        gameServerSecret: "shared",
      })
    ).toBeNull();
  });
});
