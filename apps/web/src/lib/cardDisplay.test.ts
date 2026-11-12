import { describe, expect, it } from "vitest";
import { formatRankDisplay } from "./cardDisplay";

describe("formatRankDisplay", () => {
  it("renders tens as 10", () => {
    expect(formatRankDisplay("T")).toBe("10");
  });

  it("leaves other ranks unchanged", () => {
    for (const rank of ["A", "K", "Q", "J", "9", "2"]) {
      expect(formatRankDisplay(rank)).toBe(rank);
    }
  });
});
