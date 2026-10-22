#!/usr/bin/env node
// Copies the documentation screenshots produced by
// tests/e2e/docs-screenshots.spec.ts into docs/screenshots/ and lists any
// stale file that no longer has a source.
//
//   npm run build
//   npm run test:e2e -- docs-screenshots
//   node scripts/collect-screenshots.mjs          # preview the copy
//   node scripts/collect-screenshots.mjs --write  # overwrite docs/screenshots
//
// Nothing is written unless --write is passed, so the default run is safe in CI.
import { copyFile, mkdir, readdir, stat } from "node:fs/promises";
import { extname, join } from "node:path";

const SRC = ".data/screenshots/docs";
const DEST = "docs/screenshots";
const write = process.argv.includes("--write");

const png = (await readdir(DEST).catch(() => []))
  .filter((f) => extname(f) === ".png")
  .sort();
const produced = (await readdir(SRC).catch(() => []))
  .filter((f) => extname(f) === ".png")
  .sort();

if (produced.length === 0) {
  console.error(
    `No screenshots in ${SRC}. Run "npm run test:e2e -- docs-screenshots" first.`,
  );
  process.exit(1);
}

if (write) await mkdir(DEST, { recursive: true });

for (const file of produced) {
  const from = join(SRC, file);
  const to = join(DEST, file);
  const before = await stat(to).catch(() => null);
  if (write) await copyFile(from, to);
  console.log(`${before ? "update" : "add   "} ${to}${before ? "" : " (new)"}`);
}

const missing = png.filter((f) => !produced.includes(f));
for (const file of missing) {
  console.log(`stale  ${join(DEST, file)} (no matching capture)`);
}

console.log(
  write
    ? `\nWrote ${produced.length} screenshots to ${DEST}.`
    : `\nDry run: ${produced.length} ready to copy, ${missing.length} stale. Re-run with --write.`,
);
