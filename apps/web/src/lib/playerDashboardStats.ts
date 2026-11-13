import { parseGameFunStats } from "@poker/protocol";

/** One finished session row with all player results (for career + H2H). */
export type DashboardGameInput = {
  gameId: string;
  tournamentId: string;
  chopped: boolean;
  buyInCents: number;
  funStats: unknown;
  results: Array<{
    userId: string;
    displayName: string;
    avatarUrl: string | null;
    finishPosition: number;
    payoutCents: number;
  }>;
};

export type CareerPlayStats = {
  /** Unique game nights (tournaments) with a finished result. */
  nightsPlayed: number;
  /** Finished tournament sessions. */
  sessionsPlayed: number;
  /** Sole #1 finishes (chops excluded). */
  wins: number;
  /** Paid finishes excluding chops. */
  itmCount: number;
  handsDealt: number;
  handsWon: number;
  /** null when no hands dealt recorded in funStats. */
  flopsSeenPercent: number | null;
  totalBuyInCents: number;
  totalPayoutCents: number;
  /** payout − buy-ins (ledger cents). */
  netLedgerCents: number;
  /**
   * (net / buy-ins) × 100, rounded. null when buy-ins are 0.
   * Ledger tracking only — not cash ROI.
   */
  ledgerRoiPercent: number | null;
  /** Best finish position (1 = first). null if no sessions. */
  bestFinish: number | null;
  /** Largest pot (chips) the player won. null if none recorded. */
  biggestPotChips: number | null;
};

export type HeadToHeadRow = {
  opponentUserId: string;
  displayName: string;
  avatarUrl: string | null;
  nightsTogether: number;
  sessionsTogether: number;
  /** Times this player finished ahead (lower place number). */
  finishesAhead: number;
  finishesBehind: number;
  finishesTied: number;
  /**
   * Sum over shared sessions of (myNet − theirNet) in ledger cents.
   * Positive = you came out ahead of them on the ledger across shared play.
   */
  netLedgerEdgeCents: number;
  myHandsWon: number;
  theirHandsWon: number;
};

/**
 * Highlight card for Biggest Nemesis / Easy Money.
 * Ranked by ledger edge across shared sessions (friends-club tracking only).
 */
export type RivalHighlight = {
  opponentUserId: string;
  displayName: string;
  avatarUrl: string | null;
  nightsTogether: number;
  sessionsTogether: number;
  finishesAhead: number;
  finishesBehind: number;
  /** Your ledger net minus theirs across shared sessions. */
  netLedgerEdgeCents: number;
};

export type RivalHighlights = {
  /**
   * Opponent with the worst (most negative) ledger edge vs you.
   * Requires ≥ {@link MIN_RIVAL_NIGHTS_TOGETHER} shared nights and a negative edge.
   */
  biggestNemesis: RivalHighlight | null;
  /**
   * Opponent with the best (most positive) ledger edge vs you.
   * Requires ≥ {@link MIN_RIVAL_NIGHTS_TOGETHER} shared nights and a positive edge.
   */
  easyMoney: RivalHighlight | null;
};

/** Minimum shared game nights before Nemesis / Easy Money can be awarded. */
export const MIN_RIVAL_NIGHTS_TOGETHER = 2;

export type PlayerDashboardStats = {
  career: CareerPlayStats;
  headToHead: HeadToHeadRow[];
  rivals: RivalHighlights;
};

function emptyCareer(): CareerPlayStats {
  return {
    nightsPlayed: 0,
    sessionsPlayed: 0,
    wins: 0,
    itmCount: 0,
    handsDealt: 0,
    handsWon: 0,
    flopsSeenPercent: null,
    totalBuyInCents: 0,
    totalPayoutCents: 0,
    netLedgerCents: 0,
    ledgerRoiPercent: null,
    bestFinish: null,
    biggestPotChips: null,
  };
}

function toRivalHighlight(row: HeadToHeadRow): RivalHighlight {
  return {
    opponentUserId: row.opponentUserId,
    displayName: row.displayName,
    avatarUrl: row.avatarUrl,
    nightsTogether: row.nightsTogether,
    sessionsTogether: row.sessionsTogether,
    finishesAhead: row.finishesAhead,
    finishesBehind: row.finishesBehind,
    netLedgerEdgeCents: row.netLedgerEdgeCents,
  };
}

/**
 * Pick Biggest Nemesis (worst ledger edge) and Easy Money (best ledger edge)
 * among opponents with enough shared nights. Pure / testable.
 */
export function pickRivalHighlights(
  headToHead: HeadToHeadRow[],
  minNights: number = MIN_RIVAL_NIGHTS_TOGETHER
): RivalHighlights {
  const eligible = headToHead.filter((r) => r.nightsTogether >= minNights);

  let biggestNemesis: RivalHighlight | null = null;
  let easyMoney: RivalHighlight | null = null;

  for (const row of eligible) {
    if (row.netLedgerEdgeCents < 0) {
      if (
        !biggestNemesis ||
        row.netLedgerEdgeCents < biggestNemesis.netLedgerEdgeCents ||
        (row.netLedgerEdgeCents === biggestNemesis.netLedgerEdgeCents &&
          row.finishesBehind - row.finishesAhead >
            biggestNemesis.finishesBehind - biggestNemesis.finishesAhead)
      ) {
        biggestNemesis = toRivalHighlight(row);
      }
    }
    if (row.netLedgerEdgeCents > 0) {
      if (
        !easyMoney ||
        row.netLedgerEdgeCents > easyMoney.netLedgerEdgeCents ||
        (row.netLedgerEdgeCents === easyMoney.netLedgerEdgeCents &&
          row.finishesAhead - row.finishesBehind >
            easyMoney.finishesAhead - easyMoney.finishesBehind)
      ) {
        easyMoney = toRivalHighlight(row);
      }
    }
  }

  return { biggestNemesis, easyMoney };
}

/**
 * Aggregate career + head-to-head play stats from finished game rows.
 * Pure: invents nothing — missing funStats fields stay 0 / null.
 */
export function aggregatePlayerDashboardStats(
  userId: string,
  games: DashboardGameInput[]
): PlayerDashboardStats {
  const emptyRivals: RivalHighlights = {
    biggestNemesis: null,
    easyMoney: null,
  };
  const myGames = games.filter((g) =>
    g.results.some((r) => r.userId === userId)
  );

  if (myGames.length === 0) {
    return { career: emptyCareer(), headToHead: [], rivals: emptyRivals };
  }

  const nightIds = new Set<string>();
  let wins = 0;
  let itmCount = 0;
  let handsDealt = 0;
  let handsWon = 0;
  let flopsSeen = 0;
  let totalBuyInCents = 0;
  let totalPayoutCents = 0;
  let bestFinish: number | null = null;
  let biggestPotChips: number | null = null;

  type H2HAcc = {
    displayName: string;
    avatarUrl: string | null;
    nightIds: Set<string>;
    sessionsTogether: number;
    finishesAhead: number;
    finishesBehind: number;
    finishesTied: number;
    netLedgerEdgeCents: number;
    myHandsWon: number;
    theirHandsWon: number;
  };
  const h2h = new Map<string, H2HAcc>();

  for (const game of myGames) {
    const mine = game.results.find((r) => r.userId === userId)!;
    nightIds.add(game.tournamentId);
    totalBuyInCents += game.buyInCents;
    totalPayoutCents += mine.payoutCents;

    if (mine.finishPosition === 1 && !game.chopped) wins += 1;
    if (mine.payoutCents > 0 && !game.chopped) itmCount += 1;
    if (bestFinish === null || mine.finishPosition < bestFinish) {
      bestFinish = mine.finishPosition;
    }

    const fun = parseGameFunStats(game.funStats);
    const dealt = fun.handsDealtByUserId[userId] ?? 0;
    const won = fun.handsWonByUserId[userId] ?? 0;
    const flops = fun.flopsSeenByUserId[userId] ?? 0;
    handsDealt += dealt;
    handsWon += won;
    flopsSeen += flops;

    if (
      fun.largestPot &&
      fun.largestPot.winnerUserIds.includes(userId) &&
      (biggestPotChips === null ||
        fun.largestPot.amountChips > biggestPotChips)
    ) {
      biggestPotChips = fun.largestPot.amountChips;
    }

    const myNet = mine.payoutCents - game.buyInCents;

    for (const other of game.results) {
      if (other.userId === userId) continue;

      let row = h2h.get(other.userId);
      if (!row) {
        row = {
          displayName: other.displayName,
          avatarUrl: other.avatarUrl,
          nightIds: new Set(),
          sessionsTogether: 0,
          finishesAhead: 0,
          finishesBehind: 0,
          finishesTied: 0,
          netLedgerEdgeCents: 0,
          myHandsWon: 0,
          theirHandsWon: 0,
        };
        h2h.set(other.userId, row);
      } else {
        // Prefer a non-empty display name / avatar if later rows have them
        if (other.displayName) row.displayName = other.displayName;
        if (other.avatarUrl) row.avatarUrl = other.avatarUrl;
      }

      row.nightIds.add(game.tournamentId);
      row.sessionsTogether += 1;
      row.netLedgerEdgeCents +=
        myNet - (other.payoutCents - game.buyInCents);

      if (!game.chopped) {
        if (mine.finishPosition < other.finishPosition) row.finishesAhead += 1;
        else if (mine.finishPosition > other.finishPosition)
          row.finishesBehind += 1;
        else row.finishesTied += 1;
      }

      row.myHandsWon += fun.handsWonByUserId[userId] ?? 0;
      row.theirHandsWon += fun.handsWonByUserId[other.userId] ?? 0;
    }
  }

  const netLedgerCents = totalPayoutCents - totalBuyInCents;
  const ledgerRoiPercent =
    totalBuyInCents > 0
      ? Math.round((netLedgerCents / totalBuyInCents) * 100)
      : null;

  const career: CareerPlayStats = {
    nightsPlayed: nightIds.size,
    sessionsPlayed: myGames.length,
    wins,
    itmCount,
    handsDealt,
    handsWon,
    flopsSeenPercent:
      handsDealt > 0 ? Math.round((flopsSeen / handsDealt) * 100) : null,
    totalBuyInCents,
    totalPayoutCents,
    netLedgerCents,
    ledgerRoiPercent,
    bestFinish,
    biggestPotChips,
  };

  const headToHead: HeadToHeadRow[] = [...h2h.entries()]
    .map(([opponentUserId, row]) => ({
      opponentUserId,
      displayName: row.displayName,
      avatarUrl: row.avatarUrl,
      nightsTogether: row.nightIds.size,
      sessionsTogether: row.sessionsTogether,
      finishesAhead: row.finishesAhead,
      finishesBehind: row.finishesBehind,
      finishesTied: row.finishesTied,
      netLedgerEdgeCents: row.netLedgerEdgeCents,
      myHandsWon: row.myHandsWon,
      theirHandsWon: row.theirHandsWon,
    }))
    .sort((a, b) => {
      if (b.sessionsTogether !== a.sessionsTogether) {
        return b.sessionsTogether - a.sessionsTogether;
      }
      return (
        Math.abs(b.netLedgerEdgeCents) - Math.abs(a.netLedgerEdgeCents)
      );
    });

  return {
    career,
    headToHead,
    rivals: pickRivalHighlights(headToHead),
  };
}
