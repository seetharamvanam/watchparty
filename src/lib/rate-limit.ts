import { randomUUID } from "node:crypto";
import { and, eq, gte, lt, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { rateLimitBuckets, rateLimitEvents } from "@/db/schema";

/**
 * Durable sliding-window limiter for serverless.
 * In-memory Maps do not work across Vercel isolates, so hits live in Neon
 * (`rate_limit_events`) and a `rate_limit_buckets` row is locked with
 * SELECT … FOR UPDATE so concurrent requests cannot exceed `max`.
 */
export async function checkRateLimit(key: string, max: number, windowMs: number): Promise<boolean> {
  const db = getDb();
  const now = new Date();
  const cutoff = new Date(now.getTime() - windowMs);

  return db.transaction(async (tx) => {
    await tx.insert(rateLimitBuckets).values({ bucketKey: key }).onConflictDoNothing();
    const [lock] = await tx
      .select()
      .from(rateLimitBuckets)
      .where(eq(rateLimitBuckets.bucketKey, key))
      .for("update");
    if (!lock) {
      return false;
    }

    await tx
      .delete(rateLimitEvents)
      .where(and(eq(rateLimitEvents.bucketKey, key), lt(rateLimitEvents.createdAt, cutoff)));

    const [row] = await tx
      .select({ count: sql<number>`cast(count(*) as int)` })
      .from(rateLimitEvents)
      .where(and(eq(rateLimitEvents.bucketKey, key), gte(rateLimitEvents.createdAt, cutoff)));

    if (Number(row?.count ?? 0) >= max) {
      return false;
    }

    await tx.insert(rateLimitEvents).values({
      id: randomUUID(),
      bucketKey: key,
      createdAt: now,
    });
    return true;
  });
}

export async function resetRateLimits() {
  const db = getDb();
  await db.delete(rateLimitEvents);
  await db.delete(rateLimitBuckets);
}
