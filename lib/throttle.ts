import { Prisma } from "@prisma/client";
import { db } from "./db";
import {
  WINDOW_MS,
  type Bucket,
  type ThrottleOutcome,
} from "./throttle-policy";

export {
  loginBuckets,
  registerBuckets,
  WINDOW_MS,
  type Bucket,
  type LoginBuckets,
  type ThrottleOutcome,
} from "./throttle-policy";

/**
 * Read every bucket and report whether the attempt may proceed.
 *
 * A row whose window has elapsed is treated as empty. Nothing is written here,
 * so a successful sign-in never consumes a neighbour's budget.
 */
export async function check(buckets: Bucket[]): Promise<ThrottleOutcome> {
  if (!buckets.length) return { allowed: true, retryAfterSeconds: 0 };
  const now = Date.now();
  const rows = await db.loginAttempt.findMany({
    where: { key: { in: buckets.map((bucket) => bucket.key) } },
  });
  const blocked = buckets
    .map((bucket) => {
      const row = rows.find((candidate) => candidate.key === bucket.key);
      if (!row || row.windowStart.getTime() <= now - WINDOW_MS) return null;
      return row.attempts >= bucket.limit ? { row, limit: bucket.limit } : null;
    })
    .filter((entry) => entry !== null)
    .sort(
      (a, b) => a.row.windowStart.getTime() - b.row.windowStart.getTime(),
    )[0];
  if (!blocked) return { allowed: true, retryAfterSeconds: 0 };
  return {
    allowed: false,
    retryAfterSeconds: Math.max(
      1,
      Math.ceil((blocked.row.windowStart.getTime() + WINDOW_MS - now) / 1000),
    ),
  };
}

/**
 * Count one failed attempt against every bucket in a single statement.
 *
 * The increment happens inside the database, so concurrent failures cannot lose
 * an update, and the row is created on demand without Prisma's emulated upsert
 * (which is a SELECT followed by INSERT and can raise a duplicate-key error when
 * several sign-ins race). Keys are sent in sorted order so that two callers
 * locking the same set always acquire them in the same order.
 */
export async function record(buckets: Bucket[]): Promise<void> {
  if (!buckets.length) return;
  const ordered = [...buckets].sort((a, b) => a.key.localeCompare(b.key));
  const values = Prisma.join(
    ordered.map((bucket) => Prisma.sql`(${bucket.key}, 1, now())`),
  );
  await db.$executeRaw`
    INSERT INTO "LoginAttempt" ("key", "attempts", "windowStart")
    VALUES ${values}
    ON CONFLICT ("key") DO UPDATE SET
      "attempts" = CASE
        WHEN "LoginAttempt"."windowStart" <= now() - interval '15 minutes' THEN 1
        ELSE "LoginAttempt"."attempts" + 1
      END,
      "windowStart" = CASE
        WHEN "LoginAttempt"."windowStart" <= now() - interval '15 minutes' THEN now()
        ELSE "LoginAttempt"."windowStart"
      END`;
}

/** Clear the buckets after a successful sign-in so a typo spree does not linger. */
export async function reset(buckets: Bucket[]) {
  if (!buckets.length) return;
  await db.loginAttempt.deleteMany({
    where: { key: { in: buckets.map((bucket) => bucket.key) } },
  });
}
