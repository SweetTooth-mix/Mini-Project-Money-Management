import { randomBytes } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";
if (!existsSync(".env")) {
  const dbPassword = randomBytes(24).toString("hex");
  const adminPassword = randomBytes(18).toString("base64url");
  const reviewerPassword = randomBytes(18).toString("base64url");
  writeFileSync(
    ".env",
    `DATABASE_URL=postgresql://kira:${dbPassword}@127.0.0.1:5434/kira_rapi\nPOSTGRES_PASSWORD=${dbPassword}\nAPP_URL=http://localhost:3000\nUPLOAD_DIR=.data/uploads\nSEED_ADMIN_EMAIL=admin@kira-rapi.local\nSEED_ADMIN_PASSWORD=${adminPassword}\nSEED_REVIEWER_PASSWORD=${reviewerPassword}\nSEED_DEMO=true\n`,
    { mode: 0o600, flag: "wx" },
  );
  console.log(
    "Created private .env for local development. Read SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD locally for login.",
  );
}
