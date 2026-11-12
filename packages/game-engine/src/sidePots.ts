import type { PotLayer } from "@poker/protocol";

export interface PlayerContribution {
  seatId: number;
  contribution: number;
  folded: boolean;
}

function sameEligibleSeats(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort((x, y) => x - y);
  const sb = [...b].sort((x, y) => x - y);
  return sa.every((id, i) => id === sb[i]);
}

/**
 * Merge adjacent pot layers that share the same eligible seats.
 * Folded shorter contributions create contribution levels, but they are not
 * real side pots — only all-ins with continuing bettors change eligibility.
 */
export function coalesceEligiblePots(pots: PotLayer[]): PotLayer[] {
  const out: PotLayer[] = [];
  for (const pot of pots) {
    const prev = out[out.length - 1];
    if (prev && sameEligibleSeats(prev.eligibleSeatIds, pot.eligibleSeatIds)) {
      prev.amount += pot.amount;
      const prevCount = prev.contributorCount ?? prev.eligibleSeatIds.length;
      const nextCount = pot.contributorCount ?? pot.eligibleSeatIds.length;
      prev.contributorCount = Math.max(prevCount, nextCount);
    } else {
      out.push({
        amount: pot.amount,
        eligibleSeatIds: [...pot.eligibleSeatIds],
        contributorCount: pot.contributorCount,
      });
    }
  }
  return out;
}

export function buildSidePots(players: PlayerContribution[]): PotLayer[] {
  const active = players.filter((p) => p.contribution > 0);
  if (active.length === 0) return [];

  const levels = [
    ...new Set(active.map((p) => p.contribution)),
  ].sort((a, b) => a - b);

  const pots: PotLayer[] = [];
  let prevLevel = 0;

  for (const level of levels) {
    const increment = level - prevLevel;
    const contributors = active.filter((p) => p.contribution >= level);
    const amount = increment * contributors.length;
    const eligibleSeatIds = contributors
      .filter((p) => !p.folded)
      .map((p) => p.seatId);

    if (amount > 0) {
      pots.push({
        amount,
        eligibleSeatIds,
        contributorCount: contributors.length,
      });
    }
    prevLevel = level;
  }

  return coalesceEligiblePots(pots);
}

export function totalPotAmount(pots: PotLayer[]): number {
  return pots.reduce((sum, p) => sum + p.amount, 0);
}

/**
 * Live-table labeling: layers with only one eligible seat are uncalled chips,
 * not a real side pot. Settlement still uses the full `buildSidePots` result
 * until showdown returns those chips separately.
 */
export function splitLivePots(pots: PotLayer[]): {
  pots: PotLayer[];
  uncalledAmount: number;
} {
  const matched: PotLayer[] = [];
  let uncalledAmount = 0;
  for (const pot of pots) {
    const contributors = pot.contributorCount ?? pot.eligibleSeatIds.length;
    if (contributors >= 2) {
      matched.push(pot);
    } else {
      uncalledAmount += pot.amount;
    }
  }
  return { pots: matched, uncalledAmount };
}

/** Single-contributor layers to return as uncalled (seat + amount). */
export function uncalledReturnsFromPots(
  pots: PotLayer[]
): { seatId: number; amount: number }[] {
  const returns: { seatId: number; amount: number }[] = [];
  for (const pot of pots) {
    const contributors = pot.contributorCount ?? pot.eligibleSeatIds.length;
    if (contributors >= 2) continue;
    const seatId = pot.eligibleSeatIds[0];
    if (seatId === undefined || pot.amount <= 0) continue;
    returns.push({ seatId, amount: pot.amount });
  }
  return returns;
}
