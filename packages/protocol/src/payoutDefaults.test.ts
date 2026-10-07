import { describe, it, expect } from "vitest";
import {
  defaultPayoutPercents,
  paidPlaceCount,
  payoutPercentsToFormFields,
  resolveHostPayoutPercents,
} from "./index";

function positiveSum(values: (string | number)[]): number {
  return values
    .map((v) => (typeof v === "string" ? parseInt(v, 10) : v))
    .filter((n) => !Number.isNaN(n) && n > 0)
    .reduce((a, b) => a + b, 0);
}

describe("defaultPayoutPercents", () => {
  it("defaults to a 70/20/10 three-place split totaling 100", () => {
    expect(defaultPayoutPercents()).toEqual([70, 20, 10]);
    expect(defaultPayoutPercents(3)).toEqual([70, 20, 10]);
    expect(positiveSum(defaultPayoutPercents())).toBe(100);
  });

  it("returns 80/20 for two paying places", () => {
    expect(defaultPayoutPercents(2)).toEqual([80, 20]);
    expect(positiveSum(defaultPayoutPercents(2))).toBe(100);
  });

  it("returns 100 for a single paying place", () => {
    expect(defaultPayoutPercents(1)).toEqual([100]);
    expect(positiveSum(defaultPayoutPercents(1))).toBe(100);
  });
});

describe("paidPlaceCount", () => {
  it("maps 80/20 to two paying places and 70/20/10 to three", () => {
    expect(paidPlaceCount([80, 20])).toBe(2);
    expect(paidPlaceCount([70, 20, 10])).toBe(3);
    expect(paidPlaceCount([100])).toBe(1);
  });
});

describe("payoutPercentsToFormFields", () => {
  it("does not pad a two-place 80/20 split with a third 20", () => {
    const fields = payoutPercentsToFormFields([80, 20]);
    expect(fields).toEqual(["80", "20", ""]);
    expect(positiveSum(fields)).toBe(100);
  });

  it("maps a one-place winner-take-all split without inventing 2nd/3rd", () => {
    const fields = payoutPercentsToFormFields([100]);
    expect(fields).toEqual(["100", "", ""]);
    expect(positiveSum(fields)).toBe(100);
  });

  it("fills all three fields for the default 70/20/10 split", () => {
    const fields = payoutPercentsToFormFields(defaultPayoutPercents());
    expect(fields).toEqual(["70", "20", "10"]);
    expect(positiveSum(fields)).toBe(100);
  });
});

describe("resolveHostPayoutPercents", () => {
  it("keeps a valid two-place last-hosted split", () => {
    expect(resolveHostPayoutPercents([80, 20])).toEqual([80, 20]);
    expect(
      positiveSum(payoutPercentsToFormFields(resolveHostPayoutPercents([80, 20])))
    ).toBe(100);
  });

  it("falls back to 70/20/10 when last hosted sums over 100", () => {
    expect(resolveHostPayoutPercents([80, 20, 20])).toEqual([70, 20, 10]);
  });

  it("uses the three-place default when there is no last hosted split", () => {
    expect(resolveHostPayoutPercents()).toEqual([70, 20, 10]);
    expect(resolveHostPayoutPercents(null)).toEqual([70, 20, 10]);
  });

  it("reuses a valid historical 50/30/20 split", () => {
    expect(resolveHostPayoutPercents([50, 30, 20])).toEqual([50, 30, 20]);
  });
});
