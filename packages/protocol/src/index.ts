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
  /** How many players put money into this layer (includes folders). */
  contributorCount: z.number().int().positive().optional(),
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
  /** Host/AFK sit-out: still posts blinds, auto check/fold when facing action. */
  skipped: z.boolean(),
  /** True while the player's live socket is gone (disconnected / dropped). */
  away: z.boolean().optional().default(false),
  /** Why the seat is sitting out. Host sits survive reconnect; others resume. */
  skipReason: z
    .enum(["host", "disconnect", "timeout"])
    .nullable()
    .optional()
    .default(null),
  isDealer: z.boolean(),
  isSmallBlind: z.boolean(),
  isBigBlind: z.boolean(),
  lastAction: z.string().nullable(),
});
export type SeatPublic = z.infer<typeof SeatPublicSchema>;
export type SkipReason = NonNullable<SeatPublic["skipReason"]>;

/** Disconnect and action-timeout sits resume on reconnect; host sits do not. */
export function shouldResumeOnReconnect(
  reason: SkipReason | null | undefined
): boolean {
  return reason !== "host";
}

/** Away is keyed by that seat's userId, never by who is to act. */
export function applySocketAwayFlags<T extends { userId: string }>(
  seats: T[],
  seenUserIds: Iterable<string>,
  connectedUserIds: Iterable<string>
): (T & { away: boolean })[] {
  const seen = seenUserIds instanceof Set ? seenUserIds : new Set(seenUserIds);
  const connected =
    connectedUserIds instanceof Set ? connectedUserIds : new Set(connectedUserIds);
  return seats.map((seat) => ({
    ...seat,
    away: seen.has(seat.userId) && !connected.has(seat.userId),
  }));
}

export function awayDisplayNames(
  seats: Array<{ displayName: string; away?: boolean }>
): string[] {
  return seats.filter((s) => s.away).map((s) => s.displayName);
}

/** Banner copy for disconnected seats. Null when nobody is away. */
export function formatAwayBanner(names: string[]): string | null {
  if (names.length === 0) return null;
  if (names.length === 1) return `${names[0]} is away…`;
  if (names.length === 2) return `${names[0]} and ${names[1]} are away…`;
  const rest = names.slice(0, -1).join(", ");
  return `${rest}, and ${names[names.length - 1]} are away…`;
}

export function formatActorWaitingLabel(opts: {
  isViewerActor: boolean;
  actorName: string | null;
  actorAway?: boolean;
  actorSkipped?: boolean;
}): string {
  if (opts.isViewerActor) {
    return "Your turn — waiting for action buttons…";
  }
  if (!opts.actorName) {
    return "Waiting for other players...";
  }
  if (opts.actorAway) {
    return `${opts.actorName} is away…`;
  }
  if (opts.actorSkipped) {
    return `Waiting for ${opts.actorName} (sitting out)…`;
  }
  return `Waiting for ${opts.actorName}…`;
}

/** Host Skip vs Unskip: Unskip any sat-out seat, including disconnect/timeout. */
export function hostSeatControl(
  seat: { skipped: boolean }
): "skip" | "unskip" {
  return seat.skipped ? "unskip" : "skip";
}

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
  /** Uncalled chips not labeled as a side pot (live betting only). */
  uncalledAmount: z.number().int().nonnegative().optional(),
  /** Monotonic broadcast id so clients ignore stale TABLE_STATE. */
  syncSeq: z.number().int().nonnegative().optional(),
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
  /** Epoch ms when the current actor's turn times out (server-owned). */
  actionDeadlineAt: z.number().int().nullable().optional(),
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
  BLIND_TIMER: "blind:timer",
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
  PAUSE_BLIND_TIMER: "blind:pause",
  RESUME_BLIND_TIMER: "blind:resume",
  ADVANCE_BLIND_LEVEL: "blind:advance",
  SKIP_PLAYER: "player:skip",
  UNSKIP_PLAYER: "player:unskip",
} as const;

export const SeatIdPayloadSchema = z.object({
  seatId: z.number().int().nonnegative(),
});
export type SeatIdPayload = z.infer<typeof SeatIdPayloadSchema>;

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
      avatarUrl: z.string().nullable().optional(),
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

/**
 * Host-configured integer percent splits for 1–3 paying places.
 * Each split sums to 100 so the create-night form can submit as-is.
 */
export const DEFAULT_PAYOUT_PERCENTS_BY_PLACES: Record<number, readonly number[]> =
  {
    1: [100],
    2: [80, 20],
    3: [70, 20, 10],
  };

export type PaidPlaceCount = 1 | 2 | 3;

export function defaultPayoutPercents(placeCount = 3): number[] {
  const n = Math.min(Math.max(Math.trunc(placeCount) || 3, 1), 3);
  return [...DEFAULT_PAYOUT_PERCENTS_BY_PLACES[n]!];
}

/** How many paying places a host split uses (blank/zero percents do not count). */
export function paidPlaceCount(payouts: number[]): PaidPlaceCount {
  const n = payouts.filter((v) => Number.isFinite(v) && v > 0).length;
  if (n <= 1) return 1;
  if (n === 2) return 2;
  return 3;
}

/**
 * Map a paying-place split onto the three create-form fields.
 * Unused places stay empty so a 2-place 80/20 is not padded to 80/20/20.
 */
export function payoutPercentsToFormFields(
  payouts: number[]
): [string, string, string] {
  return [
    payouts[0] != null ? String(payouts[0]) : "",
    payouts[1] != null ? String(payouts[1]) : "",
    payouts[2] != null ? String(payouts[2]) : "",
  ];
}

/** Reuse a last-hosted split only when it already totals 100%; otherwise the 3-place default. */
export function resolveHostPayoutPercents(
  lastHostedPercents?: number[] | null
): number[] {
  if (!lastHostedPercents?.length) return defaultPayoutPercents();
  const positive = lastHostedPercents.filter(
    (n) => Number.isFinite(n) && n > 0
  );
  const sum = positive.reduce((a, b) => a + b, 0);
  if (positive.length > 0 && sum === 100) return positive;
  return defaultPayoutPercents();
}

/** Compute place payouts from host-configured percentages (e.g. [70, 20, 10]). */
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

export interface SettleTransfer {
  fromUserId: string;
  fromDisplayName: string;
  toUserId: string;
  toDisplayName: string;
  amountCents: number;
}

/**
 * Minimal pairwise settle plan from night ledger nets (ledger cents only).
 * Debtors pay creditors until nets clear. Does not move real money.
 */
export function computeSettleTransfers(
  ledger: NightLedgerEntry[]
): SettleTransfer[] {
  const debtors = ledger
    .filter((r) => r.netCents < 0)
    .map((r) => ({
      userId: r.userId,
      displayName: r.displayName,
      remaining: -r.netCents,
    }))
    .sort((a, b) => b.remaining - a.remaining);
  const creditors = ledger
    .filter((r) => r.netCents > 0)
    .map((r) => ({
      userId: r.userId,
      displayName: r.displayName,
      remaining: r.netCents,
    }))
    .sort((a, b) => b.remaining - a.remaining);

  const transfers: SettleTransfer[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i]!;
    const creditor = creditors[j]!;
    const amount = Math.min(debtor.remaining, creditor.remaining);
    if (amount > 0) {
      transfers.push({
        fromUserId: debtor.userId,
        fromDisplayName: debtor.displayName,
        toUserId: creditor.userId,
        toDisplayName: creditor.displayName,
        amountCents: amount,
      });
      debtor.remaining -= amount;
      creditor.remaining -= amount;
    }
    if (debtor.remaining <= 0) i += 1;
    if (creditor.remaining <= 0) j += 1;
  }
  return transfers;
}

export const SETTLE_UP_PROVIDERS = [
  "PAYPAL",
  "VENMO",
  "CASH_APP",
  "APPLE_PAY",
  "ZELLE",
] as const;

export type SettleUpProvider = (typeof SETTLE_UP_PROVIDERS)[number];

export const SettleUpMethodSchema = z.object({
  provider: z.enum(SETTLE_UP_PROVIDERS),
  contact: z.string().trim().min(1).max(128),
});

export type SettleUpMethod = z.infer<typeof SettleUpMethodSchema>;

export const SettleUpMethodsSchema = z
  .array(SettleUpMethodSchema)
  .max(SETTLE_UP_PROVIDERS.length)
  .superRefine((methods, ctx) => {
    const seen = new Set<string>();
    for (let i = 0; i < methods.length; i += 1) {
      const provider = methods[i]!.provider;
      if (seen.has(provider)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate provider: ${provider}`,
          path: [i, "provider"],
        });
      }
      seen.add(provider);
    }
  });

/** Parse stored JSON; invalid / empty → []. */
export function parseSettleUpMethods(raw: unknown): SettleUpMethod[] {
  const parsed = SettleUpMethodsSchema.safeParse(raw);
  return parsed.success ? parsed.data : [];
}

/** Persisted per-game fun facts for night recap (user-keyed; showdown cards only). */
export const GameFunStatsSchema = z.object({
  handsWonByUserId: z.record(z.string(), z.number().int().nonnegative()),
  knockoutsByUserId: z.record(z.string(), z.number().int().nonnegative()),
  largestPot: z
    .object({
      amountChips: z.number().int().nonnegative(),
      winnerUserIds: z.array(z.string()),
      handNumber: z.number().int().nonnegative(),
    })
    .nullable(),
  bestHand: z
    .object({
      userId: z.string(),
      handName: z.string(),
      cards: z.array(CardSchema).length(5),
      handNumber: z.number().int().nonnegative(),
    })
    .nullable(),
});

export type GameFunStats = z.infer<typeof GameFunStatsSchema>;

export function emptyGameFunStats(): GameFunStats {
  return {
    handsWonByUserId: {},
    knockoutsByUserId: {},
    largestPot: null,
    bestHand: null,
  };
}

/** Parse stored Game.funStats JSON; invalid → empty. */
export function parseGameFunStats(raw: unknown): GameFunStats {
  const parsed = GameFunStatsSchema.safeParse(raw);
  return parsed.success ? parsed.data : emptyGameFunStats();
}

export * from "./blinds";
