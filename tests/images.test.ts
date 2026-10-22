import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// A tag is a moving target: `node:22-bookworm-slim` can be re-pointed at a new
// build without warning, and the next `docker build` would silently pick it up.
// Pinning by digest is what makes the production image reproducible, so it is
// guarded rather than left to review.
//
// The digest lives in one ARG and every stage references it, so bumping Node is
// a single deliberate edit instead of six that can drift apart.

const LITERAL_DIGEST = /sha256:[0-9a-f]{64}/;
const PINNED_FROM =
  /^FROM\s+\S+@(\$\{NODE_IMAGE_DIGEST\}|sha256:[0-9a-f]{64})(\s+AS\s+\S+)?$/i;

test("the Dockerfile declares a literal base image digest", () => {
  const dockerfile = readFileSync("Dockerfile", "utf8");
  const declared = dockerfile.match(/^ARG\s+NODE_IMAGE_DIGEST=(\S+)$/m);
  assert.ok(declared, "ARG NODE_IMAGE_DIGEST is missing");
  assert.match(declared[1], new RegExp(`^${LITERAL_DIGEST.source}$`));
});

test("every Dockerfile base image is pinned by digest", () => {
  const lines = readFileSync("Dockerfile", "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^FROM\s/i.test(line));

  assert.ok(
    lines.length >= 6,
    `expected the six stages, found ${lines.length}`,
  );
  for (const line of lines) assert.match(line, PINNED_FROM);
});

// compose.yaml also names the image it builds from this repository, which has
// no upstream digest to pin.
const LOCAL_IMAGES = new Set(["kira-rapi:local", "kira-rapi:migrate"]);

test("every remote service image is pinned by digest", () => {
  for (const file of [
    ".github/workflows/ci.yml",
    ".github/workflows/docs-screenshots.yml",
    "compose.yaml",
  ]) {
    const images = [
      ...readFileSync(file, "utf8").matchAll(/^\s+image:\s*(\S+)$/gm),
    ].map((match) => match[1]);
    assert.ok(images.length > 0, `no service images found in ${file}`);
    for (const image of images) {
      if (LOCAL_IMAGES.has(image)) continue;
      assert.match(
        image,
        new RegExp(`${LITERAL_DIGEST.source}$`),
        `${file}: ${image}`,
      );
    }
  }
});
