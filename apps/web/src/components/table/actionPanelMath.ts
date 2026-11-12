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

/**
 * Prefer an explicit big blind; otherwise fall back to legal min bet / min raise size.
 */
export function resolveBigBlind(
  legal: LegalActions,
  bigBlind?: number | null
): number {
  if (typeof bigBlind === "number" && Number.isFinite(bigBlind) && bigBlind > 0) {
    return Math.floor(bigBlind);
  }
  if (legal.canBet && legal.minBet > 0) return legal.minBet;
  if (legal.minRaise > 0) return legal.minRaise;
  if (legal.minBet > 0) return legal.minBet;
  return 1;
}

/**
 * BB-aligned chip denomination for +/- and the slider.
 * Picks the largest "nice" multiple of the big blind that keeps roughly
 * ~40 taps across the legal wager range (same density as the old stack/40
 * control, but always on clean chip denominations — never odd amounts).
 */
export function wagerChipStep(
  bigBlind: number,
  rangeMin: number,
  rangeMax: number
): number {
  const bb = Math.max(1, Math.floor(bigBlind) || 1);
  const span = Math.max(0, rangeMax - rangeMin);
  const target = Math.max(bb, span / 40);
  const multiples = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000];
  let step = bb;
  for (const m of multiples) {
    const candidate = bb * m;
    if (candidate <= target) step = candidate;
    else break;
  }
  return step;
}

/** Snap a wager onto the BB denomination grid, then clamp to the legal range. */
export function snapWagerAmount(
  amount: number,
  min: number,
  max: number,
  bigBlind: number
): number {
  if (max <= min) return min;
  const step = wagerChipStep(bigBlind, min, max);
  const snapped = Math.round(amount / step) * step;
  if (snapped < min) return min;
  if (snapped > max) return max;
  return snapped;
}

/**
 * Move one big-blind step up or down (classic table +/- UX).
 * Off-grid values (typed / odd leftovers) jump to the next BB multiple.
 * The slider uses {@link wagerChipStep} for coarser denominations.
 */
export function nudgeWagerAmount(
  current: number,
  direction: 1 | -1,
  min: number,
  max: number,
  bigBlind: number
): number {
  if (max <= min) return min;
  const bb = Math.max(1, Math.floor(bigBlind) || 1);
  if (direction > 0) {
    if (current % bb === 0) {
      return clamp(current + bb, min, max);
    }
    return clamp(Math.max(Math.ceil(current / bb) * bb, min), min, max);
  }
  if (current % bb === 0) {
    return clamp(current - bb, min, max);
  }
  return clamp(Math.min(Math.floor(current / bb) * bb, max), min, max);
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
 * Presets keep exact pot/multiplier math; +/- and the slider use the BB grid.
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
