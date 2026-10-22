import "dotenv/config";
import { randomBytes } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
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

// Output is captured rather than inherited so a failing run can repeat its tail
// as a check-run annotation: job logs are not reachable from every environment.
function run(command, args) {
  const result = spawnSync(command, args, {
    ...options,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  const output = `${result.stdout || ""}${result.stderr || ""}`;
  process.stdout.write(output);
  if (result.error) throw result.error;
  if (result.status !== 0) {
    if (process.env.CI && output.trim())
      console.error(
        `::error::${output
          .split("\n")
          .filter((line) => line.trim())
          .slice(-40)
          .map((line) => line.replaceAll("%", "%25").replaceAll("\r", ""))
          .join("%0A")}`,
      );
    process.exit(result.status ?? 1);
  }
}

run("npx", ["prisma", "migrate", "reset", "--force", "--skip-seed"]);
run("npm", ["run", "db:seed"]);
run("npx", ["playwright", "test", ...process.argv.slice(2)]);
