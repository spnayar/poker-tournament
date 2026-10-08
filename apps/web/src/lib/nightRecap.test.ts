import { describe, it, expect } from "vitest";
import { buildNightRecapHtml, buildNightRecapText } from "./nightRecap";
import type { NightRecapPayload } from "./nightRecap";
import { LEDGER_DISCLAIMER } from "./utils";
import { SETTLE_UP_DISCLAIMER } from "./settleUp";

function samplePayload(): NightRecapPayload {
  return {
    nightName: "Friday Friction",
    ledger: [
      {
        userId: "alice",
        displayName: "Alice",
        gamesPlayed: 2,
        totalBuyInCents: 4000,
        totalPayoutCents: 7000,
        netCents: 3000,
      },
      {
        userId: "bob",
        displayName: "Bob",
        gamesPlayed: 2,
        totalBuyInCents: 4000,
        totalPayoutCents: 1000,
        netCents: -3000,
      },
    ],
    transfers: [
      {
        fromUserId: "bob",
        fromDisplayName: "Bob",
        toUserId: "alice",
        toDisplayName: "Alice",
        amountCents: 3000,
      },
    ],
    settleUpByUserId: {
      alice: [
        { provider: "VENMO", contact: "@alice-pays" },
        { provider: "ZELLE", contact: "555-0100" },
      ],
    },
    stats: {
      tournamentCount: 2,
      totalHands: 47,
      winners: [
        { displayName: "Alice", gameNumber: 1, payoutCents: 4000 },
        { displayName: "Alice", gameNumber: 2, payoutCents: 3000 },
      ],
      itm: [{ displayName: "Alice", count: 2 }],
    },
    createUrl: "https://www.pokertableclub.com/dashboard",
  };
}

describe("night recap email", () => {
  it("leads with settlement and includes settle-up methods for who is owed", () => {
    const html = buildNightRecapHtml(samplePayload());
    expect(html).toContain("Night settlement");
    expect(html).toContain("Venmo: @alice-pays");
    expect(html).toContain("Zelle: 555-0100");
    expect(html).toContain("Bob");
    expect(html).toContain("Alice");
    expect(html).toContain("$30.00");
    expect(html).toContain("Night highlights");
    expect(html).toContain("Run your own game night");
    expect(html).toContain(SETTLE_UP_DISCLAIMER);
    expect(html).toContain(LEDGER_DISCLAIMER);
    // Settlement block appears before highlights
    expect(html.indexOf("Night settlement")).toBeLessThan(
      html.indexOf("Night highlights")
    );
  });

  it("builds plain text with pay-outs and CTA", () => {
    const text = buildNightRecapText(samplePayload());
    expect(text).toContain("Suggested pay-outs:");
    expect(text).toContain("Bob → Alice: $30.00");
    expect(text).toContain("Venmo: @alice-pays");
    expect(text).toContain("Run your own game night:");
  });
});
