import "dotenv/config";
import { execFileSync } from "node:child_process";
const configured = process.env.TEST_DATABASE_URL;
const url = new URL(configured || process.env.DATABASE_URL);
if (!configured) url.pathname = "/kira_rapi_test";
if (!url.pathname.endsWith("_test"))
  throw new Error(
    "Integration tests require a dedicated database whose name ends in _test.",
  );
if (!configured) {
  const found = execFileSync(
    "docker",
    [
      "compose",
      "exec",
      "-T",
      "db",
      "psql",
      "-U",
      "kira",
      "-d",
      "postgres",
      "-tAc",
      "SELECT 1 FROM pg_database WHERE datname='kira_rapi_test'",
    ],
    { encoding: "utf8" },
  ).trim();
  if (!found)
    execFileSync(
      "docker",
      [
        "compose",
        "exec",
        "-T",
        "db",
        "createdb",
        "-U",
        "kira",
        "kira_rapi_test",
      ],
      { stdio: "inherit" },
    );
}
const options = {
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: url.toString() },
};
execFileSync("npx", ["prisma", "migrate", "deploy"], options);
execFileSync(
  "npx",
  [
    "tsx",
    "--test",
    "--test-concurrency=1",
    "tests/finance.integration.test.ts",
    "tests/health.integration.test.ts",
  ],
  options,
);
