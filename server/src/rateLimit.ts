// Simple in-memory sliding-window rate limiter. Good enough for a single
// process; swap for a Redis-backed limiter (e.g. rate-limiter-flexible) once
// the app runs on more than one instance — see docs/ARCHITECTURE.md.
const buckets = new Map<string, number[]>();

export function isRateLimited(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  hits.push(now);
  buckets.set(key, hits);
  return hits.length > limit;
}
