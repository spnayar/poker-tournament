import { describe, it, expect } from "vitest";
import {
  SeatPublicSchema,
  applySocketAwayFlags,
  awayDisplayNames,
  formatActorWaitingLabel,
  formatAwayBanner,
  hostSeatControl,
  shouldResumeOnReconnect,
} from "./index";

describe("shouldResumeOnReconnect", () => {
  it("resumes disconnect and timeout sits, but not host sits", () => {
    expect(shouldResumeOnReconnect("disconnect")).toBe(true);
    expect(shouldResumeOnReconnect("timeout")).toBe(true);
    expect(shouldResumeOnReconnect(null)).toBe(true);
    expect(shouldResumeOnReconnect(undefined)).toBe(true);
    expect(shouldResumeOnReconnect("host")).toBe(false);
  });
});

describe("SeatPublic away fields", () => {
  it("defaults away and skipReason when omitted", () => {
    const seat = SeatPublicSchema.parse({
      seatId: 0,
      userId: "u1",
      displayName: "Alice",
      avatarUrl: null,
      chipCount: 1000,
      betThisRound: 0,
      totalBet: 0,
      folded: false,
      allIn: false,
      skipped: true,
      isDealer: false,
      isSmallBlind: false,
      isBigBlind: true,
      lastAction: null,
    });
    expect(seat.away).toBe(false);
    expect(seat.skipReason).toBeNull();
  });
});

describe("applySocketAwayFlags", () => {
  const seats = [
    { userId: "host", displayName: "Host Bot", seatId: 0 },
    { userId: "guest", displayName: "Guest Bot", seatId: 1 },
    { userId: "big", displayName: "Guest Big", seatId: 2 },
  ];

  it("marks only the disconnected user away, not the current actor", () => {
    const flagged = applySocketAwayFlags(
      seats,
      ["host", "guest", "big"],
      ["host", "big"]
    );
    expect(flagged.find((s) => s.userId === "guest")!.away).toBe(true);
    expect(flagged.find((s) => s.userId === "big")!.away).toBe(false);
    expect(flagged.find((s) => s.userId === "host")!.away).toBe(false);
    expect(awayDisplayNames(flagged)).toEqual(["Guest Bot"]);
    expect(formatAwayBanner(awayDisplayNames(flagged))).toBe(
      "Guest Bot is away…"
    );
  });

  it("does not mark seats away until they have joined once", () => {
    const flagged = applySocketAwayFlags(seats, ["host"], ["host"]);
    expect(flagged.filter((s) => s.away).map((s) => s.userId)).toEqual([]);
  });
});

describe("formatActorWaitingLabel", () => {
  it("names the live actor without calling them away", () => {
    expect(
      formatActorWaitingLabel({
        isViewerActor: false,
        actorName: "Guest Big",
        actorAway: false,
      })
    ).toBe("Waiting for Guest Big…");
  });

  it("says is away only when that actor's socket is gone", () => {
    expect(
      formatActorWaitingLabel({
        isViewerActor: false,
        actorName: "Guest Big",
        actorAway: true,
      })
    ).toBe("Guest Big is away…");
  });
});

describe("hostSeatControl", () => {
  it("offers Unskip for disconnect sits, not Skip", () => {
    expect(hostSeatControl({ skipped: true })).toBe("unskip");
    expect(hostSeatControl({ skipped: false })).toBe("skip");
  });
});
