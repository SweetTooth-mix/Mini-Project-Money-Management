import { execFile } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { db } from "./db";
import { log } from "./log";
import { summarize, type CheckState, type HealthReport } from "./health-status";

export { summarize } from "./health-status";

const run = promisify(execFile);

const PROBE_TIMEOUT_MS = 4000;

async function checkDatabase(): Promise<CheckState> {
  try {
    await db.$queryRaw`SELECT 1`;
    return "ok";
  } catch (error) {
    // The response only carries the state; the cause belongs in the logs.
    log.warn("health.database_unavailable", {
      errName: error instanceof Error ? error.name : "UnknownError",
      errCode: (error as { code?: string }).code,
    });
    return "unavailable";
  }
}

/** Writing a real file proves the directory exists, is writable and is cleanable. */
async function checkUploads(): Promise<CheckState> {
  const directory = path.resolve(process.env.UPLOAD_DIR || ".data/uploads");
  const probe = path.join(directory, `.health-${process.pid}-${Date.now()}`);
  try {
    await mkdir(directory, { recursive: true, mode: 0o700 });
    await writeFile(probe, "ok", { mode: 0o600, flag: "wx" });
    await rm(probe, { force: true });
    return "ok";
  } catch (error) {
    log.warn("health.uploads_unavailable", {
      errName: error instanceof Error ? error.name : "UnknownError",
    });
    return "unavailable";
  }
}

const probe = async (command: string, args: string[]) => {
  try {
    await run(command, args, { timeout: PROBE_TIMEOUT_MS, windowsHide: true });
    return true;
  } catch {
    return false;
  }
};

let reportCache: { state: CheckState; at: number } | undefined;
const REPORT_CACHE_MS = 60_000;

/**
 * Spawning Python and LibreOffice on every probe is wasteful, so the result is
 * cached for a minute. Excel output needs Python; PDF needs LibreOffice too.
 */
async function checkReports(now = Date.now()): Promise<CheckState> {
  if (reportCache && now - reportCache.at < REPORT_CACHE_MS)
    return reportCache.state;
  const python = process.env.EXCEL_PYTHON || ".venv/bin/python";
  const hasPython = await probe(python, ["-c", "import openpyxl"]);
  const hasLibreOffice = hasPython
    ? await probe("soffice", ["--version"])
    : false;
  const state: CheckState = hasPython
    ? hasLibreOffice
      ? "ok"
      : "degraded"
    : "unavailable";
  reportCache = { state, at: now };
  return state;
}

/** Test seam: drop the cached reporting probe. */
export function resetHealthCache() {
  reportCache = undefined;
}

export async function checkHealth(): Promise<HealthReport> {
  const started = Date.now();
  const [database, uploads, reports] = await Promise.all([
    checkDatabase(),
    checkUploads(),
    checkReports(),
  ]);
  return summarize({ database, uploads, reports }, Date.now() - started);
}
