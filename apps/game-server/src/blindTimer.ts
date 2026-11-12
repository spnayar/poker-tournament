import type { BlindLevel, BlindTimerState } from "@poker/protocol";

export interface BlindTimerSnapshot {
  levelIndex: number;
  levelEndsAt: number | null;
  paused: boolean;
  pausedRemainingMs: number | null;
  increasePending: boolean;
  /** Target structure index when increasePending; null otherwise. */
  pendingLevelIndex: number | null;
}

export class BlindTimer {
  private levelIndex = 0;
  private levelEndsAt: number | null = null;
  private paused = false;
  private pausedRemainingMs: number | null = null;
  private increasePending = false;
  private pendingLevelIndex: number | null = null;

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
      this.pendingLevelIndex =
        snapshot.pendingLevelIndex ??
        (snapshot.increasePending
          ? Math.min(snapshot.levelIndex + 1, this.maxLevelIndex)
          : null);
    }
  }

  get maxLevelIndex(): number {
    return Math.max(0, this.blindLevels.length - 1);
  }

  hasMoreLevels(): boolean {
    return this.levelIndex < this.maxLevelIndex;
  }

  getPendingLevelIndex(): number | null {
    return this.increasePending ? this.pendingLevelIndex : null;
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
      return this.scheduleLevel(this.levelIndex + 1);
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

  /**
   * Host override: schedule the next blind level for the upcoming hand
   * (same as letting the timer expire).
   */
  forceNextLevel(): boolean {
    return this.scheduleLevel(this.levelIndex + 1);
  }

  /**
   * Host override: schedule a specific structure level (must be above current).
   */
  forceToLevel(targetLevelIndex: number): boolean {
    return this.scheduleLevel(targetLevelIndex);
  }

  private scheduleLevel(targetLevelIndex: number): boolean {
    if (this.increasePending) return false;
    if (
      !Number.isInteger(targetLevelIndex) ||
      targetLevelIndex <= this.levelIndex ||
      targetLevelIndex > this.maxLevelIndex
    ) {
      return false;
    }
    this.paused = false;
    this.pausedRemainingMs = null;
    this.levelEndsAt = null;
    this.pendingLevelIndex = targetLevelIndex;
    this.increasePending = true;
    return true;
  }

  onLevelApplied(tableBlindLevel: number): void {
    this.increasePending = false;
    this.pendingLevelIndex = null;
    this.levelIndex = tableBlindLevel;
    this.startLevelTimer();
  }

  clearIncreasePending(): void {
    this.increasePending = false;
    this.pendingLevelIndex = null;
    this.levelEndsAt = null;
  }

  toSnapshot(): BlindTimerSnapshot {
    return {
      levelIndex: this.levelIndex,
      levelEndsAt: this.levelEndsAt,
      paused: this.paused,
      pausedRemainingMs: this.pausedRemainingMs,
      increasePending: this.increasePending,
      pendingLevelIndex: this.pendingLevelIndex,
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
    const pendingIndex = this.increasePending
      ? (this.pendingLevelIndex ?? tableBlindLevel + 1)
      : null;
    const pendingLevel =
      pendingIndex !== null ? (this.blindLevels[pendingIndex] ?? null) : null;
    const nextIndex = pendingIndex ?? tableBlindLevel + 1;
    const nextLevel = this.blindLevels[nextIndex] ?? null;
    const advanceOptions = this.blindLevels.slice(tableBlindLevel + 1);

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
      pendingSb: pendingLevel?.sb ?? null,
      pendingBb: pendingLevel?.bb ?? null,
      pendingLevelNumber: pendingLevel ? pendingIndex! + 1 : null,
      advanceOptions,
      levelDurationMs: this.levelDurationMs,
    };
  }
}
