import { z } from "zod";

/** Seconds options for game-night action timers. 0 = timer off. */
export const ACTION_TIMER_SECONDS_OPTIONS = [0, 30, 45, 60, 90, 120] as const;
export type ActionTimerSeconds = (typeof ACTION_TIMER_SECONDS_OPTIONS)[number];

export const DEFAULT_ACTION_TIMER_SECONDS: ActionTimerSeconds = 60;

/** Personal nudge when this many seconds remain on the acting player's clock. */
export const ACTION_TIMER_NUDGE_SECONDS = 15;

export const ActionTimerSecondsSchema = z
  .number()
  .int()
  .refine(
    (n): n is ActionTimerSeconds =>
      (ACTION_TIMER_SECONDS_OPTIONS as readonly number[]).includes(n),
    { message: "Invalid action timer seconds" }
  );

export function resolveActionTimerSeconds(
  value: unknown
): ActionTimerSeconds {
  const parsed = ActionTimerSecondsSchema.safeParse(value);
  return parsed.success ? parsed.data : DEFAULT_ACTION_TIMER_SECONDS;
}

export function formatActionTimerLabel(seconds: number): string {
  if (seconds <= 0) return "Off";
  return `${seconds}s`;
}
