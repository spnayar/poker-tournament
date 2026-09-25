import type { PotLayer } from "@poker/protocol";

export interface PlayerContribution {
  seatId: number;
  contribution: number;
  folded: boolean;
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

  return pots;
}

export function totalPotAmount(pots: PotLayer[]): number {
  return pots.reduce((sum, p) => sum + p.amount, 0);
}

/**
 * Live-table labeling: layers with only one eligible seat are uncalled chips,
 * not a real side pot. Settlement still uses the full `buildSidePots` result.
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
