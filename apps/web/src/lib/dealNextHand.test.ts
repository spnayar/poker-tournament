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

  it("lets the button seat or host deal when others are away", () => {
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

    // Host may deal even when next dealer looks "available" but is stuck away
    // in a way the client didn't flag — never soft-lock the table.
    expect(
      canDealNextHand({
        awaitingNextHand: true,
        awaitingFirstDeal: false,
        mySeatId: 0,
        nextDealerSeat: 2,
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
