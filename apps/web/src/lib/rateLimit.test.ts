import { describe, it, expect } from "vitest";
import {
  createJoinCodeLimiter,
  createSendLinkLimiter,
  type LimitStore,
} from "./rateLimit";

function memoryStore(): LimitStore {
  const counts = new Map<string, { count: number; resetAt: number }>();
  return {
    async incr(key, windowSec) {
      const now = Date.now();
      const current = counts.get(key);
      if (!current || current.resetAt <= now) {
        counts.set(key, { count: 1, resetAt: now + windowSec * 1000 });
        return 1;
      }
      current.count += 1;
      return current.count;
    },
  };
}

describe("send-link rate limit", () => {
  it("allows up to max per email then blocks", async () => {
    const limiter = createSendLinkLimiter(memoryStore(), {
      maxPerEmail: 2,
      maxPerIp: 10,
      windowSec: 60,
    });
    const a = await limiter.consume("a@example.com", "1.1.1.1");
    const b = await limiter.consume("a@example.com", "1.1.1.1");
    const c = await limiter.consume("a@example.com", "1.1.1.1");
    expect(a.allowed).toBe(true);
    expect(b.allowed).toBe(true);
    expect(c.allowed).toBe(false);
  });

  it("treats emails as case-insensitive", async () => {
    const limiter = createSendLinkLimiter(memoryStore(), {
      maxPerEmail: 1,
      maxPerIp: 10,
      windowSec: 60,
    });
    await limiter.consume("A@Example.com", "9.9.9.9");
    const again = await limiter.consume("a@example.com", "8.8.8.8");
    expect(again.allowed).toBe(false);
  });

  it("limits by IP independently of email", async () => {
    const limiter = createSendLinkLimiter(memoryStore(), {
      maxPerEmail: 5,
      maxPerIp: 2,
      windowSec: 60,
    });
    await limiter.consume("one@example.com", "2.2.2.2");
    await limiter.consume("two@example.com", "2.2.2.2");
    const blocked = await limiter.consume("three@example.com", "2.2.2.2");
    expect(blocked.allowed).toBe(false);
  });
});

describe("join-code rate limit", () => {
  it("blocks an IP after the attempt budget is used", async () => {
    const limiter = createJoinCodeLimiter(memoryStore(), {
      maxPerIp: 2,
      windowSec: 60,
    });
    expect((await limiter.consume("1.1.1.1")).allowed).toBe(true);
    expect((await limiter.consume("1.1.1.1")).allowed).toBe(true);
    const blocked = await limiter.consume(" 1.1.1.1 ");
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSec).toBe(60);
  });

  it("does not share the budget across IP addresses", async () => {
    const limiter = createJoinCodeLimiter(memoryStore(), {
      maxPerIp: 1,
      windowSec: 60,
    });
    expect((await limiter.consume("1.1.1.1")).allowed).toBe(true);
    expect((await limiter.consume("2.2.2.2")).allowed).toBe(true);
    expect((await limiter.consume("1.1.1.1")).allowed).toBe(false);
  });
});
