/** UTC calendar day at 00:00:00.000Z. */
export function utcDay(d: Date = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** First UTC day of the month. */
export function utcMonth(d: Date = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

export function utcDayKey(d: Date): string {
  return utcDay(d).toISOString().slice(0, 10);
}

export function utcMonthKey(d: Date): string {
  return utcMonth(d).toISOString().slice(0, 7);
}
