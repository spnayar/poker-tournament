import { describe, it, expect } from "vitest";
import { SeatPublicSchema, shouldResumeOnReconnect } from "./index";

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
