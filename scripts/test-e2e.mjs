import "dotenv/config";
import { randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
const url = new URL(process.env.DATABASE_URL);
url.pathname = "/kira_rapi_e2e_test";
if (!["localhost", "127.0.0.1"].includes(url.hostname))
  throw new Error(
    "The automatic E2E fixture runner requires the local Docker development database.",
  );
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
    "SELECT 1 FROM pg_database WHERE datname='kira_rapi_e2e_test'",
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
      "kira_rapi_e2e_test",
    ],
    { stdio: "inherit" },
  );
const options = {
  stdio: "inherit",
  env: {
    ...process.env,
    DATABASE_URL: url.toString(),
    APP_URL: "http://localhost:3100",
    UPLOAD_DIR: ".data/e2e-uploads",
    SEED_DEMO: "true",
    SEED_ADMIN_EMAIL: "admin@e2e.local",
    SEED_ADMIN_PASSWORD: randomBytes(18).toString("base64url"),
    SEED_REVIEWER_PASSWORD: randomBytes(18).toString("base64url"),
    E2E_READER_PASSWORD: randomBytes(18).toString("base64url"),
  },
};
execFileSync(
  "npx",
  ["prisma", "migrate", "reset", "--force", "--skip-seed"],
  options,
);
execFileSync("npm", ["run", "db:seed"], options);
execFileSync("npx", ["playwright", "test"], options);
