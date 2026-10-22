/**
 * Health status model, kept free of database imports so the summary rules can
 * be unit tested without a connection.
 */

export type CheckName = "database" | "uploads" | "reports";
export type CheckState = "ok" | "degraded" | "unavailable";
export type OverallStatus = "ok" | "degraded" | "unavailable";

export type HealthReport = {
  status: OverallStatus;
  checks: Record<CheckName, CheckState>;
  durationMs: number;
};

/**
 * The application can serve pages only with a database and a writable upload
 * directory. A missing reporting toolchain is a degraded state, not an outage:
 * the UI, cash book and audit trail still work without Python or LibreOffice.
 */
export function summarize(
  checks: Record<CheckName, CheckState>,
  durationMs = 0,
): HealthReport {
  const critical: CheckName[] = ["database", "uploads"];
  const status: OverallStatus = critical.some((name) => checks[name] !== "ok")
    ? "unavailable"
    : checks.reports !== "ok"
      ? "degraded"
      : "ok";
  return { status, checks, durationMs };
}
