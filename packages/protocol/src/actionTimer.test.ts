import { describe, expect, it } from "vitest";
import {
  ACTION_TIMER_NUDGE_SECONDS,
  DEFAULT_ACTION_TIMER_SECONDS,
  formatActionTimerLabel,
  resolveActionTimerSeconds,
} from "./actionTimer";

describe("actionTimer", () => {
  it("defaults to 60 seconds", () => {
    expect(DEFAULT_ACTION_TIMER_SECONDS).toBe(60);
    expect(resolveActionTimerSeconds(undefined)).toBe(60);
    expect(resolveActionTimerSeconds(null)).toBe(60);
    expect(resolveActionTimerSeconds(15)).toBe(60);
  });

  it("accepts configured options including off", () => {
    expect(resolveActionTimerSeconds(0)).toBe(0);
    expect(resolveActionTimerSeconds(30)).toBe(30);
    expect(resolveActionTimerSeconds(60)).toBe(60);
    expect(resolveActionTimerSeconds(120)).toBe(120);
  });

  it("labels off and seconds clearly", () => {
    expect(formatActionTimerLabel(0)).toBe("Off");
    expect(formatActionTimerLabel(60)).toBe("60s");
  });

  it("nudges at 15 seconds remaining", () => {
    expect(ACTION_TIMER_NUDGE_SECONDS).toBe(15);
  });
});
