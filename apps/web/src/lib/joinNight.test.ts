import { describe, it, expect } from "vitest";
import {
  decideJoinNight,
  joinPath,
  normalizeJoinCode,
  publicJoinPreview,
  tournamentPath,
} from "./joinNight";

describe("normalizeJoinCode", () => {
  it("uppercases and strips junk", () => {
    expect(normalizeJoinCode(" xk7m ")).toBe("XK7M");
    expect(normalizeJoinCode("xk-7m")).toBe("XK7M");
  });

  it("rejects short or empty codes", () => {
    expect(normalizeJoinCode("")).toBeNull();
    expect(normalizeJoinCode("AB")).toBeNull();
    expect(normalizeJoinCode(null)).toBeNull();
  });
});

describe("joinPath", () => {
  it("builds a relative join landing URL", () => {
    expect(joinPath("XK7M")).toBe("/join/XK7M");
  });
});

describe("decideJoinNight", () => {
  it("sends existing members to the table even while a game is running", () => {
    expect(
      decideJoinNight({
        status: "RUNNING",
        hasRunningGame: true,
        alreadyJoined: true,
        isFull: true,
      })
    ).toEqual({ ok: true, alreadyJoined: true, destination: "table" });
  });

  it("blocks new players while a game is running", () => {
    expect(
      decideJoinNight({
        status: "RUNNING",
        hasRunningGame: true,
        alreadyJoined: false,
        isFull: false,
      })
    ).toMatchObject({ ok: false, status: 400 });
  });

  it("lets new players join a lobby", () => {
    expect(
      decideJoinNight({
        status: "LOBBY",
        hasRunningGame: false,
        alreadyJoined: false,
        isFull: false,
      })
    ).toEqual({ ok: true, alreadyJoined: false, destination: "lobby" });
  });

  it("sends members of a closed night to results", () => {
    expect(
      decideJoinNight({
        status: "FINISHED",
        hasRunningGame: false,
        alreadyJoined: true,
        isFull: false,
      })
    ).toEqual({ ok: true, alreadyJoined: true, destination: "results" });
  });
});

describe("tournamentPath", () => {
  it("maps destination to the lobby, table, or results route", () => {
    expect(tournamentPath("abc", "lobby")).toBe("/tournament/abc");
    expect(tournamentPath("abc", "table")).toBe("/tournament/abc/table");
    expect(tournamentPath("abc", "results")).toBe("/tournament/abc/results");
  });
});

describe("publicJoinPreview", () => {
  it("does not include player emails, hole cards, or a roster", () => {
    const preview = publicJoinPreview({
      name: "Friday Night",
      hostDisplayName: "Sanjay",
      buyInCents: 2000,
      status: "LOBBY",
      joinCode: "XK7M",
      playerCount: 3,
      maxPlayers: 9,
    });
    expect(preview).toEqual({
      name: "Friday Night",
      hostDisplayName: "Sanjay",
      buyInCents: 2000,
      status: "LOBBY",
      joinCode: "XK7M",
      playerCount: 3,
      maxPlayers: 9,
    });
    expect(JSON.stringify(preview)).not.toMatch(/hole|cards|email/i);
  });
});
