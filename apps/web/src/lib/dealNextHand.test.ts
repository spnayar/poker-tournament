import { describe, expect, it } from "vitest";
import {
  canDealNextHand,
  isAwaitingNextHand,
  shouldShowDealNextBar,
} from "./dealNextHand";

describe("dealNextHand gates", () => {
  it("awaits next hand from phase alone (no handResult required)", () => {
    expect(
      isAwaitingNextHand({
        phase: "hand-complete",
        gameFinished: false,
        boardRevealing: false,
      })
    ).toBe(true);
    expect(
      isAwaitingNextHand({
        phase: "hand-complete",
        gameFinished: false,
        boardRevealing: true,
      })
    ).toBe(false);
    expect(
      isAwaitingNextHand({
        phase: "flop",
        gameFinished: false,
        boardRevealing: false,
      })
    ).toBe(false);
  });

  it("lets only the button seat deal when the dealer is available", () => {
    expect(
      canDealNextHand({
        awaitingNextHand: true,
        awaitingFirstDeal: false,
        mySeatId: 0,
        nextDealerSeat: 0,
        isHost: false,
        nextDealerUnavailable: false,
      })
    ).toBe(true);

    // Host who is not the dealer must not get a second live Deal.
    expect(
      canDealNextHand({
        awaitingNextHand: true,
        awaitingFirstDeal: false,
        mySeatId: 0,
        nextDealerSeat: 2,
        isHost: true,
        nextDealerUnavailable: false,
      })
    ).toBe(false);

    expect(
      canDealNextHand({
        awaitingNextHand: true,
        awaitingFirstDeal: false,
        mySeatId: 0,
        nextDealerSeat: 2,
        isHost: false,
        nextDealerUnavailable: false,
      })
    ).toBe(false);
  });

  it("host overrides only when the next dealer is away or missing", () => {
    expect(
      canDealNextHand({
        awaitingNextHand: true,
        awaitingFirstDeal: false,
        mySeatId: 0,
        nextDealerSeat: 2,
        isHost: true,
        nextDealerUnavailable: true,
      })
    ).toBe(true);

    expect(
      canDealNextHand({
        awaitingNextHand: true,
        awaitingFirstDeal: false,
        mySeatId: 0,
        nextDealerSeat: null,
        isHost: true,
        nextDealerUnavailable: false,
      })
    ).toBe(true);

    expect(
      canDealNextHand({
        awaitingNextHand: true,
        awaitingFirstDeal: false,
        mySeatId: 0,
        nextDealerSeat: 2,
        isHost: false,
        nextDealerUnavailable: true,
      })
    ).toBe(false);
  });

  it("does not leave Deal on an away button seat (host-only)", () => {
    // Away dealer who is not host — no Deal (prefer host "deal when ready").
    expect(
      canDealNextHand({
        awaitingNextHand: true,
        awaitingFirstDeal: false,
        mySeatId: 2,
        nextDealerSeat: 2,
        isHost: false,
        nextDealerUnavailable: true,
      })
    ).toBe(false);

    // Away dealer who is also host still gets Deal via host override.
    expect(
      canDealNextHand({
        awaitingNextHand: true,
        awaitingFirstDeal: false,
        mySeatId: 2,
        nextDealerSeat: 2,
        isHost: true,
        nextDealerUnavailable: true,
      })
    ).toBe(true);
  });

  it("shows the deal bar for host when nextDealerSeat is missing", () => {
    expect(
      shouldShowDealNextBar({
        awaitingNextHand: true,
        awaitingFirstDeal: false,
        nextDealerSeat: null,
        isHost: true,
      })
    ).toBe(true);
    expect(
      shouldShowDealNextBar({
        awaitingNextHand: true,
        awaitingFirstDeal: false,
        nextDealerSeat: null,
        isHost: false,
      })
    ).toBe(false);
    expect(
      shouldShowDealNextBar({
        awaitingNextHand: true,
        awaitingFirstDeal: false,
        nextDealerSeat: 1,
        isHost: false,
      })
    ).toBe(true);
  });
});
