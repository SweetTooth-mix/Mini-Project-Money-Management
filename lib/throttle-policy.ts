import { createHash } from "node:crypto";

/**
 * Throttle policy: pure decisions about which buckets exist and how large they
 * are. Kept separate from lib/throttle.ts so it can be unit tested without a
 * database connection.
 */
export const WINDOW_MS = 15 * 60 * 1000;

/**
 * Buckets are stored as opaque hashes: no e-mail address or IP is kept in plain
 * text, and one row per bucket stays bounded by the pruning in
 * lib/maintenance.ts.
 */
export const hashKey = (raw: string) =>
  createHash("sha256").update(raw).digest("hex");

export type Bucket = { key: string; limit: number };

export type LoginBuckets = {
  /** Every bucket checked before a sign-in is attempted. */
  all: Bucket[];
  /** Buckets cleared after a successful sign-in. The per-address total is kept
   * so a valid account cannot be used to reset an attacking host's counter. */
  resettable: Bucket[];
};

/**
 * Limits are layered so a stranger cannot lock a real user out:
 * - per address + e-mail: strict, stops password guessing against one account
 * - per address: stops one host walking through many accounts
 * - per e-mail: loose, only stops a distributed attack; a legitimate user would
 *   need 30 failures in the window before being blocked.
 *
 * Only failed attempts are counted, so a busy office sharing one address is not
 * penalised for signing in normally.
 */
export const loginBuckets = ({
  email,
  ip,
}: {
  email: string;
  ip: string;
}): LoginBuckets => {
  const perEmail = { key: hashKey(`login:email:${email}`), limit: 30 };
  const perAddressEmail = { key: hashKey(`login:ip:${ip}:${email}`), limit: 8 };
  const perAddress = { key: hashKey(`login:ip:${ip}`), limit: 25 };
  const known = ip !== "unknown";
  return {
    all: [...(known ? [perAddressEmail, perAddress] : []), perEmail],
    resettable: [...(known ? [perAddressEmail] : []), perEmail],
  };
};

export const registerBuckets = (email: string, ip: string): Bucket[] => [
  ...(ip === "unknown"
    ? []
    : [{ key: hashKey(`register:ip:${ip}`), limit: 5 }]),
  { key: hashKey(`register:email:${email}`), limit: 5 },
];

export type ThrottleOutcome = {
  allowed: boolean;
  /** Seconds until the blocking window ends, for messaging and Retry-After. */
  retryAfterSeconds: number;
};
