import {
  BLIND_LEVEL_MINUTE_OPTIONS,
  resolveBlindPace,
  type BlindPace,
} from "@poker/protocol";

export function defaultTournamentName(date = new Date()): string {
  const formatted = date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return `${formatted} Game Night`;
}

/** @deprecated use defaultTournamentName — kept for imports */
export const defaultGameNightName = defaultTournamentName;

export function defaultPayoutPercents(): number[] {
  return [50, 30, 20];
}

function toPositivePercents(values: (string | number)[]): number[] {
  return values
    .map((v) => (typeof v === "string" ? parseInt(v, 10) : v))
    .filter((n) => !Number.isNaN(n) && n > 0);
}

export function payoutPercentsSum(values: (string | number)[]): number {
  return toPositivePercents(values).reduce((a, b) => a + b, 0);
}

/** Returns an error message if invalid, or null if the split totals exactly 100%. */
export function validatePayoutPercents(
  values: (string | number)[]
): string | null {
  const nums = toPositivePercents(values);
  if (nums.length === 0) {
    return "Enter at least one payout percentage greater than 0.";
  }
  const sum = nums.reduce((a, b) => a + b, 0);
  if (sum > 100) {
    return `Payout total is ${sum}% — cannot exceed 100%.`;
  }
  if (sum < 100) {
    return `Payout total is ${sum}% — must equal 100%.`;
  }
  return null;
}

export function parsePayoutPercents(
  values: (string | number)[]
): number[] | null {
  if (validatePayoutPercents(values) !== null) return null;
  return toPositivePercents(values);
}

export interface LastHostedDefaults {
  buyInCents: number;
  startingChips: number;
  maxPlayers: number;
  blindPace: string;
  blindPreset: string;
  blindLevelMinutes: number;
  payoutPercents: number[];
}

export type CreateGameNightForm = {
  name: string;
  buyInDollars: string;
  startingChips: string;
  maxPlayers: string;
  blindPace: BlindPace;
  blindLevelMinutes: number;
  payout1: string;
  payout2: string;
  payout3: string;
};

function formatBuyInDollars(cents: number): string {
  const dollars = cents / 100;
  return Number.isInteger(dollars) ? String(dollars) : dollars.toFixed(2);
}

/** Defaults for the create form — reuses last hosted settings when available. */
export function createGameNightFormDefaults(
  lastHosted?: LastHostedDefaults | null
): CreateGameNightForm {
  const payouts =
    lastHosted?.payoutPercents?.length &&
    validatePayoutPercents(lastHosted.payoutPercents) === null
      ? lastHosted.payoutPercents
      : defaultPayoutPercents();

  const blindPace = resolveBlindPace(
    lastHosted?.blindPace,
    lastHosted?.blindPreset
  );
  const blindLevelMinutes =
    lastHosted &&
    (BLIND_LEVEL_MINUTE_OPTIONS as readonly number[]).includes(
      lastHosted.blindLevelMinutes
    )
      ? lastHosted.blindLevelMinutes
      : 12;

  return {
    name: defaultTournamentName(),
    buyInDollars: formatBuyInDollars(lastHosted?.buyInCents ?? 2000),
    startingChips: String(lastHosted?.startingChips ?? 5000),
    maxPlayers: String(lastHosted?.maxPlayers ?? 9),
    blindPace,
    blindLevelMinutes,
    payout1: String(payouts[0] ?? 50),
    payout2: String(payouts[1] ?? 30),
    payout3: String(payouts[2] ?? 20),
  };
}
