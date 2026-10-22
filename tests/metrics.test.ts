import { test } from "node:test";
import assert from "node:assert/strict";
import {
  durationBuckets,
  escapeLabel,
  MetricsRegistry,
  normalizeMethod,
  normalizeRoute,
  statusClass,
} from "../lib/metrics";

test("routes are labelled by shape, never by id", () => {
  assert.equal(normalizeRoute("/"), "/");
  assert.equal(normalizeRoute("/dashboard"), "/dashboard");
  assert.equal(normalizeRoute("/dashboard?month=2026-10"), "/dashboard");
  assert.equal(normalizeRoute("/api/health"), "/api/health");
  assert.equal(
    normalizeRoute("/api/attachments/doc_1"),
    "/api/attachments/doc_1",
  );
  assert.equal(
    normalizeRoute("/api/attachments/cma1b2c3d4e5f6g7h8i9j0k1"),
    "/api/attachments/:id",
  );
  assert.equal(
    normalizeRoute(
      "/dashboard/baucer-resit/3f2504e0-4f89-11d3-9a0c-0305e82c3301",
    ),
    "/dashboard/baucer-resit/:id",
  );
  assert.equal(
    normalizeRoute("/dashboard/baucer-resit/42"),
    "/dashboard/baucer-resit/:id",
  );
  // A single long segment is truncated in place...
  assert.equal(normalizeRoute(`/${"x".repeat(200)}`).length, 41);
  // ...and a path that stays long afterwards falls back to one bucket.
  assert.equal(
    normalizeRoute(
      `/${["yyyy", "zzzz", "wwww", "vvvv"].map((s) => s.repeat(10)).join("/")}`,
    ),
    "/other",
  );
});

test("unexpected methods collapse into OTHER", () => {
  assert.equal(normalizeMethod("get"), "GET");
  assert.equal(normalizeMethod("POST"), "POST");
  assert.equal(normalizeMethod("PROPFIND"), "OTHER");
  assert.equal(statusClass(200), "2xx");
  assert.equal(statusClass(503), "5xx");
  assert.equal(statusClass(0), "unknown");
});

test("label values are escaped for the exposition format", () => {
  assert.equal(escapeLabel('a"b'), 'a\\"b');
  assert.equal(escapeLabel("a\\b"), "a\\\\b");
  assert.equal(escapeLabel("a\nb"), "a\\nb");
});

test("a sample lands in every bucket at or above its duration", () => {
  const registry = new MetricsRegistry();
  registry.record({
    method: "GET",
    route: "/dashboard",
    status: 200,
    durationMs: 120,
  });
  const [series] = registry.snapshot().durations;

  // 120ms is above 0.1s and at or below everything from 0.25s upwards.
  const expected = durationBuckets.map((bound) => (0.12 <= bound ? 1 : 0));
  assert.deepEqual(series.buckets, expected);
  assert.equal(series.count, 1);
  assert.ok(Math.abs(series.sum - 0.12) < 1e-9);
});

test("status classes are counted separately for the same route", () => {
  const registry = new MetricsRegistry();
  for (const status of [200, 200, 401, 500])
    registry.record({ method: "GET", route: "/api/me", status, durationMs: 5 });
  const requests = registry
    .snapshot()
    .requests.filter((row) => row.route === "/api/me");
  assert.deepEqual(requests.map((row) => `${row.status}:${row.count}`).sort(), [
    "2xx:2",
    "4xx:1",
    "5xx:1",
  ]);
});

test("the series limit is enforced and reported", () => {
  const registry = new MetricsRegistry();
  for (let index = 0; index < 205; index += 1)
    registry.record({
      method: "GET",
      route: `/page-${index}`,
      status: 200,
      durationMs: 1,
    });
  const snapshot = registry.snapshot();
  assert.equal(snapshot.durations.length, 200);
  assert.equal(snapshot.dropped, 5);
});

test("exposition carries the histogram invariants Prometheus expects", () => {
  const registry = new MetricsRegistry();
  registry.record({
    method: "GET",
    route: "/dashboard",
    status: 200,
    durationMs: 40,
  });
  registry.record({
    method: "GET",
    route: "/dashboard",
    status: 200,
    durationMs: 900,
  });
  const text = registry.render();

  const infinity = /_bucket\{[^}]*le="\+Inf"\} (\d+)/.exec(text);
  const count = /_count\{[^}]*\} (\d+)/.exec(text);
  assert.equal(infinity?.[1], "2");
  assert.equal(count?.[1], "2");

  // Bucket counts never decrease as the bound grows.
  const bounds = [...text.matchAll(/_bucket\{[^}]*le="([\d.]+)"\} (\d+)/g)].map(
    (match) => ({ bound: Number(match[1]), value: Number(match[2]) }),
  );
  assert.deepEqual(
    bounds.map((row) => row.bound),
    [...durationBuckets],
  );
  for (let index = 1; index < bounds.length; index += 1)
    assert.ok(bounds[index].value >= bounds[index - 1].value);
});

test("each metric is described exactly once", () => {
  const registry = new MetricsRegistry();
  registry.record({
    method: "GET",
    route: "/login",
    status: 200,
    durationMs: 12,
  });
  registry.recordError("/dashboard/rumusan");
  const text = registry.render();

  for (const name of [
    "kira_http_requests_total",
    "kira_http_request_duration_seconds",
    "kira_request_errors_total",
    "kira_metrics_dropped_series_total",
    "kira_process_uptime_seconds",
  ]) {
    assert.equal(
      text.split(`# TYPE ${name} `).length - 1,
      1,
      `${name} must have a single TYPE line`,
    );
    assert.equal(
      text.split(`# HELP ${name} `).length - 1,
      1,
      `${name} must have a single HELP line`,
    );
  }
  assert.match(
    text,
    /kira_request_errors_total\{route="\/dashboard\/rumusan"\} 1/,
  );
  assert.match(text, /^kira_process_uptime_seconds \d+\.\d{3}$/m);
});

test("an empty registry renders valid, scrapeable output", () => {
  const text = new MetricsRegistry().render();
  assert.match(text, /kira_metrics_dropped_series_total 0/);
  assert.doesNotMatch(text, /kira_http_requests_total\{/);
  assert.ok(text.endsWith("\n"));
});

test("reset clears counters for a fresh test run", () => {
  const registry = new MetricsRegistry();
  registry.record({
    method: "GET",
    route: "/login",
    status: 200,
    durationMs: 3,
  });
  registry.recordError("/login");
  registry.reset();
  const snapshot = registry.snapshot();
  assert.deepEqual(snapshot.requests, []);
  assert.deepEqual(snapshot.errors, []);
  assert.equal(snapshot.dropped, 0);
});
