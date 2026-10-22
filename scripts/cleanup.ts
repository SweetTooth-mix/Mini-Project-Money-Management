import "dotenv/config";
import { pruneExpired } from "../lib/maintenance";
import { db } from "../lib/db";

const result = await pruneExpired();
console.log(
  `Cleanup: ${result.sessions} expired session(s), ${result.loginAttempts} stale login attempt row(s) removed.`,
);
await db.$disconnect();
