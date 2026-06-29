import { describe, it, expect, vi } from "vitest";
import { buildBlindLevels } from "@poker/protocol";
import { TableEngine } from "./table";

function testTableConfig(startingChips = 5000) {
  return {
    tournamentId: "test",
    startingChips,
    blindLevels: buildBlindLevels(startingChips, "turbo"),
  };
}

describe("TableEngine", () => {
  function createThreePlayerTable() {
    const table = new TableEngine(testTableConfig());
    table.addPlayer(0, "u1", "Alice", null, 1000);
    table.addPlayer(1, "u2", "Bob", null, 500);
    table.addPlayer(2, "u3", "Carol", null, 1000);
    return table;
  }

  it("deals hole cards only accessible per seat", () => {
    const table = createThreePlayerTable();
    table.startHand();

    const aliceCards = table.getHoleCards(0);
    const bobCards = table.getHoleCards(1);

    expect(aliceCards).toHaveLength(2);
    expect(bobCards).toHaveLength(2);
    expect(aliceCards).not.toEqual(bobCards);
  });

  it("public state never includes hole cards", () => {
    const table = createThreePlayerTable();
    table.startHand();
    const state = table.getPublicState();
    const json = JSON.stringify(state);
    expect(json).not.toMatch(/"[2-9TJQKA][cdhs]"/);
  });

  it("assigns action when only one player can still bet preflop", () => {
    const table = new TableEngine(testTableConfig());
    table.addPlayer(0, "u1", "Alice", null, 100);
    table.addPlayer(1, "u2", "Bob", null, 1000);
    table.startHand();

    const state = table.getPublicState();
    expect(state.phase).toBe("preflop");
    expect(state.currentActorSeat).not.toBeNull();
  });

  it("computes side pots after short all-in", () => {
    const table = new TableEngine(testTableConfig());
    table.addPlayer(0, "u1", "Alice", null, 1200);
    table.addPlayer(1, "u2", "Bob", null, 500);
    table.addPlayer(2, "u3", "Carol", null, 1200);
    table.startHand();

    const pots = table.getPublicState().pots;
    expect(pots.length).toBeGreaterThanOrEqual(1);
  });

  it("HU short stack all-in from blind proceeds to showdown, not fold win", () => {
    const table = new TableEngine(testTableConfig());
    table.addPlayer(0, "u1", "Short", null, 25);
    table.addPlayer(1, "u2", "Big", null, 1000);
    table.startHand();

    expect(table.getPublicState().currentActorSeat).toBe(1);
    const ok = table.applyAction(1, { type: "call" });
    expect(ok).toBe(true);

    const state = table.getPublicState();
    expect(state.phase).toBe("hand-complete");

    const events = table.drainEvents();
    const handResult = events.find((e) => e.type === "handResult");
    expect(handResult).toBeDefined();
    const result = handResult!.payload as import("@poker/protocol").HandResult;
    expect(result.winners[0]!.wonByFold).toBe(false);
    expect(table.getPublicState().board.length).toBe(5);

    const log = table.getPublicState().actionLog;
    const flop = log.find((e) => e.seatId === -2 && e.street === "flop");
    const turn = log.find((e) => e.seatId === -2 && e.street === "turn");
    const river = log.find((e) => e.seatId === -2 && e.street === "river");
    expect(flop?.cards).toHaveLength(3);
    expect(turn?.cards).toHaveLength(1);
    expect(river?.cards).toHaveLength(1);
  });

  it("retains action log entries across multiple hands", () => {
    const table = new TableEngine(testTableConfig());
    table.addPlayer(0, "u1", "Alice", null, 1000);
    table.addPlayer(1, "u2", "Bob", null, 1000);
    table.startHand();

    const actor1 = table.getPublicState().currentActorSeat!;
    table.applyAction(actor1, { type: "fold" });
    expect(table.getPublicState().phase).toBe("hand-complete");

    table.startHand();
    const log = table.getPublicState().actionLog;
    const handHeaders = log.filter((e) => e.seatId < 0);
    expect(handHeaders).toHaveLength(2);
    expect(handHeaders[0]!.action).toBe("Hand #1");
    expect(handHeaders[1]!.action).toBe("Hand #2");
    expect(log.some((e) => e.action === "Fold" && e.handNumber === 1)).toBe(true);
    expect(log.some((e) => e.action.startsWith("SB") && e.handNumber === 2)).toBe(
      true
    );
  });

  it("HU opponent gets action after all-in raise preflop", () => {
    const table = new TableEngine(testTableConfig());
    table.addPlayer(0, "u1", "Alice", null, 1000);
    table.addPlayer(1, "u2", "Bob", null, 500);
    table.startHand();

    const firstActor = table.getPublicState().currentActorSeat!;
    expect(table.applyAction(firstActor, { type: "all-in" })).toBe(true);

    const state = table.getPublicState();
    expect(state.phase).toBe("preflop");
    expect(state.board).toHaveLength(0);

    const callerSeat = state.seats.find(
      (s) => s.seatId !== firstActor && !s.folded
    )!.seatId;
    expect(state.currentActorSeat).toBe(callerSeat);

    const legal = table.getLegalActions(callerSeat);
    expect(legal).not.toBeNull();
    expect(legal!.canCall).toBe(true);
    expect(legal!.canFold).toBe(true);
  });

  it("HU opponent gets action after all-in on flop", () => {
    const table = new TableEngine(testTableConfig());
    table.addPlayer(0, "u1", "Alice", null, 1000);
    table.addPlayer(1, "u2", "Bob", null, 500);
    table.startHand();

    let actor = table.getPublicState().currentActorSeat!;
    table.applyAction(actor, { type: "call" });
    actor = table.getPublicState().currentActorSeat!;
    table.applyAction(actor, { type: "check" });

    expect(table.getPublicState().phase).toBe("flop");
    expect(table.getPublicState().board).toHaveLength(3);

    actor = table.getPublicState().currentActorSeat!;
    table.applyAction(actor, { type: "all-in" });

    const state = table.getPublicState();
    expect(state.phase).toBe("flop");
    expect(state.board).toHaveLength(3);

    const callerSeat = state.seats.find(
      (s) => s.seatId !== actor && !s.folded && !s.allIn
    )!.seatId;
    expect(state.currentActorSeat).toBe(callerSeat);
    expect(table.getLegalActions(callerSeat)?.canCall).toBe(true);
  });

  it("three-way: players behind get action after middle all-in", () => {
    const table = new TableEngine(testTableConfig());
    table.addPlayer(0, "u1", "Alice", null, 1000);
    table.addPlayer(1, "u2", "Bob", null, 500);
    table.addPlayer(2, "u3", "Carol", null, 1000);
    table.startHand();

    const state0 = table.getPublicState();
    const utg = state0.currentActorSeat!;
    expect(table.applyAction(utg, { type: "all-in" })).toBe(true);

    const state = table.getPublicState();
    expect(state.phase).toBe("preflop");
    expect(state.board).toHaveLength(0);
    expect(state.currentActorSeat).not.toBeNull();
    expect(state.currentActorSeat).not.toBe(utg);

    const nextActor = state.currentActorSeat!;
    const legal = table.getLegalActions(nextActor);
    expect(legal).not.toBeNull();
    expect(legal!.canFold).toBe(true);
    expect(legal!.canCall || legal!.canRaise).toBe(true);
  });

  it("raiser gets action after opponent all-in re-raise", () => {
    const table = new TableEngine(testTableConfig());
    table.addPlayer(0, "u1", "Alice", null, 1000);
    table.addPlayer(1, "u2", "Bob", null, 500);
    table.startHand();
    table.applyAction(table.getPublicState().currentActorSeat!, { type: "fold" });
    table.startHand();

    const aliceSeat = 0;
    expect(table.getPublicState().currentActorSeat).toBe(aliceSeat);
    table.applyAction(aliceSeat, { type: "raise", amount: 100 });

    const bobSeat = 1;
    expect(table.getPublicState().currentActorSeat).toBe(bobSeat);
    table.applyAction(bobSeat, { type: "all-in" });

    const state = table.getPublicState();
    expect(state.phase).toBe("preflop");
    expect(state.board).toHaveLength(0);
    expect(state.currentActorSeat).toBe(aliceSeat);
    expect(table.getLegalActions(aliceSeat)?.canCall).toBe(true);
  });

  it("BB preflop raise uses minRaiseTo total, not increment", () => {
    const table = new TableEngine(testTableConfig());
    table.addPlayer(0, "u1", "Alice", null, 1000);
    table.addPlayer(1, "u2", "Bob", null, 1000);
    table.startHand();

    const state0 = table.getPublicState();
    const sbSeat = state0.seats.find((s) => s.isSmallBlind)!.seatId;
    const bbSeat = state0.seats.find((s) => s.isBigBlind)!.seatId;

    expect(table.applyAction(sbSeat, { type: "call" })).toBe(true);
    expect(table.getPublicState().currentActorSeat).toBe(bbSeat);

    const legal = table.getLegalActions(bbSeat);
    expect(legal).not.toBeNull();
    expect(legal!.canRaise).toBe(true);
    expect(legal!.minRaiseTo).toBe(100);
    expect(legal!.minRaise).toBe(50);
  });

  it("BB preflop raise rejects amount below minRaiseTo", () => {
    const table = new TableEngine(testTableConfig());
    table.addPlayer(0, "u1", "Alice", null, 1000);
    table.addPlayer(1, "u2", "Bob", null, 1000);
    table.startHand();

    const state0 = table.getPublicState();
    const sbSeat = state0.seats.find((s) => s.isSmallBlind)!.seatId;
    const bbSeat = state0.seats.find((s) => s.isBigBlind)!.seatId;

    expect(table.applyAction(sbSeat, { type: "call" })).toBe(true);
    expect(table.getPublicState().currentActorSeat).toBe(bbSeat);

    expect(table.applyAction(bbSeat, { type: "raise", amount: 50 })).toBe(
      false
    );
    expect(table.applyAction(bbSeat, { type: "raise", amount: 100 })).toBe(
      true
    );
  });

  it("SB call then BB raise reopens action for SB", () => {
    const table = new TableEngine(testTableConfig());
    table.addPlayer(0, "u1", "Alice", null, 1000);
    table.addPlayer(1, "u2", "Bob", null, 1000);
    table.startHand();

    const state0 = table.getPublicState();
    const sbSeat = state0.seats.find((s) => s.isSmallBlind)!.seatId;
    const bbSeat = state0.seats.find((s) => s.isBigBlind)!.seatId;

    expect(state0.currentActorSeat).toBe(sbSeat);
    expect(table.applyAction(sbSeat, { type: "call" })).toBe(true);

    expect(table.getPublicState().currentActorSeat).toBe(bbSeat);
    expect(table.applyAction(bbSeat, { type: "raise", amount: 100 })).toBe(
      true
    );

    const state = table.getPublicState();
    expect(state.phase).toBe("preflop");
    expect(state.currentActorSeat).toBe(sbSeat);
    expect(table.getLegalActions(sbSeat)?.canCall).toBe(true);
    expect(table.getLegalActions(bbSeat)).toBeNull();
  });

  it("short all-in re-raise reopens action for opponent", () => {
    const table = new TableEngine(testTableConfig());
    table.addPlayer(0, "u1", "Alice", null, 1000);
    table.addPlayer(1, "u2", "Bob", null, 105);
    table.startHand();

    const bobSeat = table.getPublicState().currentActorSeat!;
    table.applyAction(bobSeat, { type: "all-in" });

    const aliceSeat = 0;
    const state = table.getPublicState();
    expect(state.phase).toBe("preflop");
    expect(state.board).toHaveLength(0);
    expect(state.currentActorSeat).toBe(aliceSeat);
    expect(table.getLegalActions(aliceSeat)?.canCall).toBe(true);
  });

  it("rotates dealer and blinds clockwise each hand", () => {
    const table = new TableEngine(testTableConfig());
    table.addPlayer(0, "u1", "Alice", null, 1000);
    table.addPlayer(1, "u2", "Bob", null, 1000);
    table.addPlayer(2, "u3", "Carol", null, 1000);
    table.addPlayer(3, "u4", "Dave", null, 1000);

    const roles: { dealer: number; sb: number; bb: number }[] = [];

    for (let h = 0; h < 4; h++) {
      table.startHand();
      const state = table.getPublicState();
      const sb = state.seats.find((s) => s.isSmallBlind)!;
      const bb = state.seats.find((s) => s.isBigBlind)!;
      roles.push({
        dealer: state.dealerSeat,
        sb: sb.seatId,
        bb: bb.seatId,
      });

      while (table.getPublicState().phase !== "hand-complete") {
        const actor = table.getPublicState().currentActorSeat;
        if (actor === null) break;
        table.applyAction(actor, { type: "fold" });
      }
    }

    expect(roles[0]).toEqual({ dealer: 1, sb: 2, bb: 3 });
    expect(roles[1]).toEqual({ dealer: 2, sb: 3, bb: 0 });
    expect(roles[2]).toEqual({ dealer: 3, sb: 0, bb: 1 });
    expect(roles[3]).toEqual({ dealer: 0, sb: 1, bb: 2 });
    expect(new Set(roles.map((r) => r.dealer)).size).toBe(4);
  });

  it("keeps blind badges on posted seats after a fold", () => {
    const table = new TableEngine(testTableConfig());
    table.addPlayer(0, "u1", "Alice", null, 1000);
    table.addPlayer(1, "u2", "Bob", null, 1000);
    table.addPlayer(2, "u3", "Carol", null, 1000);

    table.startHand();
    const prefold = table.getPublicState();
    const bbSeat = prefold.seats.find((s) => s.isBigBlind)!.seatId;

    table.applyAction(prefold.currentActorSeat!, { type: "fold" });

    const midHand = table.getPublicState();
    expect(midHand.phase).not.toBe("hand-complete");
    expect(midHand.seats.find((s) => s.seatId === bbSeat)?.isBigBlind).toBe(
      true
    );
  });

  it("randomizeDealerButton picks an active seat and first hand keeps it", () => {
    const table = new TableEngine(testTableConfig());
    table.addPlayer(0, "u1", "Alice", null, 1000);
    table.addPlayer(1, "u2", "Bob", null, 1000);
    table.addPlayer(2, "u3", "Carol", null, 1000);

    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.6);
    table.randomizeDealerButton();
    expect(table.getPublicState().dealerSeat).toBe(1);

    table.startHand();
    expect(table.getPublicState().dealerSeat).toBe(1);
    randomSpy.mockRestore();
  });

  it("applyScheduledBlindIncrease advances blinds between hands", () => {
    const table = new TableEngine(testTableConfig());
    table.addPlayer(0, "u1", "Alice", null, 1000);
    table.addPlayer(1, "u2", "Bob", null, 1000);

    table.startHand();
    const level1 = table.getPublicState();
    table.applyScheduledBlindIncrease();
    const level2 = table.getPublicState();

    expect(level2.blindLevel).toBe(level1.blindLevel + 1);
    expect(level2.bigBlind).toBeGreaterThan(level1.bigBlind);
  });

  it("action after middle raise goes to player after raiser", () => {
    const table = new TableEngine(testTableConfig());
    table.addPlayer(0, "u1", "Alice", null, 1000);
    table.addPlayer(1, "u2", "Bob", null, 1000);
    table.addPlayer(2, "u3", "Carol", null, 1000);

    table.startHand();
    table.applyAction(table.getPublicState().currentActorSeat!, { type: "fold" });
    table.startHand();
    table.applyAction(table.getPublicState().currentActorSeat!, { type: "fold" });
    table.startHand();

    expect(table.getPublicState().dealerSeat).toBe(0);
    expect(table.getPublicState().currentActorSeat).toBe(0);
    table.applyAction(0, { type: "call" });
    expect(table.getPublicState().currentActorSeat).toBe(1);
    table.applyAction(1, { type: "raise", amount: 100 });
    expect(table.getPublicState().currentActorSeat).toBe(2);
  });

  it("showdown: better hand wins after opponent calls all-in", () => {
    const table = new TableEngine(testTableConfig());
    table.addPlayer(0, "u2", "Bob", null, 500);
    table.addPlayer(1, "u1", "Alice", null, 1000);
    table.startHand();
    table.applyAction(table.getPublicState().currentActorSeat!, { type: "fold" });
    table.startHand();

    const snap = table.toSnapshot();
    const bob = snap.players.find((p) => p.seatId === 0)!;
    const alice = snap.players.find((p) => p.seatId === 1)!;
    bob.holeCards = ["Ad", "Ah"];
    alice.holeCards = ["Kd", "Kh"];
    snap.deck = ["2c", "3d", "7h", "8s", "9c", "4h", "5h", "6h", "Jc", "Qc"];

    const rigged = TableEngine.fromSnapshot(snap);
    const bobSeat = 0;
    expect(rigged.getPublicState().currentActorSeat).toBe(bobSeat);
    expect(rigged.applyAction(bobSeat, { type: "all-in" })).toBe(true);
    expect(rigged.getPublicState().currentActorSeat).toBe(1);
    expect(rigged.getLegalActions(1)?.canCall).toBe(true);

    expect(rigged.applyAction(1, { type: "call" })).toBe(true);

    const events = rigged.drainEvents();
    const handResult = events.find((e) => e.type === "handResult");
    expect(handResult).toBeDefined();
    const result = handResult!.payload as import("@poker/protocol").HandResult;
    expect(result.winners[0]!.seatId).toBe(bobSeat);
    expect(result.winners[0]!.wonByFold).toBe(false);
    expect(result.winners[0]!.handName).toContain("Pair");
    expect(result.shownCards).toHaveLength(2);
    const bobShown = result.shownCards.find((s) => s.seatId === bobSeat);
    expect(bobShown?.holeCards).toEqual(["Ad", "Ah"]);
    expect(bobShown?.bestHand.length).toBe(5);

    const finalState = rigged.getPublicState();
    expect(finalState.phase).toBe("hand-complete");
    expect(finalState.seats).toHaveLength(2);
    expect(finalState.seats.some((s) => s.seatId === 1)).toBe(true);
  });

  it("all-in with zero chips does not end tournament before opponent acts", () => {
    const table = new TableEngine(testTableConfig());
    table.addPlayer(0, "u1", "Alice", null, 6190);
    table.addPlayer(1, "u2", "Bob", null, 3061);
    table.startHand();

    let actor = table.getPublicState().currentActorSeat!;
    table.applyAction(actor, { type: "call" });
    actor = table.getPublicState().currentActorSeat!;
    table.applyAction(actor, { type: "check" });

    actor = table.getPublicState().currentActorSeat!;
    table.applyAction(actor, { type: "bet", amount: 849 });
    actor = table.getPublicState().currentActorSeat!;
    table.applyAction(actor, { type: "call" });

    expect(table.getPublicState().phase).toBe("turn");
    const bobSeat = table
      .getPublicState()
      .seats.find((s) => s.displayName === "Bob")!.seatId;
    const aliceSeat = table
      .getPublicState()
      .seats.find((s) => s.displayName === "Alice")!.seatId;

    let turnActor = table.getPublicState().currentActorSeat!;
    if (turnActor !== bobSeat) {
      table.applyAction(turnActor, { type: "check" });
    }
    expect(table.getPublicState().currentActorSeat).toBe(bobSeat);
    table.applyAction(bobSeat, { type: "all-in" });

    const state = table.getPublicState();
    expect(state.phase).toBe("turn");
    expect(table.getActivePlayerCount()).toBe(2);
    expect(table.isTournamentComplete()).toBe(false);

    expect(state.currentActorSeat).toBe(aliceSeat);
    expect(table.getLegalActions(aliceSeat)?.canCall).toBe(true);
    expect(table.getLegalActions(aliceSeat)?.canFold).toBe(true);

    const events = table.drainEvents();
    expect(events.some((e) => e.type === "handResult")).toBe(false);
  });

  it("tournament completes only after busted player is eliminated post-hand", () => {
    const table = new TableEngine(testTableConfig());
    table.addPlayer(0, "u1", "Alice", null, 2000);
    table.addPlayer(1, "u2", "Bob", null, 500);
    table.startHand();

    const bobSeat = table.getPublicState().currentActorSeat!;
    table.applyAction(bobSeat, { type: "all-in" });

    expect(table.isTournamentComplete()).toBe(false);

    const aliceSeat = table.getPublicState().currentActorSeat!;
    table.applyAction(aliceSeat, { type: "call" });

    expect(table.getPublicState().phase).toBe("hand-complete");
    const snap = table.toSnapshot();
    const bob = snap.players.find((p) => p.seatId === bobSeat)!;
    if (bob.chips === 0) {
      expect(bob.eliminated).toBe(true);
      expect(table.isTournamentComplete()).toBe(true);
    } else {
      expect(table.getActivePlayerCount()).toBe(2);
    }
  });

  it("facing sole all-in opponent: call or fold only", () => {
    const table = new TableEngine(testTableConfig());
    table.addPlayer(0, "u1", "Alice", null, 10000);
    table.addPlayer(1, "u2", "Bob", null, 250);
    table.startHand();

    const bobSeat = table.getPublicState().currentActorSeat!;
    expect(table.applyAction(bobSeat, { type: "all-in" })).toBe(true);

    const aliceSeat = table.getPublicState().currentActorSeat!;
    const legal = table.getLegalActions(aliceSeat);
    expect(legal).not.toBeNull();
    expect(legal!.canCall).toBe(true);
    expect(legal!.canFold).toBe(true);
    expect(legal!.canRaise).toBe(false);
    expect(legal!.canBet).toBe(false);
    expect(legal!.minRaiseTo).toBe(0);
  });

  it("no hand result emitted before opponent responds to all-in", () => {
    const table = new TableEngine(testTableConfig());
    table.addPlayer(0, "u1", "Alice", null, 1000);
    table.addPlayer(1, "u2", "Bob", null, 1000);
    table.startHand();

    const sb = table.getPublicState().seats.find((s) => s.isSmallBlind)!.seatId;
    const bb = table.getPublicState().seats.find((s) => s.isBigBlind)!.seatId;
    table.applyAction(sb, { type: "call" });
    table.applyAction(bb, { type: "all-in" });

    const state = table.getPublicState();
    expect(state.phase).toBe("preflop");
    expect(state.currentActorSeat).toBe(sb);
    expect(state.phase).not.toBe("hand-complete");

    const events = table.drainEvents();
    expect(events.some((e) => e.type === "handResult")).toBe(false);
    expect(table.getLegalActions(sb)?.canCall).toBe(true);
    expect(table.getLegalActions(sb)?.canFold).toBe(true);
  });

  it("returns uncalled all-in excess when opponent folds", () => {
    const table = new TableEngine(testTableConfig());
    table.addPlayer(0, "u1", "Alice", null, 10000);
    table.addPlayer(1, "u2", "Bob", null, 250);
    table.startHand();

    const bobSeat = table.getPublicState().currentActorSeat!;
    expect(table.applyAction(bobSeat, { type: "all-in" })).toBe(true);

    const aliceSeat = table.getPublicState().currentActorSeat!;
    expect(table.applyAction(aliceSeat, { type: "fold" })).toBe(true);

    expect(table.getPublicState().phase).toBe("hand-complete");

    const bob = table.toSnapshot().players.find((p) => p.seatId === bobSeat)!;
    const alice = table.toSnapshot().players.find((p) => p.seatId === aliceSeat)!;
    // Bob started 250: matched 50 vs Alice BB, won contested pot of 100 (+50 net).
    expect(bob.chips).toBe(300);
    expect(alice.chips).toBe(9950);

    const events = table.drainEvents();
    const handResult = events.find((e) => e.type === "handResult");
    expect(handResult).toBeDefined();
    const result = handResult!.payload as import("@poker/protocol").HandResult;
    expect(result.totalAwarded).toBe(100);
    expect(result.winners).toHaveLength(1);
    expect(result.winners[0]!.seatId).toBe(bobSeat);
    expect(result.winners[0]!.amount).toBe(100);
    expect(result.winners[0]!.wonByFold).toBe(true);
  });

  it("fold awards pot with wonByFold true", () => {
    const table = new TableEngine(testTableConfig());
    table.addPlayer(0, "u1", "Alice", null, 1000);
    table.addPlayer(1, "u2", "Bob", null, 1000);
    table.startHand();

    const actor = table.getPublicState().currentActorSeat!;
    table.applyAction(actor, { type: "fold" });

    const events = table.drainEvents();
    const handResult = events.find((e) => e.type === "handResult");
    expect(handResult).toBeDefined();
    const result = handResult!.payload as import("@poker/protocol").HandResult;
    expect(result.winners[0]!.wonByFold).toBe(true);
  });
});
