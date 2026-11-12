/**
 * Between-hand Deal controls. Must stay available even when HAND_RESULT was
 * missed (reconnect) or cleared — phase hand-complete is enough.
 */

export function isAwaitingNextHand(opts: {
  phase: string;
  gameFinished: boolean;
  boardRevealing: boolean;
}): boolean {
  return (
    !opts.gameFinished &&
    opts.phase === "hand-complete" &&
    !opts.boardRevealing
  );
}

export function canDealNextHand(opts: {
  awaitingNextHand: boolean;
  awaitingFirstDeal: boolean;
  mySeatId: number | null | undefined;
  nextDealerSeat: number | null | undefined;
  isHost: boolean;
  nextDealerUnavailable: boolean;
}): boolean {
  if (!opts.awaitingNextHand && !opts.awaitingFirstDeal) return false;
  if (opts.mySeatId == null) return false;
  if (opts.nextDealerSeat === opts.mySeatId) return true;
  // Host always — away/skipped/busted button must not soft-lock the table.
  return opts.isHost;
}

export function shouldShowDealNextBar(opts: {
  awaitingNextHand: boolean;
  awaitingFirstDeal: boolean;
  nextDealerSeat: number | null | undefined;
  isHost: boolean;
}): boolean {
  if (!opts.awaitingNextHand && !opts.awaitingFirstDeal) return false;
  if (opts.nextDealerSeat != null) return true;
  // Tournament should finish when no next dealer; host still needs a path
  // if finish hasn't arrived yet (show bar with host deal / waiting copy).
  return opts.isHost && opts.awaitingNextHand;
}
