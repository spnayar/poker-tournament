import { describe, it, expect } from "vitest";
import {
  createGameNightFormDefaults,
  payoutFormForPaidPlaces,
  payoutValuesForPaidPlaces,
  validatePayoutPercents,
} from "./tournament";

describe("payoutFormForPaidPlaces", () => {
  it("uses 80/20 with a blank 3rd when two places are paid", () => {
    expect(payoutFormForPaidPlaces(2)).toEqual({
      paidPlaces: 2,
      payout1: "80",
      payout2: "20",
      payout3: "",
    });
    expect(
      validatePayoutPercents(
        payoutValuesForPaidPlaces(payoutFormForPaidPlaces(2))
      )
    ).toBeNull();
  });

  it("keeps the 70/20/10 three-place default", () => {
    expect(payoutFormForPaidPlaces(3)).toEqual({
      paidPlaces: 3,
      payout1: "70",
      payout2: "20",
      payout3: "10",
    });
  });

  it("uses winner-take-all for one paid place", () => {
    expect(payoutFormForPaidPlaces(1)).toEqual({
      paidPlaces: 1,
      payout1: "100",
      payout2: "",
      payout3: "",
    });
  });
});

describe("createGameNightFormDefaults", () => {
  it("opens on three-place 70/20/10 when the host has no prior night", () => {
    const form = createGameNightFormDefaults();
    expect(form.paidPlaces).toBe(3);
    expect([form.payout1, form.payout2, form.payout3]).toEqual([
      "70",
      "20",
      "10",
    ]);
  });

  it("restores a last-hosted two-place 80/20 without padding a third row", () => {
    const form = createGameNightFormDefaults({
      buyInCents: 2000,
      startingChips: 5000,
      maxPlayers: 9,
      blindPace: "standard",
      blindPreset: "standard",
      blindLevelMinutes: 12,
      payoutPercents: [80, 20],
    });
    expect(form.paidPlaces).toBe(2);
    expect([form.payout1, form.payout2, form.payout3]).toEqual([
      "80",
      "20",
      "",
    ]);
    expect(validatePayoutPercents(payoutValuesForPaidPlaces(form))).toBeNull();
  });
});
