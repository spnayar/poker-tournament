import { describe, it, expect, vi } from "vitest";
import { buildBlindLevels } from "@poker/protocol";
import { TableEngine } from "./table";
import { compareFiveCardHands, emptyTableFunStats } from "./funStats";

function testConfig() {
  return {
    tournamentId: "fun-stats",
    startingChips: 1000,
    blindLevels: buildBlindLevels(1000, "turbo"),
  };
}

describe("compareFiveCardHands", () => {
  it("ranks quads over full house", () => {
    const quads: import("@poker/protocol").Card[] = [
      "As",
      "Ah",
      "Ad",
      "Ac",
      "Kh",
    ];
    const boat: import("@poker/protocol").Card[] = [
      "Ks",
      "Kh",
      "Kd",
      "Qc",
      "Qh",
    ];
    expect(compareFiveCardHands(quads, boat)).toBeGreaterThan(0);
    expect(compareFiveCardHands(boat, quads)).toBeLessThan(0);
  });

  it("ties identical ranks", () => {
    const a: import("@poker/protocol").Card[] = [
      "As",
      "Ah",
      "Kd",
      "Kc",
      "2h",
    ];
    const b: import("@poker/protocol").Card[] = [
      "Ad",
      "Ac",
      "Kh",
      "Ks",
      "2c",
    ];
    expect(compareFiveCardHands(a, b)).toBe(0);
  });
});

describe("TableEngine fun stats", () => {
  it("counts fold-win hands and largest pot", () => {
    const table = new TableEngine(testConfig());
    table.addPlayer(0, "u1", "Alice", null, 1000);
    table.addPlayer(1, "u2", "Bob", null, 1000);
    table.startHand();
    const sb = table.getPublicState().seats.find((s) => s.isSmallBlind)!.seatId;
    const bb = table.getPublicState().seats.find((s) => s.isBigBlind)!.seatId;
    expect(table.applyAction(sb, { type: "fold" })).toBe(true);

    const stats = table.getFunStats();
    expect(stats.handsWonBySeat[bb]).toBe(1);
    expect(stats.handsWonBySeat[sb] ?? 0).toBe(0);
    expect(stats.largestPot?.amountChips).toBeGreaterThan(0);
    expect(stats.largestPot?.winnerSeatIds).toEqual([bb]);
    expect(stats.bestHand).toBeNull();
  });

  it("tracks best showdown hand", () => {
    const table = new TableEngine(testConfig());
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
    snap.funStats = table.getFunStats();

    const rigged = TableEngine.fromSnapshot(snap);
    expect(rigged.applyAction(0, { type: "all-in" })).toBe(true);
    expect(rigged.applyAction(1, { type: "call" })).toBe(true);

    const stats = rigged.getFunStats();
    expect(stats.handsWonBySeat[0]).toBeGreaterThanOrEqual(1);
    expect(stats.bestHand).not.toBeNull();
    expect(stats.bestHand!.seatId).toBe(0);
    expect(stats.bestHand!.handName.toLowerCase()).toContain("pair");
    expect(stats.bestHand!.cards).toHaveLength(5);
    expect(stats.largestPot?.amountChips).toBeGreaterThanOrEqual(1000);
  });

  it("attributes knockout when short stack loses at showdown", () => {
    const table = new TableEngine(testConfig());
    table.addPlayer(0, "u1", "Alice", null, 2000);
    table.addPlayer(1, "u2", "Bob", null, 500);
    table.startHand();
    // Fold hand 1 so blinds rotate and we can rig hand 2 cleanly.
    table.applyAction(table.getPublicState().currentActorSeat!, { type: "fold" });
    table.startHand();

    const snap = table.toSnapshot();
    // Seat 1 (Bob, short) gets kings; seat 0 (Alice) gets aces — Alice wins, Bob busts.
    snap.players.find((p) => p.seatId === 0)!.holeCards = ["Ad", "Ah"];
    snap.players.find((p) => p.seatId === 1)!.holeCards = ["Kd", "Kh"];
    snap.deck = ["2c", "3d", "7h", "8s", "9c", "4h", "5h", "6h", "Jc", "Qc"];
    snap.funStats = table.getFunStats();

    const rigged = TableEngine.fromSnapshot(snap);
    const actor = rigged.getPublicState().currentActorSeat!;
    expect(rigged.applyAction(actor, { type: "all-in" })).toBe(true);
    const caller = rigged.getPublicState().currentActorSeat!;
    expect(rigged.applyAction(caller, { type: "call" })).toBe(true);

    const stats = rigged.getFunStats();
    const bob = rigged.toSnapshot().players.find((p) => p.seatId === 1)!;
    expect(bob.eliminated).toBe(true);
    expect(stats.knockoutsBySeat[0]).toBe(1);
    expect(stats.handsWonBySeat[0]).toBeGreaterThanOrEqual(1);
  });

  it("persists fun stats through snapshot restore", () => {
    const table = new TableEngine(testConfig());
    table.addPlayer(0, "u1", "Alice", null, 1000);
    table.addPlayer(1, "u2", "Bob", null, 1000);
    table.startHand();
    const sb = table.getPublicState().seats.find((s) => s.isSmallBlind)!.seatId;
    table.applyAction(sb, { type: "fold" });

    const before = table.getFunStats();
    const restored = TableEngine.fromSnapshot(table.toSnapshot());
    expect(restored.getFunStats()).toEqual(before);
  });

  it("starts with empty fun stats", () => {
    const table = new TableEngine(testConfig());
    expect(table.getFunStats()).toEqual(emptyTableFunStats());
  });

  it("counts only the primary chip winner when side pots split winners", () => {
    const table = new TableEngine(testConfig());
    table.addPlayer(0, "u1", "Short", null, 200);
    table.addPlayer(1, "u2", "DeepA", null, 2000);
    table.addPlayer(2, "u3", "DeepB", null, 2000);

    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0);
    table.randomizeDealerButton();
    randomSpy.mockRestore();
    table.startHand();

    const snap = table.toSnapshot();
    // Short wins small main (set); DeepA wins larger side (aces over kings).
    // Deck: burn, flop 2-K-7, burn, turn, burn, river.
    snap.players.find((p) => p.seatId === 0)!.holeCards = ["2c", "2d"];
    snap.players.find((p) => p.seatId === 1)!.holeCards = ["Ad", "Ah"];
    snap.players.find((p) => p.seatId === 2)!.holeCards = ["Kd", "Qh"];
    snap.deck = ["3c", "2h", "Kc", "7s", "4c", "8d", "5c", "9s", "6c", "Tc"];
    snap.funStats = table.getFunStats();

    const rigged = TableEngine.fromSnapshot(snap);
    rigged.applyAction(0, { type: "all-in" });
    rigged.applyAction(1, { type: "all-in" });
    rigged.applyAction(2, { type: "call" });

    const events = rigged.drainEvents();
    const handResult = events.find((e) => e.type === "handResult");
    const result = handResult!.payload as import("@poker/protocol").HandResult;
    expect(new Set(result.winners.map((w) => w.seatId))).toEqual(new Set([0, 1]));
    expect(result.winners.find((w) => w.seatId === 1)!.amount).toBeGreaterThan(
      result.winners.find((w) => w.seatId === 0)!.amount
    );

    const stats = rigged.getFunStats();
    const wonSum = Object.values(stats.handsWonBySeat).reduce((a, b) => a + b, 0);
    expect(wonSum).toBe(1);
    expect(stats.handsWonBySeat[1]).toBe(1);
    expect(stats.handsWonBySeat[0] ?? 0).toBe(0);
  });

  it("tracks hands dealt and flops seen for VPIP-style flop %", () => {
    const table = new TableEngine(testConfig());
    table.addPlayer(0, "u1", "Alice", null, 1000);
    table.addPlayer(1, "u2", "Bob", null, 1000);
    table.startHand();

    const sb = table.getPublicState().seats.find((s) => s.isSmallBlind)!.seatId;
    const bb = table.getPublicState().seats.find((s) => s.isBigBlind)!.seatId;

    // Fold preflop — neither sees a flop, both were dealt.
    expect(table.applyAction(sb, { type: "fold" })).toBe(true);
    let stats = table.getFunStats();
    expect(stats.handsDealtBySeat[sb]).toBe(1);
    expect(stats.handsDealtBySeat[bb]).toBe(1);
    expect(stats.flopsSeenBySeat[sb] ?? 0).toBe(0);
    expect(stats.flopsSeenBySeat[bb] ?? 0).toBe(0);

    table.startHand();
    // Call / check to flop.
    const actor = table.getPublicState().currentActorSeat!;
    table.applyAction(actor, { type: "call" });
    const next = table.getPublicState().currentActorSeat!;
    table.applyAction(next, { type: "check" });
    expect(table.getPublicState().phase).toBe("flop");

    stats = table.getFunStats();
    expect(stats.handsDealtBySeat[0] + stats.handsDealtBySeat[1]).toBe(4);
    expect(stats.flopsSeenBySeat[0]).toBe(1);
    expect(stats.flopsSeenBySeat[1]).toBe(1);
  });
});
