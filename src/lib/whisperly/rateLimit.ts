/**
 * Tiny fixed-window rate limiter (in memory, per process). Good enough to
 * slow down password guessing and email spam on the Whisperly auth routes.
 */
export interface RateLimiter {
  /** Records a hit for `key`; returns false when the key is over its limit. */
  hit(key: string, now?: number): boolean;
  /** True when `key` has already used its budget this window (doesn't record a hit). */
  blocked(key: string, now?: number): boolean;
}

export function createRateLimiter(opts: { max: number; windowMs: number; maxKeys?: number }): RateLimiter {
  const hits = new Map<string, { count: number; resetAt: number }>();
  const maxKeys = opts.maxKeys ?? 10_000;
  return {
    hit(key, now = Date.now()) {
      const entry = hits.get(key);
      if (!entry || entry.resetAt <= now) {
        if (hits.size >= maxKeys) {
          // Drop expired entries; if still full, drop the oldest one.
          for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
          if (hits.size >= maxKeys) hits.delete(hits.keys().next().value as string);
        }
        hits.set(key, { count: 1, resetAt: now + opts.windowMs });
        return true;
      }
      entry.count++;
      return entry.count <= opts.max;
    },
    blocked(key, now = Date.now()) {
      const entry = hits.get(key);
      return !!entry && entry.resetAt > now && entry.count >= opts.max;
    },
  };
}
