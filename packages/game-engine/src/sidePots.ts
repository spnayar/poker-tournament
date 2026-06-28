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
      pots.push({ amount, eligibleSeatIds });
    }
    prevLevel = level;
  }

  return pots;
}

export function totalPotAmount(pots: PotLayer[]): number {
  return pots.reduce((sum, p) => sum + p.amount, 0);
}
