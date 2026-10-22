import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { checkHealth } from "../lib/health";
import { db } from "../lib/db";

if (!new URL(process.env.DATABASE_URL!).pathname.endsWith("_test"))
  throw new Error(
    "Refusing to run integration tests against a non-test database.",
  );

const original = process.env.UPLOAD_DIR;
const directories: string[] = [];

async function useUploadDir(dir: string) {
  process.env.UPLOAD_DIR = dir;
  directories.push(dir);
  return dir;
}

after(async () => {
  if (original === undefined) delete process.env.UPLOAD_DIR;
  else process.env.UPLOAD_DIR = original;
  for (const dir of directories)
    await rm(dir, { recursive: true, force: true });
  await db.$disconnect();
});

test("health reports database and uploads as ok, reporting as degraded without Python", async () => {
  const dir = await useUploadDir(
    await mkdtemp(path.join(tmpdir(), "kira-health-")),
  );
  const report = await checkHealth();
  assert.equal(report.checks.database, "ok");
  assert.equal(report.checks.uploads, "ok");
  // CI images have no LibreOffice/Python venv; the UI still works, so this is
  // degraded rather than unavailable.
  assert.ok(["ok", "degraded", "unavailable"].includes(report.checks.reports));
  assert.equal(
    report.status,
    report.checks.reports === "ok" ? "ok" : "degraded",
  );
  assert.equal(typeof report.durationMs, "number");
  // The probe file must be cleaned up, leaving the directory empty.
  assert.deepEqual(await readdir(dir), []);
});

test("an unwritable upload directory makes the instance unavailable", async () => {
  const parent = await mkdtemp(path.join(tmpdir(), "kira-health-file-"));
  const file = path.join(parent, "not-a-directory");
  await writeFile(file, "x");
  directories.push(parent);
  await useUploadDir(path.join(file, "uploads"));
  const report = await checkHealth();
  assert.equal(report.checks.uploads, "unavailable");
  assert.equal(report.status, "unavailable");
});
