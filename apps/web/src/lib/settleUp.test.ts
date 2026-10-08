import { describe, it, expect } from "vitest";
import {
  formatSettleUpMethod,
  parseSettleUpMethodsInput,
  settleUpProviderLabel,
} from "./settleUp";

describe("settleUp helpers", () => {
  it("labels providers", () => {
    expect(settleUpProviderLabel("CASH_APP")).toBe("Cash App");
    expect(
      formatSettleUpMethod({ provider: "VENMO", contact: "@bob" })
    ).toBe("Venmo: @bob");
  });

  it("validates PATCH input", () => {
    const ok = parseSettleUpMethodsInput([
      { provider: "PAYPAL", contact: " a@b.com " },
    ]);
    expect(ok).toEqual({
      ok: true,
      methods: [{ provider: "PAYPAL", contact: "a@b.com" }],
    });

    const bad = parseSettleUpMethodsInput([
      { provider: "PAYPAL", contact: "" },
    ]);
    expect(bad.ok).toBe(false);
  });
});
