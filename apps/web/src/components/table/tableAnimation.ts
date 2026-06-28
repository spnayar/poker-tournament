/** Seconds between each hole card dealt to a player. */
export const HOLE_CARD_DELAY_SEC = 0.45;

/** Seconds between each flop card when the flop is revealed (normal betting). */
export const FLOP_CARD_STAGGER_SEC = 1.1;

/** Seconds before a single turn or river card (normal betting). */
export const STREET_CARD_STAGGER_SEC = 0.9;

/** Seconds between flop cards during an all-in runout (preflop shove). */
export const RUNOUT_FLOP_CARD_STAGGER_SEC = 2.4;

/** Pause after the flop before turn during an all-in runout. */
export const RUNOUT_FLOP_PAUSE_SEC = 3.0;

/** Pause before turn/river (or river-only) during an all-in runout. */
export const RUNOUT_STREET_DELAY_SEC = 3.0;

/** Seconds between turn and river during an all-in runout. */
export const RUNOUT_CARD_STAGGER_SEC = 5.0;

/** Community card flip animation duration (seconds). */
export const COMMUNITY_FLIP_DURATION_SEC = 1.1;

/** Hole card deal animation duration (seconds). */
export const HOLE_CARD_DEAL_DURATION_SEC = 0.5;

/** Brief pause after the last community card before showing hand result. */
export const POST_REVEAL_PAUSE_MS = 800;

/**
 * Schedule (ms from now) when each new board slot should appear.
 * Returns entries sorted by slot index.
 */
export function getBoardRevealSchedule(
  prevLength: number,
  nextBoard: string[]
): { slot: number; delayMs: number }[] {
  const nextLength = nextBoard.length;
  if (nextLength <= prevLength) return [];

  const ms = (sec: number) => Math.round(sec * 1000);

  // Full board runout (e.g. preflop all-in): flop one-by-one, pause, turn, river slowly.
  if (prevLength === 0 && nextLength === 5) {
    return [
      { slot: 0, delayMs: 0 },
      { slot: 1, delayMs: ms(RUNOUT_FLOP_CARD_STAGGER_SEC) },
      { slot: 2, delayMs: ms(RUNOUT_FLOP_CARD_STAGGER_SEC * 2) },
      {
        slot: 3,
        delayMs: ms(
          RUNOUT_FLOP_CARD_STAGGER_SEC * 3 + RUNOUT_FLOP_PAUSE_SEC
        ),
      },
      {
        slot: 4,
        delayMs: ms(
          RUNOUT_FLOP_CARD_STAGGER_SEC * 3 +
            RUNOUT_FLOP_PAUSE_SEC +
            RUNOUT_CARD_STAGGER_SEC
        ),
      },
    ];
  }

  // Turn + river runout (board jumps 3 → 5, e.g. flop all-in).
  if (prevLength === 3 && nextLength === 5) {
    return [
      { slot: 3, delayMs: ms(RUNOUT_STREET_DELAY_SEC) },
      {
        slot: 4,
        delayMs: ms(RUNOUT_STREET_DELAY_SEC + RUNOUT_CARD_STAGGER_SEC),
      },
    ];
  }

  // River-only runout (board jumps 4 → 5, e.g. turn all-in).
  if (prevLength === 4 && nextLength === 5) {
    return [{ slot: 4, delayMs: ms(RUNOUT_STREET_DELAY_SEC) }];
  }

  const newCount = nextLength - prevLength;
  const isFlop = prevLength === 0 && newCount === 3;
  const staggerSec = isFlop
    ? FLOP_CARD_STAGGER_SEC
    : STREET_CARD_STAGGER_SEC;

  const entries: { slot: number; delayMs: number }[] = [];
  for (let i = 0; i < newCount; i++) {
    entries.push({
      slot: prevLength + i,
      delayMs: ms(i * staggerSec),
    });
  }
  return entries;
}

export function getBoardRevealTotalMs(
  prevLength: number,
  nextBoard: string[]
): number {
  const schedule = getBoardRevealSchedule(prevLength, nextBoard);
  if (schedule.length === 0) return 0;
  const last = schedule[schedule.length - 1]!;
  return last.delayMs + Math.round(COMMUNITY_FLIP_DURATION_SEC * 1000);
}
