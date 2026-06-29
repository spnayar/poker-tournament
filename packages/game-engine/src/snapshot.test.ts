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
});
