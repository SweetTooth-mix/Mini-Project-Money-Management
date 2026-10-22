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

type Snapshot = {
  key: string;
  limit: number;
  attempts: number;
  windowStart: Date;
};

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
    .filter(
      (entry): entry is { row: Snapshot; limit: number } => entry !== null,
    )
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
 * Count one failed attempt against every bucket.
 *
 * Rows are locked with SELECT ... FOR UPDATE so concurrent failures cannot
 * overwrite each other's counter. Keys are locked in sorted order to avoid
 * deadlocks between two attempts that share buckets.
 */
export async function record(buckets: Bucket[]): Promise<void> {
  if (!buckets.length) return;
  const ordered = [...buckets].sort((a, b) => a.key.localeCompare(b.key));
  const now = Date.now();
  await db.$transaction(async (tx) => {
    const snapshots: Snapshot[] = [];
    for (const bucket of ordered) {
      await tx.loginAttempt.upsert({
        where: { key: bucket.key },
        create: { key: bucket.key },
        update: {},
      });
      await tx.$queryRaw`SELECT "key" FROM "LoginAttempt" WHERE "key" = ${bucket.key} FOR UPDATE`;
      const row = await tx.loginAttempt.findUniqueOrThrow({
        where: { key: bucket.key },
      });
      const expired = row.windowStart.getTime() <= now - WINDOW_MS;
      snapshots.push({
        ...bucket,
        attempts: expired ? 0 : row.attempts,
        windowStart: expired ? new Date(now) : row.windowStart,
      });
    }
    await Promise.all(
      snapshots.map((snapshot) =>
        tx.loginAttempt.update({
          where: { key: snapshot.key },
          data: {
            attempts: snapshot.attempts + 1,
            windowStart: snapshot.windowStart,
          },
        }),
      ),
    );
  });
}

/** Clear the buckets after a successful sign-in so a typo spree does not linger. */
export async function reset(buckets: Bucket[]) {
  if (!buckets.length) return;
  await db.loginAttempt.deleteMany({
    where: { key: { in: buckets.map((bucket) => bucket.key) } },
  });
}
