import { describe, expect, it, vi } from "vitest";
import {
  NEW_JOIN_CODE_LENGTH,
  generateJoinCode,
  generateUniqueJoinCode,
} from "./joinCode";

const CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

describe("generateJoinCode", () => {
  it("uses the index source for each character and defaults to 8", () => {
    const nextIndex = vi.fn(() => 0);
    expect(generateJoinCode(NEW_JOIN_CODE_LENGTH, nextIndex)).toBe(
      "A".repeat(8)
    );
    expect(nextIndex).toHaveBeenCalledTimes(8);
    expect(nextIndex).toHaveBeenCalledWith(CHARSET.length);
  });

  it("does not use Math.random", () => {
    const spy = vi.spyOn(Math, "random").mockImplementation(() => {
      throw new Error("Math.random");
    });
    expect(generateJoinCode()).toHaveLength(8);
    spy.mockRestore();
  });

  it("only uses the unambiguous alphabet", () => {
    for (let i = 0; i < 40; i++) {
      const code = generateJoinCode();
      expect(code).toHaveLength(8);
      for (const ch of code) expect(CHARSET.includes(ch)).toBe(true);
    }
  });

  it("keeps generating 8-character codes when the first tries collide", async () => {
    const code = await generateUniqueJoinCode(
      async () => true,
      () => 1
    );
    expect(code).toBe("B".repeat(8));
  });

  it("returns the first code that is not already stored", async () => {
    const seen: string[] = [];
    const code = await generateUniqueJoinCode(async (candidate) => {
      seen.push(candidate);
      return seen.length < 2;
    });
    expect(seen).toHaveLength(2);
    expect(code).toBe(seen[1]);
    expect(code).toHaveLength(8);
  });
});
