export function defaultTournamentName(date = new Date()): string {
  const formatted = date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return `${formatted} Poker`;
}

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
