import { z } from "zod";

export const ChopShareSchema = z.object({
  userId: z.string().min(1),
  payoutCents: z.number().int().nonnegative(),
});

/** Host ends the running tournament with an agreed ledger split. */
export const ChopTournamentSchema = z.object({
  shares: z.array(ChopShareSchema).min(2).max(22),
  confirm: z.literal(true),
});
export type ChopTournamentPayload = z.infer<typeof ChopTournamentSchema>;

export interface ChopFinishRow {
  userId: string;
  position: number;
  payoutCents: number;
}

/** Parse a dollar field into ledger cents. Rejects blanks and more than two decimals. */
export function parseLedgerAmountToCents(raw: string): number | null {
  const trimmed = raw.trim().replace(/^\$/, "").replace(/,/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  const [whole, frac = ""] = trimmed.split(".");
  const cents = Number(whole) * 100 + Number((frac + "00").slice(0, 2));
  if (!Number.isSafeInteger(cents)) return null;
  return cents;
}

/**
 * Split the prize pool in proportion to chip counts.
 * Leftover cents go one at a time to the largest stacks.
 */
export function chipProportionalPayouts(
  players: { userId: string; chipCount: number }[],
  prizePoolCents: number
): { userId: string; payoutCents: number }[] {
  if (players.length === 0 || prizePoolCents < 0) return [];
  const weights = players.map((player) => Math.max(0, player.chipCount));
  const totalChips = weights.reduce((sum, chips) => sum + chips, 0);
  const payouts = players.map((player, index) => {
    const share =
      totalChips === 0
        ? Math.floor(prizePoolCents / players.length)
        : Math.floor((prizePoolCents * weights[index]!) / totalChips);
    return { userId: player.userId, payoutCents: share };
  });
  let remainder =
    prizePoolCents - payouts.reduce((sum, row) => sum + row.payoutCents, 0);
  const order = players
    .map((player, index) => ({ index, player }))
    .sort(
      (a, b) =>
        b.player.chipCount - a.player.chipCount ||
        a.player.userId.localeCompare(b.player.userId)
    );
  let cursor = 0;
  while (remainder > 0 && order.length > 0) {
    payouts[order[cursor % order.length]!.index]!.payoutCents += 1;
    remainder -= 1;
    cursor += 1;
  }
  return payouts;
}

export function validateChopShares(input: {
  prizePoolCents: number;
  remainingUserIds: string[];
  shares: { userId: string; payoutCents: number }[];
}): { ok: true } | { ok: false; error: string } {
  if (input.remainingUserIds.length < 2) {
    return { ok: false, error: "At least two players need chips to chop" };
  }
  if (input.shares.length !== input.remainingUserIds.length) {
    return {
      ok: false,
      error: "Set an amount for every player who still has chips",
    };
  }
  const expected = new Set(input.remainingUserIds);
  const seen = new Set<string>();
  let total = 0;
  for (const share of input.shares) {
    if (!Number.isInteger(share.payoutCents) || share.payoutCents < 0) {
      return { ok: false, error: "Amounts must be zero or more" };
    }
    if (!expected.has(share.userId) || seen.has(share.userId)) {
      return { ok: false, error: "Chop can only include players who still have chips" };
    }
    seen.add(share.userId);
    total += share.payoutCents;
  }
  if (seen.size !== expected.size) {
    return {
      ok: false,
      error: "Set an amount for every player who still has chips",
    };
  }
  if (total !== input.prizePoolCents) {
    return {
      ok: false,
      error: "The split has to equal the total buy-in for this tournament",
    };
  }
  return { ok: true };
}

/**
 * Remaining players place by agreed payout, then chip count.
 * Eliminated players follow, last bust first. Unknown busts go last.
 * `bustIndex` is the elimination order index, or -1 if the player never busted on the table.
 */
export function rankChopFinish(input: {
  remaining: { userId: string; chipCount: number; payoutCents: number }[];
  eliminated: { userId: string; bustIndex: number }[];
}): ChopFinishRow[] {
  const remaining = [...input.remaining].sort(
    (a, b) =>
      b.payoutCents - a.payoutCents ||
      b.chipCount - a.chipCount ||
      a.userId.localeCompare(b.userId)
  );
  const eliminated = [...input.eliminated].sort((a, b) => {
    if (a.bustIndex < 0 && b.bustIndex < 0) {
      return a.userId.localeCompare(b.userId);
    }
    if (a.bustIndex < 0) return 1;
    if (b.bustIndex < 0) return -1;
    return b.bustIndex - a.bustIndex;
  });
  const rows: ChopFinishRow[] = [];
  for (const player of remaining) {
    rows.push({
      userId: player.userId,
      position: rows.length + 1,
      payoutCents: player.payoutCents,
    });
  }
  for (const player of eliminated) {
    rows.push({
      userId: player.userId,
      position: rows.length + 1,
      payoutCents: 0,
    });
  }
  return rows;
}
