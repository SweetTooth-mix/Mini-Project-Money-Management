import { test } from "node:test";
import assert from "node:assert/strict";
import { configWarnings, insecureAppUrl } from "../lib/config-check";

const prod = (extra: Record<string, string | undefined> = {}) => ({
  NODE_ENV: "production",
  ...extra,
});

test("production refuses to start on a plaintext public URL", () => {
  // The session cookie gains Secure only for https, so http in production
  // would put the token on the wire in clear.
  assert.match(
    insecureAppUrl(prod({ APP_URL: "http://kira.example.my" })) ?? "",
    /must use https/,
  );
  assert.match(insecureAppUrl(prod({})) ?? "", /APP_URL is not set/);
});

test("https, loopback and the explicit escape hatch are accepted", () => {
  assert.equal(
    insecureAppUrl(prod({ APP_URL: "https://kira.example.my" })),
    null,
  );
  // Containers and health checks talk to loopback over plain HTTP.
  assert.equal(
    insecureAppUrl(prod({ APP_URL: "http://127.0.0.1:3000" })),
    null,
  );
  assert.equal(
    insecureAppUrl(prod({ APP_URL: "http://localhost:3000" })),
    null,
  );
  assert.equal(
    insecureAppUrl(
      prod({
        APP_URL: "http://192.168.1.20:3000",
        ALLOW_INSECURE_HTTP: "true",
      }),
    ),
    null,
  );
});

test("development and the build phase are never blocked", () => {
  assert.equal(
    insecureAppUrl({
      NODE_ENV: "development",
      APP_URL: "http://localhost:3000",
    }),
    null,
  );
  // `next build` runs with NODE_ENV=production and no deployment URL.
  assert.equal(
    insecureAppUrl({
      NODE_ENV: "production",
      NEXT_PHASE: "phase-production-build",
    }),
    null,
  );
});

test("a trusted proxy over plaintext is reported", () => {
  const warnings = configWarnings(
    prod({ APP_URL: "http://192.168.1.20", TRUST_PROXY_HEADERS: "true" }),
  );
  assert.ok(
    warnings.some((warning) => warning.includes("trusted on a plaintext")),
  );
});

test("an untrusted proxy on https is reported", () => {
  const warnings = configWarnings(prod({ APP_URL: "https://kira.example.my" }));
  assert.ok(
    warnings.some((warning) => warning.includes("throttling is inert")),
  );
});

test("a short metrics token is reported", () => {
  const warnings = configWarnings(
    prod({ APP_URL: "https://kira.example.my", METRICS_TOKEN: "short" }),
  );
  assert.ok(warnings.some((warning) => warning.includes("METRICS_TOKEN")));
});
