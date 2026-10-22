import { db } from "./db";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export type PruneResult = { sessions: number; loginAttempts: number };

/**
 * Remove rows that no longer serve any purpose.
 *
 * Sessions are only deleted on logout, password change or deactivation, so
 * expired rows would otherwise accumulate forever. Login attempt counters are
 * keyed per e-mail and also grow without bound.
 */
export async function pruneExpired(
  loginWindowRetentionMs = DAY,
): Promise<PruneResult> {
  const now = new Date();
  const [sessions, loginAttempts] = await db.$transaction([
    db.session.deleteMany({ where: { expiresAt: { lt: now } } }),
    db.loginAttempt.deleteMany({
      where: {
        windowStart: { lt: new Date(now.getTime() - loginWindowRetentionMs) },
      },
    }),
  ]);
  return { sessions: sessions.count, loginAttempts: loginAttempts.count };
}

let lastAttempt = 0;

/**
 * Opportunistic housekeeping so installations without cron still stay tidy.
 * Runs at most once per hour per process and never throws into the caller.
 */
export async function pruneOpportunistically(intervalMs = HOUR) {
  if (Date.now() - lastAttempt < intervalMs) return;
  lastAttempt = Date.now();
  try {
    await pruneExpired();
  } catch (error) {
    console.error(
      "Maintenance cleanup failed",
      error instanceof Error ? error.name : "UnknownError",
    );
  }
}
