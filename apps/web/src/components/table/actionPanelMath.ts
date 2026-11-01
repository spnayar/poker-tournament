import type { LegalActions } from "@poker/protocol";

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Derive table current bet and this player's contribution from legal actions. */
export function getBetContext(legal: LegalActions): {
  currentBet: number;
  betThisRound: number;
} {
  const betThisRound = legal.maxRaise - legal.allInAmount;
  const currentBet = legal.canCall
    ? legal.callAmount + betThisRound
    : legal.canBet
      ? legal.minBet
      : Math.max(betThisRound, legal.minRaiseTo - legal.minRaise);
  return { currentBet, betThisRound };
}

export function wagerTargetForMultiplier(
  legal: LegalActions,
  multiplier: number
): number | null {
  const { currentBet } = getBetContext(legal);

  if (legal.canBet) {
    const amount = clamp(currentBet * multiplier, legal.minBet, legal.allInAmount);
    return amount >= legal.minBet ? amount : null;
  }

  if (!legal.canRaise) return null;

  const raiseTo = clamp(
    currentBet * multiplier,
    legal.minRaiseTo,
    legal.maxRaise
  );
  return raiseTo >= legal.minRaiseTo ? raiseTo : null;
}

/**
 * Pot-sized wager target.
 * - Opening bet: bet the pot (clamped to legal range).
 * - Raise: raise-to = currentBet + pot + callAmount (standard pot raise).
 */
export function potWagerTarget(
  legal: LegalActions,
  totalPot: number
): number | null {
  const pot = Math.max(0, totalPot);

  if (legal.canBet) {
    const amount = clamp(Math.max(pot, legal.minBet), legal.minBet, legal.allInAmount);
    return amount >= legal.minBet ? amount : null;
  }

  if (!legal.canRaise) return null;

  const { currentBet } = getBetContext(legal);
  const callAmount = legal.canCall ? legal.callAmount : 0;
  const raiseTo = clamp(
    currentBet + pot + callAmount,
    legal.minRaiseTo,
    legal.maxRaise
  );
  return raiseTo >= legal.minRaiseTo ? raiseTo : null;
}
