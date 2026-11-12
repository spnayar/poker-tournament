import { describe, it, expect } from "vitest";
import {
  aggregateNightFunFacts,
  buildNightRecapHtml,
  buildNightRecapText,
  formatCardsPlain,
} from "./nightRecap";
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
        {
          displayName: "Alice",
          gameNumber: 1,
          payoutCents: 4000,
          buyInCents: 2000,
          netCents: 2000,
        },
        {
          displayName: "Alice",
          gameNumber: 2,
          payoutCents: 3000,
          buyInCents: 2000,
          netCents: 1000,
        },
      ],
      itm: [{ displayName: "Alice", count: 2 }],
      handsWon: [
        { displayName: "Alice", count: 28 },
        { displayName: "Bob", count: 19 },
      ],
      knockouts: [
        { displayName: "Alice", count: 3 },
        { displayName: "Bob", count: 1 },
      ],
      largestPot: {
        amountChips: 12400,
        winnerNames: ["Alice"],
        gameNumber: 2,
        handNumber: 18,
      },
      bestHand: {
        displayName: "Bob",
        handName: "Four of a Kind, Aces",
        cards: ["As", "Ah", "Ad", "Ac", "Kh"],
        gameNumber: 1,
        handNumber: 9,
      },
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

  it("includes fun facts after settlement", () => {
    const html = buildNightRecapHtml(samplePayload());
    expect(html).toContain("Fun facts");
    expect(html).toContain("Best hand of the night");
    expect(html).toContain("Four of a Kind, Aces");
    expect(html).toContain("A♠ A♥ A♦ A♣ K♥");
    expect(html).toContain("Largest pot");
    expect(html).toContain("12,400");
    expect(html).toContain("Hands won");
    expect(html).toContain("Knockout kings");
    expect(html.indexOf("Night settlement")).toBeLessThan(
      html.indexOf("Fun facts")
    );
  });

  it("highlights winner net with payout and buy-in, not stacked gross", () => {
    const html = buildNightRecapHtml(samplePayload());
    expect(html).toContain("Alice");
    expect(html).toContain("won");
    expect(html).toContain("Tournament #1");
    expect(html).toContain("+$20.00");
    expect(html).toContain("$40.00 payout on a $20.00 buy-in");
    expect(html).not.toContain("stacked for");
    const text = buildNightRecapText(samplePayload());
    expect(text).toContain(
      "Alice won Tournament #1, +$20.00 ($40.00 payout on a $20.00 buy-in)"
    );
  });

  it("labels chops without a sole winner and keeps ITM separate in copy", () => {
    const payload = samplePayload();
    payload.stats.winners = [
      {
        displayName: "Alice",
        gameNumber: 1,
        payoutCents: 4000,
        buyInCents: 2000,
        netCents: 2000,
      },
      {
        displayName: "",
        gameNumber: 2,
        payoutCents: 0,
        buyInCents: 2000,
        netCents: 0,
        chopped: true,
        chopShares: [
          {
            displayName: "Bob",
            payoutCents: 2030,
            netCents: 30,
          },
          {
            displayName: "Alice",
            payoutCents: 1970,
            netCents: -30,
          },
        ],
      },
    ];
    payload.stats.itm = [{ displayName: "Alice", count: 1 }];
    const html = buildNightRecapHtml(payload);
    expect(html).toContain("chopped");
    expect(html).toContain("Tournament #2");
    expect(html).not.toMatch(/Bob<\/strong> won/);
    expect(html).toContain("In the money: Alice");
    expect(html).not.toContain("In the money: Alice (×2)");
    const text = buildNightRecapText(payload);
    expect(text).toContain("Tournament #2 chopped");
    expect(text).toContain("Bob +$0.30");
    expect(text).not.toContain("Bob won Tournament #2");
  });

  it("formats negative ledger nets as -$X.XX", () => {
    const html = buildNightRecapHtml(samplePayload());
    expect(html).toContain("-$30.00");
    expect(html).not.toContain("$-30.00");
  });

  it("builds plain text with pay-outs, fun facts, and CTA", () => {
    const text = buildNightRecapText(samplePayload());
    expect(text).toContain("Suggested pay-outs:");
    expect(text).toContain("Bob → Alice: $30.00");
    expect(text).toContain("Venmo: @alice-pays");
    expect(text).toContain("Best hand of the night: Bob");
    expect(text).toContain("Hands won: Alice 28, Bob 19");
    expect(text).toContain("Most knockouts: Alice 3, Bob 1");
    expect(text).toContain("Largest pot: 12,400 chips");
    expect(text).toContain("Run your own game night:");
  });

  it("formats showdown cards for email", () => {
    expect(formatCardsPlain(["As", "Ah", "Ad", "Ac", "Kh"])).toBe(
      "A♠ A♥ A♦ A♣ K♥"
    );
  });

  it("renders tens as 10 in email card glyphs", () => {
    expect(formatCardsPlain(["Ts", "Td", "9h"])).toBe("10♠ 10♦ 9♥");
  });
});

describe("aggregateNightFunFacts", () => {
  it("merges hands won / knockouts and picks best hand + largest pot", () => {
    const names = new Map([
      ["alice", "Alice"],
      ["bob", "Bob"],
    ]);
    const result = aggregateNightFunFacts(
      [
        {
          gameNumber: 1,
          funStats: {
            handsWonByUserId: { alice: 10, bob: 8 },
            knockoutsByUserId: { alice: 1 },
            largestPot: {
              amountChips: 5000,
              winnerUserIds: ["bob"],
              handNumber: 4,
            },
            bestHand: {
              userId: "bob",
              handName: "Pair, Aces",
              cards: ["As", "Ah", "9d", "5c", "2h"],
              handNumber: 3,
            },
          },
        },
        {
          gameNumber: 2,
          funStats: {
            handsWonByUserId: { alice: 12, bob: 7 },
            knockoutsByUserId: { alice: 2, bob: 1 },
            largestPot: {
              amountChips: 12400,
              winnerUserIds: ["alice"],
              handNumber: 18,
            },
            bestHand: {
              userId: "alice",
              handName: "Four of a Kind, Aces",
              cards: ["As", "Ah", "Ad", "Ac", "Kh"],
              handNumber: 9,
            },
          },
        },
      ],
      names
    );

    expect(result.handsWon).toEqual([
      { displayName: "Alice", count: 22 },
      { displayName: "Bob", count: 15 },
    ]);
    expect(result.knockouts).toEqual([
      { displayName: "Alice", count: 3 },
      { displayName: "Bob", count: 1 },
    ]);
    expect(result.largestPot?.amountChips).toBe(12400);
    expect(result.largestPot?.winnerNames).toEqual(["Alice"]);
    expect(result.bestHand?.displayName).toBe("Alice");
    expect(result.bestHand?.handName).toContain("Four of a Kind");
  });

  it("returns empty fun facts when games have no stats yet", () => {
    const result = aggregateNightFunFacts(
      [{ gameNumber: 1, funStats: {} }],
      new Map([["alice", "Alice"]])
    );
    expect(result.handsWon).toEqual([]);
    expect(result.knockouts).toEqual([]);
    expect(result.largestPot).toBeNull();
    expect(result.bestHand).toBeNull();
  });
});
