import "dotenv/config";
import { randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
const url = new URL(process.env.DATABASE_URL);
url.pathname = "/kira_rapi_e2e_test";
if (!["localhost", "127.0.0.1"].includes(url.hostname))
  throw new Error(
    "The automatic E2E fixture runner requires a local database server.",
  );

// Locally the database arrives through `docker compose`; in CI it is a service
// container reachable on localhost. Only the compose path can create a database
// from outside, so the CI path relies on `prisma migrate reset`, which creates
// the target database itself.
const hasCompose =
  process.env.E2E_SKIP_COMPOSE_DB !== "true" &&
  (() => {
    try {
      execFileSync("docker", ["compose", "ps", "--status", "running", "db"], {
        stdio: "ignore",
      });
      return true;
    } catch {
      return false;
    }
  })();

if (hasCompose) {
  const found = execFileSync(
    "docker",
    [
      "compose",
      "exec",
      "-T",
      "db",
      "psql",
      "-U",
      process.env.POSTGRES_USER || "kira",
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
        process.env.POSTGRES_USER || "kira",
        "kira_rapi_e2e_test",
      ],
      { stdio: "inherit" },
    );
}

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

const playwright = ["playwright", "test", ...process.argv.slice(2)];
try {
  execFileSync(
    "npx",
    ["prisma", "migrate", "reset", "--force", "--skip-seed"],
    options,
  );
  execFileSync("npm", ["run", "db:seed"], options);
  execFileSync("npx", playwright, options);
} catch (error) {
  // CI job logs are not always reachable; surface the tail as an annotation.
  const log = [error.stdout?.toString() || "", error.stderr?.toString() || ""]
    .join("")
    .trim();
  if (process.env.CI && log)
    console.error(
      `::error::${log
        .split("\n")
        .slice(-40)
        .join("%0A")
        .replace(/%(?!0A)/g, "%25")}`,
    );
  process.exit(error.status ?? 1);
}
