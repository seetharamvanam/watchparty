type Bucket = number[];

const buckets = new Map<string, Bucket>();

export function resetRateLimits() {
  buckets.clear();
}

export function checkRateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const existing = buckets.get(key) ?? [];
  const recent = existing.filter((ts) => now - ts < windowMs);
  if (recent.length >= max) {
    buckets.set(key, recent);
    return false;
  }
  recent.push(now);
  buckets.set(key, recent);
  return true;
}
