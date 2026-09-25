import { describe, it, expect } from "vitest";
import { buildBlindLevels } from "@poker/protocol";
import { TableEngine } from "./table";

describe("TableEngine snapshot", () => {
  it("restores mid-hand state without re-dealing", () => {
    const table = new TableEngine({
      tournamentId: "test",
      startingChips: 1000,
      blindLevels: buildBlindLevels(1000, "turbo"),
    });
    table.addPlayer(0, "u1", "Alice", null, 1000);
    table.addPlayer(1, "u2", "Bob", null, 1000);
    table.startHand();

    const cardsBefore = table.getHoleCards(0);
    const handNumber = table.getPublicState().handNumber;
    const phase = table.getPublicState().phase;

    const snapshot = table.toSnapshot();
    const restored = TableEngine.fromSnapshot(snapshot);

    expect(restored.getHoleCards(0)).toEqual(cardsBefore);
    expect(restored.getPublicState().handNumber).toBe(handNumber);
    expect(restored.getPublicState().phase).toBe(phase);
  });

  it("restores skipReason with the snapshot", () => {
    const table = new TableEngine({
      tournamentId: "test",
      startingChips: 1000,
      blindLevels: buildBlindLevels(1000, "turbo"),
    });
    table.addPlayer(0, "u1", "Alice", null, 1000);
    table.addPlayer(1, "u2", "Bob", null, 1000);
    table.setSkipped(0, true, "disconnect");

    const restored = TableEngine.fromSnapshot(table.toSnapshot());
    expect(restored.isSkipped(0)).toBe(true);
    expect(restored.getSkipReason(0)).toBe("disconnect");
    expect(restored.getPublicState().seats.find((s) => s.seatId === 0)!.skipReason).toBe(
      "disconnect"
    );
  });

  it("restores awarded pots after hand-complete", () => {
    const table = new TableEngine({
      tournamentId: "test",
      startingChips: 1000,
      blindLevels: buildBlindLevels(1000, "turbo"),
    });
    table.addPlayer(0, "u1", "Alice", null, 1000);
    table.addPlayer(1, "u2", "Bob", null, 1000);
    table.startHand();
    const sb = table.getPublicState().seats.find((s) => s.isSmallBlind)!.seatId;
    expect(table.applyAction(sb, { type: "fold" })).toBe(true);
    expect(table.getPublicState().phase).toBe("hand-complete");
    const pots = table.getPublicState().pots;
    expect(pots.length).toBeGreaterThan(0);

    const restored = TableEngine.fromSnapshot(table.toSnapshot());
    expect(restored.getPublicState().pots).toEqual(pots);
    expect(restored.getPublicState().totalPot).toBe(table.getPublicState().totalPot);
  });
});
