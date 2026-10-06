import Redis from "ioredis";

const WINDOW_SEC = 15 * 60;
const MAX_PER_EMAIL = 5;
const MAX_PER_IP = 10;

export type LimitStore = {
  incr(key: string, windowSec: number): Promise<number>;
};

const memoryCounts = new Map<string, { count: number; resetAt: number }>();

export const memoryLimitStore: LimitStore = {
  async incr(key, windowSec) {
    const now = Date.now();
    const current = memoryCounts.get(key);
    if (!current || current.resetAt <= now) {
      const next = { count: 1, resetAt: now + windowSec * 1000 };
      memoryCounts.set(key, next);
      return 1;
    }
    current.count += 1;
    return current.count;
  },
};

let redis: Redis | null | undefined;

function getRedis(): Redis | null {
  if (redis !== undefined) return redis;
  const url = process.env["REDIS_URL"];
  if (!url) {
    redis = null;
    return null;
  }
  try {
    redis = new Redis(url, {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      lazyConnect: true,
    });
    redis.on("error", (err) => {
      console.warn("[rateLimit] Redis error", err.message);
    });
    return redis;
  } catch {
    redis = null;
    return null;
  }
}

const redisLimitStore: LimitStore = {
  async incr(key, windowSec) {
    const client = getRedis();
    if (!client) return memoryLimitStore.incr(key, windowSec);
    try {
      if (client.status === "wait") {
        await client.connect();
      }
      const count = await client.incr(key);
      if (count === 1) {
        await client.expire(key, windowSec);
      }
      return count;
    } catch (err) {
      console.warn(
        "[rateLimit] Redis unavailable, using memory store",
        err instanceof Error ? err.message : err
      );
      return memoryLimitStore.incr(key, windowSec);
    }
  },
};

export function createSendLinkLimiter(
  store: LimitStore,
  opts?: { maxPerEmail?: number; maxPerIp?: number; windowSec?: number }
) {
  const maxPerEmail = opts?.maxPerEmail ?? MAX_PER_EMAIL;
  const maxPerIp = opts?.maxPerIp ?? MAX_PER_IP;
  const windowSec = opts?.windowSec ?? WINDOW_SEC;

  return {
    async consume(
      email: string,
      ip: string
    ): Promise<{ allowed: boolean; retryAfterSec: number }> {
      const normalized = email.trim().toLowerCase();
      const safeIp = ip.trim() || "unknown";
      const [emailCount, ipCount] = await Promise.all([
        store.incr(`auth:link:email:${normalized}`, windowSec),
        store.incr(`auth:link:ip:${safeIp}`, windowSec),
      ]);
      const allowed = emailCount <= maxPerEmail && ipCount <= maxPerIp;
      return { allowed, retryAfterSec: windowSec };
    },
  };
}

export const sendLinkLimiter = createSendLinkLimiter(redisLimitStore);
