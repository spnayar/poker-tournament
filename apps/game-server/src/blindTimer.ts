import type { BlindLevel, BlindTimerState } from "@poker/protocol";

export interface BlindTimerSnapshot {
  levelIndex: number;
  levelEndsAt: number | null;
  paused: boolean;
  pausedRemainingMs: number | null;
  increasePending: boolean;
}

export class BlindTimer {
  private levelIndex = 0;
  private levelEndsAt: number | null = null;
  private paused = false;
  private pausedRemainingMs: number | null = null;
  private increasePending = false;

  constructor(
    private readonly blindLevels: BlindLevel[],
    private readonly levelDurationMs: number,
    snapshot?: BlindTimerSnapshot
  ) {
    if (snapshot) {
      this.levelIndex = snapshot.levelIndex;
      this.levelEndsAt = snapshot.levelEndsAt;
      this.paused = snapshot.paused;
      this.pausedRemainingMs = snapshot.pausedRemainingMs;
      this.increasePending = snapshot.increasePending;
    }
  }

  get maxLevelIndex(): number {
    return Math.max(0, this.blindLevels.length - 1);
  }

  hasMoreLevels(): boolean {
    return this.levelIndex < this.maxLevelIndex;
  }

  startLevelTimer(): void {
    if (!this.hasMoreLevels()) {
      this.levelEndsAt = null;
      return;
    }
    this.paused = false;
    this.pausedRemainingMs = null;
    this.levelEndsAt = Date.now() + this.levelDurationMs;
  }

  tick(now = Date.now()): boolean {
    if (this.increasePending || this.paused || this.levelEndsAt === null) {
      return false;
    }
    if (now >= this.levelEndsAt) {
      this.increasePending = true;
      this.levelEndsAt = null;
      return true;
    }
    return false;
  }

  pause(now = Date.now()): void {
    if (this.paused || this.increasePending || this.levelEndsAt === null) return;
    this.pausedRemainingMs = Math.max(0, this.levelEndsAt - now);
    this.paused = true;
    this.levelEndsAt = null;
  }

  resume(now = Date.now()): void {
    if (!this.paused || this.increasePending) return;
    const remaining = this.pausedRemainingMs ?? this.levelDurationMs;
    this.paused = false;
    this.pausedRemainingMs = null;
    this.levelEndsAt = now + remaining;
  }

  onLevelApplied(tableBlindLevel: number): void {
    this.increasePending = false;
    this.levelIndex = tableBlindLevel;
    this.startLevelTimer();
  }

  clearIncreasePending(): void {
    this.increasePending = false;
    this.levelEndsAt = null;
  }

  toSnapshot(): BlindTimerSnapshot {
    return {
      levelIndex: this.levelIndex,
      levelEndsAt: this.levelEndsAt,
      paused: this.paused,
      pausedRemainingMs: this.pausedRemainingMs,
      increasePending: this.increasePending,
    };
  }

  getIncreasePending(): boolean {
    return this.increasePending;
  }

  getPublicState(
    currentSb: number,
    currentBb: number,
    tableBlindLevel: number,
    now = Date.now()
  ): BlindTimerState {
    const levelNumber = tableBlindLevel + 1;
    const nextLevel = this.blindLevels[tableBlindLevel + 1] ?? null;

    let remainingMs: number | null = null;
    if (this.paused) {
      remainingMs = this.pausedRemainingMs;
    } else if (this.levelEndsAt !== null) {
      remainingMs = Math.max(0, this.levelEndsAt - now);
    }

    return {
      levelIndex: this.levelIndex,
      levelNumber,
      levelEndsAt: this.levelEndsAt,
      paused: this.paused,
      pausedRemainingMs: remainingMs,
      increasePending: this.increasePending,
      currentSb,
      currentBb,
      nextSb: nextLevel?.sb ?? null,
      nextBb: nextLevel?.bb ?? null,
      levelDurationMs: this.levelDurationMs,
    };
  }
}
