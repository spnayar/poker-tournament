import { writeFileSync } from "fs";
import { describe, it } from "vitest";
import { buildNightRecapHtml } from "./nightRecap";

/**
 * Regenerates media/night-recap-email-preview.html when WRITE_NIGHT_RECAP_PREVIEW=1.
 * Not a behavioral assertion — run intentionally to refresh the store preview.
 */
describe("night recap preview writer", () => {
  it("writes HTML preview when env flag set", () => {
    if (process.env.WRITE_NIGHT_RECAP_PREVIEW !== "1") return;

    const html = buildNightRecapHtml({
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
    });

    const out =
      process.env.NIGHT_RECAP_PREVIEW_PATH ??
      "/cursor/stores/bc-ee3e2d19-c016-434b-be93-8ed2fd4737fb/media/night-recap-email-preview.html";
    writeFileSync(out, html);
  });
});
