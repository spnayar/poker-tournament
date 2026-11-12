import { describe, it, expect } from "vitest";
import {
  evaluateHand,
  findPotWinners,
  formatHandDescr,
} from "./handEval";

describe("formatHandDescr", () => {
  it("strips suits from flush / straight-flush high labels", () => {
    expect(formatHandDescr("Flush, Ah High")).toBe("Flush, A High");
    expect(formatHandDescr("Flush, 10h High")).toBe("Flush, 10 High");
    expect(formatHandDescr("Straight Flush, 9h High")).toBe(
      "Straight Flush, 9 High"
    );
  });

  it("leaves other hand labels unchanged", () => {
    expect(formatHandDescr("Pair, A's")).toBe("Pair, A's");
    expect(formatHandDescr("Straight, A High")).toBe("Straight, A High");
    expect(formatHandDescr("A High")).toBe("A High");
    expect(formatHandDescr("Full House, A's over 2's")).toBe(
      "Full House, A's over 2's"
    );
    expect(formatHandDescr("Royal Flush")).toBe("Royal Flush");
  });
});

describe("evaluateHand", () => {
  it("returns the five cards that make the best hand", () => {
    const result = evaluateHand(
      0,
      ["As", "Ks"],
      ["Qs", "Js", "Ts", "2c", "3d"]
    );

    expect(result.cards).toHaveLength(5);
    expect(result.hand.descr).toContain("Flush");
    expect(result.cards).toEqual(["As", "Ks", "Qs", "Js", "Ts"]);
  });

  it("exposes rank-only hand names for showdown copy", () => {
    const flush = evaluateHand(
      0,
      ["Ah", "Kh"],
      ["Qh", "Jh", "9h", "2c", "3d"]
    );
    const { handName } = findPotWinners([flush]);
    expect(handName).toBe("Flush, A High");
  });

  it("ranks aces over kings at showdown", () => {
    const board = ["2c", "3d", "7h", "8s", "9c"];
    const bob = evaluateHand(0, ["Ad", "Ah"], board);
    const alice = evaluateHand(1, ["Kd", "Kh"], board);
    const { winners } = findPotWinners([bob, alice]);
    expect(winners.map((w) => w.seatId)).toEqual([0]);
  });
});
