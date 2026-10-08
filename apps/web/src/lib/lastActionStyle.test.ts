import { describe, expect, it } from "vitest";
import { lastActionTone } from "./lastActionStyle";

describe("lastActionTone", () => {
  it("highlights aggressive actions in emerald/amber", () => {
    expect(lastActionTone("Raise 150").text).toContain("emerald");
    expect(lastActionTone("All-in 4825").text).toContain("amber");
    expect(lastActionTone("Wins 9700").text).toContain("amber");
  });

  it("colors fold/call distinctly", () => {
    expect(lastActionTone("Fold").text).toContain("red");
    expect(lastActionTone("Call 25").text).toContain("sky");
  });
});
