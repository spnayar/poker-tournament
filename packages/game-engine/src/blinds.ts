export interface BlindLevel {
  level: number;
  sb: number;
  bb: number;
}

export const STANDARD_BLINDS: BlindLevel[] = [
  { level: 1, sb: 25, bb: 50 },
  { level: 2, sb: 50, bb: 100 },
  { level: 3, sb: 75, bb: 150 },
  { level: 4, sb: 100, bb: 200 },
  { level: 5, sb: 150, bb: 300 },
  { level: 6, sb: 200, bb: 400 },
  { level: 7, sb: 300, bb: 600 },
  { level: 8, sb: 400, bb: 800 },
  { level: 9, sb: 500, bb: 1000 },
  { level: 10, sb: 600, bb: 1200 },
  { level: 11, sb: 800, bb: 1600 },
  { level: 12, sb: 1000, bb: 2000 },
];

export const TURBO_BLINDS: BlindLevel[] = [
  { level: 1, sb: 25, bb: 50 },
  { level: 2, sb: 50, bb: 100 },
  { level: 3, sb: 100, bb: 200 },
  { level: 4, sb: 150, bb: 300 },
  { level: 5, sb: 200, bb: 400 },
  { level: 6, sb: 300, bb: 600 },
  { level: 7, sb: 500, bb: 1000 },
  { level: 8, sb: 800, bb: 1600 },
  { level: 9, sb: 1200, bb: 2400 },
  { level: 10, sb: 2000, bb: 4000 },
];

export function getBlindPreset(preset: string): BlindLevel[] {
  return preset === "turbo" ? TURBO_BLINDS : STANDARD_BLINDS;
}

export function getBlindsForLevel(
  preset: string,
  levelIndex: number
): BlindLevel {
  const levels = getBlindPreset(preset);
  return levels[Math.min(levelIndex, levels.length - 1)]!;
}
