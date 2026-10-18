/**
 * Sliding-window rate limiter kept in process memory. It protects a single
 * server instance (enough for the demo deployment); a multi-instance
 * deployment would need a shared store such as Redis or a database table.
 */
export function createRateLimiter({ limit, windowMs }: { limit: number; windowMs: number }) {
  const hits = new Map<string, number[]>();

  return {
    /** Records a hit and reports whether it is allowed. */
    check(key: string, now = Date.now()): { allowed: boolean; retryAfterSeconds: number } {
      const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
      if (recent.length >= limit) {
        hits.set(key, recent);
        return { allowed: false, retryAfterSeconds: Math.ceil((windowMs - (now - recent[0])) / 1000) };
      }
      recent.push(now);
      hits.set(key, recent);
      if (hits.size > 10_000) {
        for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k);
      }
      return { allowed: true, retryAfterSeconds: 0 };
    },
  };
}
