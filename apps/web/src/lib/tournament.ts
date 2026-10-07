import {
  BLIND_LEVEL_MINUTE_OPTIONS,
  defaultPayoutPercents,
  paidPlaceCount,
  payoutPercentsToFormFields,
  resolveBlindPace,
  resolveHostPayoutPercents,
  type BlindPace,
  type PaidPlaceCount,
} from "@poker/protocol";

export { defaultPayoutPercents };

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
  paidPlaces: PaidPlaceCount;
  payout1: string;
  payout2: string;
  payout3: string;
};

const PAYOUT_FIELD_KEYS = ["payout1", "payout2", "payout3"] as const;

/** Default 100% split for a paid-place count: 100 · 80/20 · 70/20/10. */
export function payoutFormForPaidPlaces(placeCount: PaidPlaceCount): {
  paidPlaces: PaidPlaceCount;
  payout1: string;
  payout2: string;
  payout3: string;
} {
  const [payout1, payout2, payout3] = payoutPercentsToFormFields(
    defaultPayoutPercents(placeCount)
  );
  return { paidPlaces: placeCount, payout1, payout2, payout3 };
}

/** Percents for the currently selected paid places (unused rows stay blank). */
export function payoutValuesForPaidPlaces(
  form: Pick<CreateGameNightForm, "paidPlaces" | "payout1" | "payout2" | "payout3">
): string[] {
  return PAYOUT_FIELD_KEYS.slice(0, form.paidPlaces).map((key) => form[key]);
}

function formatBuyInDollars(cents: number): string {
  const dollars = cents / 100;
  return Number.isInteger(dollars) ? String(dollars) : dollars.toFixed(2);
}

/** Defaults for the create form — reuses last hosted settings when available. */
export function createGameNightFormDefaults(
  lastHosted?: LastHostedDefaults | null
): CreateGameNightForm {
  const payouts = resolveHostPayoutPercents(lastHosted?.payoutPercents);
  const paidPlaces = paidPlaceCount(payouts);

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

  const [payout1, payout2, payout3] = payoutPercentsToFormFields(payouts);

  return {
    name: defaultTournamentName(),
    buyInDollars: formatBuyInDollars(lastHosted?.buyInCents ?? 2000),
    startingChips: String(lastHosted?.startingChips ?? 5000),
    maxPlayers: String(lastHosted?.maxPlayers ?? 9),
    blindPace,
    blindLevelMinutes,
    paidPlaces,
    payout1,
    payout2,
    payout3,
  };
}
