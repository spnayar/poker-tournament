import { z } from "zod";

export const CardSchema = z.string().regex(/^[2-9TJQKA][cdhs]$/);
export type Card = z.infer<typeof CardSchema>;

export const PlayerActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("fold") }),
  z.object({ type: z.literal("check") }),
  z.object({ type: z.literal("call") }),
  z.object({
    type: z.literal("bet"),
    amount: z.number().int().positive(),
  }),
  z.object({
    type: z.literal("raise"),
    amount: z.number().int().positive(),
  }),
  z.object({ type: z.literal("all-in") }),
]);
export type PlayerAction = z.infer<typeof PlayerActionSchema>;

export const PotLayerSchema = z.object({
  amount: z.number().int().nonnegative(),
  eligibleSeatIds: z.array(z.number()),
});
export type PotLayer = z.infer<typeof PotLayerSchema>;

export const SeatPublicSchema = z.object({
  seatId: z.number(),
  userId: z.string(),
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
  chipCount: z.number().int().nonnegative(),
  betThisRound: z.number().int().nonnegative(),
  totalBet: z.number().int().nonnegative(),
  folded: z.boolean(),
  allIn: z.boolean(),
  isDealer: z.boolean(),
  isSmallBlind: z.boolean(),
  isBigBlind: z.boolean(),
  lastAction: z.string().nullable(),
});
export type SeatPublic = z.infer<typeof SeatPublicSchema>;

export const ActionLogEntrySchema = z.object({
  id: z.number(),
  seatId: z.number(),
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
  action: z.string(),
  street: z.string(),
  handNumber: z.number(),
  /** Community cards dealt on flop/turn/river (seatId -2). */
  cards: z.array(CardSchema).optional(),
});
export type ActionLogEntry = z.infer<typeof ActionLogEntrySchema>;

export const TablePhaseSchema = z.enum([
  "waiting",
  "dealing",
  "preflop",
  "flop",
  "turn",
  "river",
  "showdown",
  "hand-complete",
  "tournament-complete",
]);
export type TablePhase = z.infer<typeof TablePhaseSchema>;

export const TableStateSchema = z.object({
  tournamentId: z.string(),
  phase: TablePhaseSchema,
  board: z.array(CardSchema),
  pots: z.array(PotLayerSchema),
  totalPot: z.number().int().nonnegative(),
  seats: z.array(SeatPublicSchema),
  dealerSeat: z.number(),
  currentActorSeat: z.number().nullable(),
  /** Seat that may start the next hand (set when phase is hand-complete / showdown). */
  nextDealerSeat: z.number().nullable().optional(),
  smallBlind: z.number(),
  bigBlind: z.number(),
  blindLevel: z.number(),
  handNumber: z.number(),
  actionLog: z.array(ActionLogEntrySchema),
});
export type TableState = z.infer<typeof TableStateSchema>;

export const LegalActionsSchema = z.object({
  canFold: z.boolean(),
  canCheck: z.boolean(),
  canCall: z.boolean(),
  callAmount: z.number().int().nonnegative(),
  canBet: z.boolean(),
  minBet: z.number().int().nonnegative(),
  canRaise: z.boolean(),
  minRaise: z.number().int().nonnegative(),
  minRaiseTo: z.number().int().nonnegative(),
  maxRaise: z.number().int().nonnegative(),
  canAllIn: z.boolean(),
  allInAmount: z.number().int().nonnegative(),
});
export type LegalActions = z.infer<typeof LegalActionsSchema>;

export const ServerEvents = {
  TABLE_STATE: "table:state",
  PLAYER_CARDS: "player:cards",
  ACTION_REQUIRED: "action:required",
  HAND_RESULT: "hand:result",
  ANIM_DEAL: "anim:deal",
  ANIM_REVEAL: "anim:reveal",
  ANIM_CHIPS: "anim:chips",
  TOURNAMENT_FINISHED: "tournament:finished",
  GAME_FINISHED: "game:finished",
  GAME_STARTED: "game:started",
  ERROR: "error",
} as const;

export const ClientEvents = {
  JOIN_TOURNAMENT: "tournament:join",
  WATCH_TOURNAMENT: "tournament:watch",
  ACTION: "player:action",
  RECONNECT: "player:reconnect",
  START_NEXT_HAND: "hand:start-next",
} as const;

export const AnimDealSchema = z.object({
  seatOrder: z.array(z.number()),
  cardIndex: z.number(),
});
export type AnimDeal = z.infer<typeof AnimDealSchema>;

export const AnimRevealSchema = z.object({
  slot: z.number(),
  card: CardSchema,
  street: z.enum(["flop", "turn", "river"]),
});
export type AnimReveal = z.infer<typeof AnimRevealSchema>;

export const AnimChipsSchema = z.object({
  fromSeat: z.number().nullable(),
  toSeat: z.number().nullable(),
  toPot: z.boolean(),
  amount: z.number().int().positive(),
});
export type AnimChips = z.infer<typeof AnimChipsSchema>;

export const ShownHandSchema = z.object({
  seatId: z.number(),
  holeCards: z.array(CardSchema),
  bestHand: z.array(CardSchema),
});
export type ShownHand = z.infer<typeof ShownHandSchema>;

export const HandResultSchema = z.object({
  handNumber: z.number().int().nonnegative().optional(),
  winners: z.array(
    z.object({
      seatId: z.number(),
      displayName: z.string(),
      avatarUrl: z.string().nullable(),
      amount: z.number(),
      potIndex: z.number(),
      handName: z.string().optional(),
      wonByFold: z.boolean().optional(),
    })
  ),
  shownCards: z.array(ShownHandSchema),
  totalAwarded: z.number().int().nonnegative(),
});
export type HandResult = z.infer<typeof HandResultSchema>;

export const GameFinishedSchema = z.object({
  gameId: z.string(),
  gameNumber: z.number().int().positive(),
  buyInCents: z.number().int().nonnegative(),
  hostUserId: z.string(),
  finishOrder: z.array(
    z.object({
      userId: z.string(),
      position: z.number().int().positive(),
      payoutCents: z.number().int().nonnegative(),
      displayName: z.string(),
    })
  ),
  prizePoolCents: z.number().int().nonnegative(),
});
export type GameFinished = z.infer<typeof GameFinishedSchema>;

export const GameStartedSchema = z.object({
  gameId: z.string(),
  gameNumber: z.number().int().positive(),
});
export type GameStarted = z.infer<typeof GameStartedSchema>;

export const PayoutPresets: Record<number, number[]> = {
  2: [1.0],
  3: [0.65, 0.35],
  4: [0.5, 0.3, 0.2],
  5: [0.45, 0.28, 0.18, 0.09],
  6: [0.5, 0.3, 0.2],
  7: [0.45, 0.28, 0.18, 0.09],
  8: [0.42, 0.26, 0.17, 0.1, 0.05],
  9: [0.4, 0.25, 0.18, 0.1, 0.07],
};

export function getPayoutPercentages(playerCount: number): number[] {
  if (playerCount <= 1) return [1.0];
  if (playerCount >= 9) return PayoutPresets[9]!;
  return PayoutPresets[playerCount] ?? PayoutPresets[6]!;
}

export function computePayouts(
  prizePoolCents: number,
  playerCount: number
): number[] {
  const pcts = getPayoutPercentages(playerCount);
  const payouts = pcts.map((pct) => Math.floor(prizePoolCents * pct));
  const remainder = prizePoolCents - payouts.reduce((a, b) => a + b, 0);
  if (payouts.length > 0) payouts[0]! += remainder;
  return payouts;
}

/** Compute place payouts from host-configured percentages (e.g. [50, 30, 20]). */
export function computePayoutsFromPercents(
  prizePoolCents: number,
  payoutPercents: number[],
  playerCount: number
): number[] {
  if (playerCount <= 0 || payoutPercents.length === 0) return [];
  const places = Math.min(payoutPercents.length, playerCount);
  const raw = payoutPercents.slice(0, places);
  const sum = raw.reduce((a, b) => a + b, 0);
  if (sum <= 0) return [];
  const normalized = raw.map((p) => p / sum);
  const payouts = normalized.map((pct) => Math.floor(prizePoolCents * pct));
  const remainder = prizePoolCents - payouts.reduce((a, b) => a + b, 0);
  if (payouts.length > 0) payouts[0]! += remainder;
  return payouts;
}

export interface NightLedgerEntry {
  userId: string;
  displayName: string;
  gamesPlayed: number;
  totalBuyInCents: number;
  totalPayoutCents: number;
  netCents: number;
}

/** Ensure recorded payouts sum to the prize pool (remainder to non-winners). */
export function normalizeGamePayouts(
  prizePoolCents: number,
  results: {
    userId: string;
    finishPosition: number;
    payoutCents: number;
  }[],
  rosterUserIds: string[]
): { userId: string; payoutCents: number }[] {
  const rows = rosterUserIds.map((userId) => {
    const result = results.find((r) => r.userId === userId);
    return {
      userId,
      finishPosition: result?.finishPosition ?? rosterUserIds.length,
      payoutCents: result?.payoutCents ?? 0,
    };
  });

  let total = rows.reduce((sum, row) => sum + row.payoutCents, 0);
  const remainder = prizePoolCents - total;
  if (remainder > 0) {
    const nonWinners = rows
      .filter((row) => row.finishPosition > 1)
      .sort((a, b) => b.finishPosition - a.finishPosition);
    if (nonWinners.length > 0) {
      nonWinners[0]!.payoutCents += remainder;
    } else {
      const winner = rows.find((row) => row.finishPosition === 1);
      if (winner) winner.payoutCents += remainder;
    }
  }

  return rows.map((row) => ({
    userId: row.userId,
    payoutCents: row.payoutCents,
  }));
}

export function computeNightLedger(
  buyInCents: number,
  roster: { userId: string; displayName: string }[],
  gamePayouts: { userId: string; payoutCents: number }[][]
): NightLedgerEntry[] {
  const finishedGameCount = gamePayouts.length;
  const byUser = new Map(
    roster.map((p) => [
      p.userId,
      {
        displayName: p.displayName,
        totalPayoutCents: 0,
      },
    ])
  );

  for (const game of gamePayouts) {
    for (const row of game) {
      const existing = byUser.get(row.userId);
      if (existing) {
        existing.totalPayoutCents += row.payoutCents;
      }
    }
  }

  return roster
    .map((p) => {
      const data = byUser.get(p.userId)!;
      const totalBuyInCents = buyInCents * finishedGameCount;
      return {
        userId: p.userId,
        displayName: data.displayName,
        gamesPlayed: finishedGameCount,
        totalBuyInCents,
        totalPayoutCents: data.totalPayoutCents,
        netCents: data.totalPayoutCents - totalBuyInCents,
      };
    })
    .sort((a, b) => b.netCents - a.netCents);
}
