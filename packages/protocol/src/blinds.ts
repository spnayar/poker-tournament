import { z } from "zod";

export const BlindPaceSchema = z.enum(["gradual", "turbo", "hyper"]);
export type BlindPace = z.infer<typeof BlindPaceSchema>;

export const BlindLevelSchema = z.object({
  level: z.number().int().positive(),
  sb: z.number().int().positive(),
  bb: z.number().int().positive(),
});
export type BlindLevel = z.infer<typeof BlindLevelSchema>;

export const BLIND_LEVEL_MINUTE_OPTIONS = [8, 10, 12, 15, 20] as const;
export type BlindLevelMinutes = (typeof BLIND_LEVEL_MINUTE_OPTIONS)[number];

export const BLIND_PACE_LABELS: Record<
  BlindPace,
  { label: string; description: string }
> = {
  gradual: {
    label: "Gradual",
    description: "~50% increases — longer, strategic sessions",
  },
  turbo: {
    label: "Turbo",
    description: "~2× jumps — faster action",
  },
  hyper: {
    label: "Hyper",
    description: "~2.5× jumps — short, high-pressure games",
  },
};

const PACE_MULTIPLIERS: Record<BlindPace, number[]> = {
  gradual: [1, 1.5, 2, 3, 4, 6, 8, 10, 12, 15, 20, 25],
  turbo: [1, 2, 3, 5, 8, 12, 20, 30, 50],
  hyper: [1, 2.5, 5, 10, 20, 40, 80],
};

/** Round chip values to sensible poker increments. */
export function roundBlindAmount(amount: number): number {
  if (amount <= 0) return 1;
  if (amount <= 10) return Math.max(1, Math.round(amount));
  if (amount <= 100) return Math.round(amount / 5) * 5;
  if (amount <= 1000) return Math.round(amount / 25) * 25;
  return Math.round(amount / 50) * 50;
}

/** Build blind levels scaled to starting stack (level 1 BB ≈ 1% of chips). */
export function buildBlindLevels(
  startingChips: number,
  pace: BlindPace
): BlindLevel[] {
  const baseBb = roundBlindAmount(Math.max(2, startingChips / 100));
  const multipliers = PACE_MULTIPLIERS[pace];

  return multipliers.map((mult, index) => {
    const bb = roundBlindAmount(baseBb * mult);
    const sb = Math.max(1, Math.round(bb / 2));
    return { level: index + 1, sb, bb };
  });
}

export function getBlindLevelAt(
  levels: BlindLevel[],
  levelIndex: number
): BlindLevel {
  const idx = Math.max(0, Math.min(levelIndex, levels.length - 1));
  return levels[idx]!;
}

export function resolveBlindPace(
  blindPace?: string | null,
  blindPreset?: string | null
): BlindPace {
  const pace = BlindPaceSchema.safeParse(blindPace);
  if (pace.success) return pace.data;
  if (blindPreset === "turbo") return "turbo";
  if (blindPreset === "hyper") return "hyper";
  return "gradual";
}

export function resolveBlindLevels(
  startingChips: number,
  options: {
    blindLevels?: unknown;
    blindPace?: string | null;
    blindPreset?: string | null;
  }
): BlindLevel[] {
  if (Array.isArray(options.blindLevels) && options.blindLevels.length > 0) {
    const parsed = z.array(BlindLevelSchema).safeParse(options.blindLevels);
    if (parsed.success) return parsed.data;
  }
  const pace = resolveBlindPace(options.blindPace, options.blindPreset);
  return buildBlindLevels(startingChips, pace);
}

export const BlindTimerStateSchema = z.object({
  levelIndex: z.number().int().nonnegative(),
  levelNumber: z.number().int().positive(),
  levelEndsAt: z.number().nullable(),
  paused: z.boolean(),
  pausedRemainingMs: z.number().int().nonnegative().nullable(),
  increasePending: z.boolean(),
  currentSb: z.number().int().positive(),
  currentBb: z.number().int().positive(),
  nextSb: z.number().int().positive().nullable(),
  nextBb: z.number().int().positive().nullable(),
  levelDurationMs: z.number().int().positive(),
  hostUserId: z.string().optional(),
});
export type BlindTimerState = z.infer<typeof BlindTimerStateSchema>;
