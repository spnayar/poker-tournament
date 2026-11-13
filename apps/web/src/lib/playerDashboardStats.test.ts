import { describe, expect, it } from "vitest";
import {
  aggregatePlayerDashboardStats,
  pickRivalHighlights,
  type DashboardGameInput,
  type HeadToHeadRow,
} from "./playerDashboardStats";

function h2h(partial: Partial<HeadToHeadRow> & Pick<HeadToHeadRow, "opponentUserId" | "displayName">): HeadToHeadRow {
  return {
    avatarUrl: null,
    nightsTogether: 2,
    sessionsTogether: 2,
    finishesAhead: 0,
    finishesBehind: 0,
    finishesTied: 0,
    netLedgerEdgeCents: 0,
    myHandsWon: 0,
    theirHandsWon: 0,
    ...partial,
  };
}

const alice = "alice";
const bob = "bob";
const cara = "cara";

function game(
  partial: Partial<DashboardGameInput> &
    Pick<DashboardGameInput, "gameId" | "tournamentId" | "results">
): DashboardGameInput {
  return {
    chopped: false,
    buyInCents: 2000,
    funStats: {},
    ...partial,
  };
}

describe("aggregatePlayerDashboardStats", () => {
  it("returns empty career and no H2H when user has no results", () => {
    const stats = aggregatePlayerDashboardStats(alice, [
      game({
        gameId: "g1",
        tournamentId: "n1",
        results: [
          {
            userId: bob,
            displayName: "Bob",
            avatarUrl: null,
            finishPosition: 1,
            payoutCents: 4000,
          },
        ],
      }),
    ]);
    expect(stats.career.sessionsPlayed).toBe(0);
    expect(stats.career.nightsPlayed).toBe(0);
    expect(stats.career.ledgerRoiPercent).toBeNull();
    expect(stats.headToHead).toEqual([]);
    expect(stats.rivals).toEqual({ biggestNemesis: null, easyMoney: null });
  });

  it("aggregates nights, wins, ledger ROI, hands, flops, best finish, biggest pot", () => {
    const games: DashboardGameInput[] = [
      game({
        gameId: "g1",
        tournamentId: "night-a",
        buyInCents: 2000,
        funStats: {
          handsDealtByUserId: { [alice]: 20, [bob]: 20 },
          handsWonByUserId: { [alice]: 8, [bob]: 12 },
          flopsSeenByUserId: { [alice]: 10, [bob]: 14 },
          knockoutsByUserId: {},
          largestPot: {
            amountChips: 5000,
            winnerUserIds: [alice],
            handNumber: 3,
          },
          bestHand: null,
        },
        results: [
          {
            userId: alice,
            displayName: "Alice",
            avatarUrl: null,
            finishPosition: 1,
            payoutCents: 4000,
          },
          {
            userId: bob,
            displayName: "Bob",
            avatarUrl: null,
            finishPosition: 2,
            payoutCents: 0,
          },
        ],
      }),
      game({
        gameId: "g2",
        tournamentId: "night-a",
        buyInCents: 2000,
        funStats: {
          handsDealtByUserId: { [alice]: 10, [cara]: 10 },
          handsWonByUserId: { [alice]: 2, [cara]: 8 },
          flopsSeenByUserId: { [alice]: 4, [cara]: 7 },
          knockoutsByUserId: {},
          largestPot: {
            amountChips: 9000,
            winnerUserIds: [cara],
            handNumber: 5,
          },
          bestHand: null,
        },
        results: [
          {
            userId: alice,
            displayName: "Alice",
            avatarUrl: null,
            finishPosition: 2,
            payoutCents: 0,
          },
          {
            userId: cara,
            displayName: "Cara",
            avatarUrl: null,
            finishPosition: 1,
            payoutCents: 4000,
          },
        ],
      }),
      game({
        gameId: "g3",
        tournamentId: "night-b",
        buyInCents: 1000,
        chopped: true,
        funStats: {
          handsDealtByUserId: { [alice]: 5, [bob]: 5 },
          handsWonByUserId: { [alice]: 1, [bob]: 4 },
          flopsSeenByUserId: { [alice]: 2, [bob]: 3 },
          knockoutsByUserId: {},
          largestPot: {
            amountChips: 12000,
            winnerUserIds: [alice],
            handNumber: 2,
          },
          bestHand: null,
        },
        results: [
          {
            userId: alice,
            displayName: "Alice",
            avatarUrl: null,
            finishPosition: 1,
            payoutCents: 1000,
          },
          {
            userId: bob,
            displayName: "Bob",
            avatarUrl: null,
            finishPosition: 1,
            payoutCents: 1000,
          },
        ],
      }),
    ];

    const { career } = aggregatePlayerDashboardStats(alice, games);

    expect(career.nightsPlayed).toBe(2);
    expect(career.sessionsPlayed).toBe(3);
    // Chop does not count as a sole win or ITM
    expect(career.wins).toBe(1);
    expect(career.itmCount).toBe(1);
    expect(career.handsDealt).toBe(35);
    expect(career.handsWon).toBe(11);
    // flops 10+4+2 = 16 / 35 ≈ 46%
    expect(career.flopsSeenPercent).toBe(46);
    expect(career.totalBuyInCents).toBe(5000);
    expect(career.totalPayoutCents).toBe(5000);
    expect(career.netLedgerCents).toBe(0);
    expect(career.ledgerRoiPercent).toBe(0);
    expect(career.bestFinish).toBe(1);
    // Biggest pot Alice won: 12000 (chop night) beats 5000
    expect(career.biggestPotChips).toBe(12000);
  });

  it("computes ledger ROI from net / buy-ins", () => {
    const { career } = aggregatePlayerDashboardStats(alice, [
      game({
        gameId: "g1",
        tournamentId: "n1",
        buyInCents: 2000,
        results: [
          {
            userId: alice,
            displayName: "Alice",
            avatarUrl: null,
            finishPosition: 1,
            payoutCents: 6000,
          },
          {
            userId: bob,
            displayName: "Bob",
            avatarUrl: null,
            finishPosition: 2,
            payoutCents: 0,
          },
        ],
      }),
    ]);
    // net +4000 / 2000 = +200%
    expect(career.netLedgerCents).toBe(4000);
    expect(career.ledgerRoiPercent).toBe(200);
  });

  it("builds H2H with finishes ahead, nights together, ledger edge, and hands", () => {
    const games: DashboardGameInput[] = [
      game({
        gameId: "g1",
        tournamentId: "night-1",
        buyInCents: 2000,
        funStats: {
          handsDealtByUserId: { [alice]: 10, [bob]: 10 },
          handsWonByUserId: { [alice]: 6, [bob]: 4 },
          flopsSeenByUserId: {},
          knockoutsByUserId: {},
          largestPot: null,
          bestHand: null,
        },
        results: [
          {
            userId: alice,
            displayName: "Alice",
            avatarUrl: "/a.png",
            finishPosition: 1,
            payoutCents: 4000,
          },
          {
            userId: bob,
            displayName: "Bob",
            avatarUrl: "/b.png",
            finishPosition: 2,
            payoutCents: 0,
          },
        ],
      }),
      game({
        gameId: "g2",
        tournamentId: "night-2",
        buyInCents: 2000,
        funStats: {
          handsDealtByUserId: { [alice]: 8, [bob]: 8 },
          handsWonByUserId: { [alice]: 2, [bob]: 6 },
          flopsSeenByUserId: {},
          knockoutsByUserId: {},
          largestPot: null,
          bestHand: null,
        },
        results: [
          {
            userId: alice,
            displayName: "Alice",
            avatarUrl: "/a.png",
            finishPosition: 2,
            payoutCents: 0,
          },
          {
            userId: bob,
            displayName: "Bob",
            avatarUrl: "/b.png",
            finishPosition: 1,
            payoutCents: 4000,
          },
        ],
      }),
      game({
        gameId: "g3",
        tournamentId: "night-2",
        buyInCents: 1000,
        funStats: {
          handsDealtByUserId: { [alice]: 5, [cara]: 5 },
          handsWonByUserId: { [alice]: 3, [cara]: 2 },
          flopsSeenByUserId: {},
          knockoutsByUserId: {},
          largestPot: null,
          bestHand: null,
        },
        results: [
          {
            userId: alice,
            displayName: "Alice",
            avatarUrl: null,
            finishPosition: 1,
            payoutCents: 2000,
          },
          {
            userId: cara,
            displayName: "Cara",
            avatarUrl: null,
            finishPosition: 2,
            payoutCents: 0,
          },
        ],
      }),
    ];

    const { headToHead } = aggregatePlayerDashboardStats(alice, games);

    expect(headToHead).toHaveLength(2);
    // Bob shared 2 sessions; Cara 1 — Bob first
    expect(headToHead[0]!.opponentUserId).toBe(bob);
    expect(headToHead[0]!.nightsTogether).toBe(2);
    expect(headToHead[0]!.sessionsTogether).toBe(2);
    expect(headToHead[0]!.finishesAhead).toBe(1);
    expect(headToHead[0]!.finishesBehind).toBe(1);
    // g1: alice +2000, bob -2000 → edge +4000; g2: alice -2000, bob +2000 → edge -4000; total 0
    expect(headToHead[0]!.netLedgerEdgeCents).toBe(0);
    expect(headToHead[0]!.myHandsWon).toBe(8);
    expect(headToHead[0]!.theirHandsWon).toBe(10);

    expect(headToHead[1]!.opponentUserId).toBe(cara);
    expect(headToHead[1]!.finishesAhead).toBe(1);
    expect(headToHead[1]!.finishesBehind).toBe(0);
    // alice +1000, cara -1000 → edge +2000
    expect(headToHead[1]!.netLedgerEdgeCents).toBe(2000);

    // Bob even (0 edge); Cara only 1 night — no rival highlights yet
    const { rivals } = aggregatePlayerDashboardStats(alice, games);
    expect(rivals.biggestNemesis).toBeNull();
    expect(rivals.easyMoney).toBeNull();
  });

  it("skips finish comparisons on chopped sessions but still tracks ledger edge", () => {
    const { headToHead } = aggregatePlayerDashboardStats(alice, [
      game({
        gameId: "g1",
        tournamentId: "n1",
        buyInCents: 2000,
        chopped: true,
        results: [
          {
            userId: alice,
            displayName: "Alice",
            avatarUrl: null,
            finishPosition: 1,
            payoutCents: 2000,
          },
          {
            userId: bob,
            displayName: "Bob",
            avatarUrl: null,
            finishPosition: 1,
            payoutCents: 2000,
          },
        ],
      }),
    ]);

    expect(headToHead[0]!.finishesAhead).toBe(0);
    expect(headToHead[0]!.finishesBehind).toBe(0);
    expect(headToHead[0]!.finishesTied).toBe(0);
    expect(headToHead[0]!.netLedgerEdgeCents).toBe(0);
  });

  it("treats missing funStats as zeros without inventing flops %", () => {
    const { career } = aggregatePlayerDashboardStats(alice, [
      game({
        gameId: "g1",
        tournamentId: "n1",
        funStats: null,
        results: [
          {
            userId: alice,
            displayName: "Alice",
            avatarUrl: null,
            finishPosition: 3,
            payoutCents: 0,
          },
        ],
      }),
    ]);
    expect(career.handsDealt).toBe(0);
    expect(career.handsWon).toBe(0);
    expect(career.flopsSeenPercent).toBeNull();
    expect(career.biggestPotChips).toBeNull();
    expect(career.bestFinish).toBe(3);
  });

  it("picks Biggest Nemesis and Easy Money by ledger edge with enough shared nights", () => {
    const games: DashboardGameInput[] = [
      // Bob beats Alice twice across two nights
      game({
        gameId: "g1",
        tournamentId: "n1",
        buyInCents: 2000,
        results: [
          {
            userId: alice,
            displayName: "Alice",
            avatarUrl: null,
            finishPosition: 2,
            payoutCents: 0,
          },
          {
            userId: bob,
            displayName: "Bob",
            avatarUrl: "/bob.png",
            finishPosition: 1,
            payoutCents: 4000,
          },
        ],
      }),
      game({
        gameId: "g2",
        tournamentId: "n2",
        buyInCents: 2000,
        results: [
          {
            userId: alice,
            displayName: "Alice",
            avatarUrl: null,
            finishPosition: 2,
            payoutCents: 0,
          },
          {
            userId: bob,
            displayName: "Bob",
            avatarUrl: "/bob.png",
            finishPosition: 1,
            payoutCents: 4000,
          },
        ],
      }),
      // Cara loses to Alice twice across two nights
      game({
        gameId: "g3",
        tournamentId: "n3",
        buyInCents: 1000,
        results: [
          {
            userId: alice,
            displayName: "Alice",
            avatarUrl: null,
            finishPosition: 1,
            payoutCents: 2000,
          },
          {
            userId: cara,
            displayName: "Cara",
            avatarUrl: "/cara.png",
            finishPosition: 2,
            payoutCents: 0,
          },
        ],
      }),
      game({
        gameId: "g4",
        tournamentId: "n4",
        buyInCents: 1000,
        results: [
          {
            userId: alice,
            displayName: "Alice",
            avatarUrl: null,
            finishPosition: 1,
            payoutCents: 2000,
          },
          {
            userId: cara,
            displayName: "Cara",
            avatarUrl: "/cara.png",
            finishPosition: 2,
            payoutCents: 0,
          },
        ],
      }),
    ];

    const { rivals } = aggregatePlayerDashboardStats(alice, games);
    expect(rivals.biggestNemesis?.opponentUserId).toBe(bob);
    expect(rivals.biggestNemesis?.avatarUrl).toBe("/bob.png");
    expect(rivals.biggestNemesis?.netLedgerEdgeCents).toBe(-8000);
    expect(rivals.biggestNemesis?.nightsTogether).toBe(2);

    expect(rivals.easyMoney?.opponentUserId).toBe(cara);
    expect(rivals.easyMoney?.avatarUrl).toBe("/cara.png");
    expect(rivals.easyMoney?.netLedgerEdgeCents).toBe(4000);
    expect(rivals.easyMoney?.nightsTogether).toBe(2);
  });
});

describe("pickRivalHighlights", () => {
  it("ignores opponents with fewer than 2 shared nights", () => {
    const rivals = pickRivalHighlights([
      h2h({
        opponentUserId: bob,
        displayName: "Bob",
        nightsTogether: 1,
        netLedgerEdgeCents: -9999,
      }),
      h2h({
        opponentUserId: cara,
        displayName: "Cara",
        nightsTogether: 1,
        netLedgerEdgeCents: 9999,
      }),
    ]);
    expect(rivals.biggestNemesis).toBeNull();
    expect(rivals.easyMoney).toBeNull();
  });

  it("requires a negative edge for Nemesis and positive for Easy Money", () => {
    const rivals = pickRivalHighlights([
      h2h({
        opponentUserId: bob,
        displayName: "Bob",
        nightsTogether: 3,
        netLedgerEdgeCents: 0,
        finishesAhead: 1,
        finishesBehind: 2,
      }),
    ]);
    expect(rivals.biggestNemesis).toBeNull();
    expect(rivals.easyMoney).toBeNull();
  });

  it("tie-breaks Nemesis by finishes behind and Easy Money by finishes ahead", () => {
    const rivals = pickRivalHighlights([
      h2h({
        opponentUserId: "x",
        displayName: "X",
        netLedgerEdgeCents: -1000,
        finishesBehind: 1,
        finishesAhead: 0,
      }),
      h2h({
        opponentUserId: "y",
        displayName: "Y",
        netLedgerEdgeCents: -1000,
        finishesBehind: 3,
        finishesAhead: 0,
      }),
      h2h({
        opponentUserId: "p",
        displayName: "P",
        netLedgerEdgeCents: 500,
        finishesAhead: 1,
        finishesBehind: 0,
      }),
      h2h({
        opponentUserId: "q",
        displayName: "Q",
        netLedgerEdgeCents: 500,
        finishesAhead: 4,
        finishesBehind: 0,
      }),
    ]);
    expect(rivals.biggestNemesis?.opponentUserId).toBe("y");
    expect(rivals.easyMoney?.opponentUserId).toBe("q");
  });
});

