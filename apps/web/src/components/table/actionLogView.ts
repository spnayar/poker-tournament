import type { ActionLogEntry } from "@poker/protocol";

export type ActionLogHandGroup = {
  handNumber: number;
  entries: ActionLogEntry[];
};

/** Engine hand markers (seatId -1) are replaced by UI group headers. */
export function isEngineHandHeader(entry: ActionLogEntry): boolean {
  return entry.seatId === -1;
}

/**
 * Newest hand first; within each hand, newest action first.
 * Drops engine "Hand #N" rows — the group header covers that.
 */
export function groupActionLogNewestFirst(
  actionLog: ActionLogEntry[]
): ActionLogHandGroup[] {
  const byHand = new Map<number, ActionLogEntry[]>();
  const handOrder: number[] = [];

  for (const entry of actionLog) {
    if (isEngineHandHeader(entry)) continue;
    const hn = entry.handNumber;
    let bucket = byHand.get(hn);
    if (!bucket) {
      bucket = [];
      byHand.set(hn, bucket);
      handOrder.push(hn);
    }
    bucket.push(entry);
  }

  return handOrder
    .slice()
    .reverse()
    .map((hn) => ({
      handNumber: hn,
      entries: (byHand.get(hn) ?? []).slice().reverse(),
    }));
}
