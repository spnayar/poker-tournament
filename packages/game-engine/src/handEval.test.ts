import { describe, it, expect } from "vitest";
import { evaluateHand, findPotWinners } from "./handEval";

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

  it("ranks aces over kings at showdown", () => {
    const board = ["2c", "3d", "7h", "8s", "9c"];
    const bob = evaluateHand(0, ["Ad", "Ah"], board);
    const alice = evaluateHand(1, ["Kd", "Kh"], board);
    const { winners } = findPotWinners([bob, alice]);
    expect(winners.map((w) => w.seatId)).toEqual([0]);
  });
});
