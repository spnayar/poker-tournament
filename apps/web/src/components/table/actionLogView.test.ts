import { describe, expect, it } from "vitest";
import type { ActionLogEntry } from "@poker/protocol";
import { groupActionLogNewestFirst } from "./actionLogView";

function entry(
  partial: Partial<ActionLogEntry> &
    Pick<ActionLogEntry, "id" | "action" | "handNumber" | "street">
): ActionLogEntry {
  return {
    seatId: 0,
    displayName: "P",
    avatarUrl: null,
    ...partial,
  };
}

describe("groupActionLogNewestFirst", () => {
  it("orders hands and actions newest-first and drops engine hand headers", () => {
    const log: ActionLogEntry[] = [
      entry({
        id: 1,
        seatId: -1,
        displayName: "",
        action: "Hand #1",
        street: "hand",
        handNumber: 1,
      }),
      entry({ id: 2, action: "SB 25", street: "preflop", handNumber: 1 }),
      entry({ id: 3, action: "BB 50", street: "preflop", handNumber: 1 }),
      entry({
        id: 4,
        seatId: -1,
        displayName: "",
        action: "Hand #2",
        street: "hand",
        handNumber: 2,
      }),
      entry({ id: 5, action: "SB 25", street: "preflop", handNumber: 2 }),
      entry({ id: 6, action: "Raise 150", street: "preflop", handNumber: 2 }),
    ];

    const groups = groupActionLogNewestFirst(log);
    expect(groups.map((g) => g.handNumber)).toEqual([2, 1]);
    expect(groups[0]!.entries.map((e) => e.action)).toEqual([
      "Raise 150",
      "SB 25",
    ]);
    expect(groups[1]!.entries.map((e) => e.action)).toEqual(["BB 50", "SB 25"]);
    expect(
      groups.flatMap((g) => g.entries).some((e) => e.seatId === -1)
    ).toBe(false);
  });
});
