import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveAddress } from "../lib/request-ip";
import { loginBuckets, registerBuckets } from "../lib/throttle-policy";

const reader = (values: Record<string, string>) => (name: string) =>
  values[name];

test("forwarded addresses are only trusted when proxy headers are enabled", () => {
  const headers = reader({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" });
  assert.deepEqual(resolveAddress(headers, true), {
    ip: "203.0.113.7",
    source: "forwarded",
  });
  assert.deepEqual(resolveAddress(headers, false), {
    ip: "unknown",
    source: "unknown",
  });
});

test("malformed or missing addresses fall back safely", () => {
  assert.deepEqual(resolveAddress(reader({}), true), {
    ip: "unknown",
    source: "unknown",
  });
  assert.deepEqual(
    resolveAddress(reader({ "x-forwarded-for": "not-an-ip" }), true),
    { ip: "unknown", source: "unknown" },
  );
  assert.deepEqual(resolveAddress(reader({ "x-forwarded-for": " " }), true), {
    ip: "unknown",
    source: "unknown",
  });
  // Falls through to x-real-ip when the forwarded chain is unusable.
  assert.deepEqual(
    resolveAddress(
      reader({ "x-forwarded-for": "spoof", "x-real-ip": "198.51.100.9" }),
      true,
    ),
    { ip: "198.51.100.9", source: "real" },
  );
});

test("IPv6 addresses and single-entry chains are accepted", () => {
  assert.equal(
    resolveAddress(reader({ "x-forwarded-for": "2001:db8::1" }), true).ip,
    "2001:db8::1",
  );
  assert.equal(
    resolveAddress(reader({ "x-forwarded-for": " 192.0.2.5 " }), true).ip,
    "192.0.2.5",
  );
});

test("login buckets layer a strict pair limit under a looser email limit", () => {
  const { all, resettable } = loginBuckets({
    email: "Bendahari@Contoh.my",
    ip: "203.0.113.7",
  });
  assert.deepEqual(
    all.map((bucket) => bucket.limit).sort((a, b) => a - b),
    [8, 25, 30],
  );
  // A successful sign-in must not clear the per-address total.
  assert.equal(resettable.length, 2);
  assert.ok(
    all.some(
      (bucket) =>
        bucket.limit === 25 &&
        !resettable.some((kept) => kept.key === bucket.key),
    ),
  );
});

test("an unknown address drops the per-address buckets", () => {
  const { all, resettable } = loginBuckets({ email: "a@b.my", ip: "unknown" });
  assert.deepEqual(
    all.map((bucket) => bucket.limit),
    [30],
  );
  assert.equal(resettable.length, 1);
});

test("bucket keys are stable hashes that never expose the email or address", () => {
  const first = loginBuckets({
    email: "bendahari@contoh.my",
    ip: "203.0.113.7",
  });
  const second = loginBuckets({
    email: "bendahari@contoh.my",
    ip: "203.0.113.7",
  });
  assert.deepEqual(
    first.all.map((bucket) => bucket.key),
    second.all.map((bucket) => bucket.key),
  );
  for (const bucket of first.all) {
    assert.match(bucket.key, /^[a-f0-9]{64}$/);
    assert.ok(!bucket.key.includes("bendahari"));
    assert.ok(!bucket.key.includes("203.0.113"));
  }
  const otherAddress = loginBuckets({
    email: "bendahari@contoh.my",
    ip: "203.0.113.8",
  });
  assert.notDeepEqual(
    first.all.map((bucket) => bucket.key),
    otherAddress.all.map((bucket) => bucket.key),
  );
});

test("registration buckets stay small and per-address", () => {
  const buckets = registerBuckets("baru@contoh.my", "203.0.113.7");
  assert.equal(buckets.length, 2);
  assert.ok(buckets.every((bucket) => bucket.limit === 5));
  assert.equal(registerBuckets("baru@contoh.my", "unknown").length, 1);
});
