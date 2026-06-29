import type { BlindLevel } from "@poker/protocol";
import { getBlindLevelAt } from "@poker/protocol";

export type { BlindLevel };

/** @deprecated use resolveBlindLevels from @poker/protocol */
export { getBlindLevelAt as getBlindsForLevel };

export function getBlindsForLevelFromStructure(
  levels: BlindLevel[],
  levelIndex: number
): BlindLevel {
  return getBlindLevelAt(levels, levelIndex);
}
