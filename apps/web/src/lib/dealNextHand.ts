/**
 * Between-hand Deal controls. Must stay available even when HAND_RESULT was
 * missed (reconnect) or cleared — phase hand-complete is enough.
 *
 * Only the button seat may deal while available. Host override applies only
 * when that seat is away/skipped (or missing) so the table never soft-locks —
 * never dual live Deal buttons.
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

  const dealerMissing = opts.nextDealerSeat == null;
  const hostOverride =
    opts.isHost && (opts.nextDealerUnavailable || dealerMissing);

  // Available button seat deals. Away/skipped button does not keep Deal —
  // only host override (including when the host is the away dealer).
  if (opts.nextDealerSeat === opts.mySeatId && !opts.nextDealerUnavailable) {
    return true;
  }

  return hostOverride;
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
