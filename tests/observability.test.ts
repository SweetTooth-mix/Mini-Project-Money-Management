import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createNotifier,
  createRecord,
  levelEnabled,
  logLevelFromEnv,
  redact,
  serializeError,
} from "../lib/log";
import { isRequestId, newRequestId, requestIdFrom } from "../lib/request-id";
import { summarize } from "../lib/health-status";

test("log level parsing falls back to info and respects ordering", () => {
  assert.equal(logLevelFromEnv(undefined), "info");
  assert.equal(logLevelFromEnv(""), "info");
  assert.equal(logLevelFromEnv("banana"), "info");
  assert.equal(logLevelFromEnv(" WARN "), "warn");
  assert.equal(logLevelFromEnv("debug"), "debug");
  assert.equal(levelEnabled("error", "warn"), true);
  assert.equal(levelEnabled("info", "warn"), false);
  assert.equal(levelEnabled("warn", "warn"), true);
});

test("secrets are redacted at any depth and long values truncated", () => {
  const redacted = redact({
    user: "bendahari",
    password: "hunter2",
    nested: { sessionToken: "abc", notes: ["ok", { apiKey: "leak" }] },
    long: "x".repeat(900),
  }) as Record<string, unknown>;
  assert.equal(redacted.user, "bendahari");
  assert.equal(redacted.password, "[redacted]");
  const nested = redacted.nested as Record<string, unknown>;
  assert.equal(nested.sessionToken, "[redacted]");
  const notes = nested.notes as unknown[];
  assert.deepEqual(notes[0], "ok");
  assert.deepEqual(notes[1], { apiKey: "[redacted]" });
  assert.match(String(redacted.long), /\[truncated 400\]$/);
  assert.ok(String(redacted.long).length < 600);
});

test("redaction does not mutate the caller's object", () => {
  const input = { password: "secret", detail: "resit RS-1" };
  redact(input);
  assert.deepEqual(input, { password: "secret", detail: "resit RS-1" });
});

test("records carry time, level, service and a serialised error", () => {
  const record = createRecord(
    "error",
    "action.failed",
    { requestId: "req-1234", token: "abc", error: new TypeError("boom") },
    new Date("2026-10-22T00:00:00.000Z"),
    "kira-rapi",
  );
  assert.equal(record.time, "2026-10-22T00:00:00.000Z");
  assert.equal(record.level, "error");
  assert.equal(record.message, "action.failed");
  assert.equal(record.service, "kira-rapi");
  assert.equal(record.requestId, "req-1234");
  assert.equal(record.token, "[redacted]");
  const err = record.err as { name: string; message: string };
  assert.equal(err.name, "TypeError");
  assert.equal(err.message, "boom");
  assert.equal(JSON.stringify(record).includes("TypeError: boom\n"), false);
});

test("non-Error values serialise without throwing", () => {
  assert.equal(serializeError("plain").name, "UnknownError");
  assert.equal(serializeError(undefined).message, "undefined");
  const coded = serializeError(
    Object.assign(new Error("p2002"), { code: "P2002" }),
  );
  assert.equal(coded.code, "P2002");
});

test("request IDs are validated before being trusted or echoed", () => {
  assert.equal(isRequestId("1234abcd-0000-4000-8000-000000000000"), true);
  assert.equal(isRequestId("short"), false);
  assert.equal(isRequestId("has space in it here"), false);
  assert.equal(isRequestId("evil\r\nX-Injected: 1"), false);
  assert.equal(isRequestId(undefined), false);
  assert.equal(isRequestId(12345678), false);

  const withHeader = new Request("http://localhost/api/health", {
    headers: { "x-request-id": "trace-abcdef123456" },
  });
  assert.equal(requestIdFrom(withHeader), "trace-abcdef123456");

  const forged = new Request("http://localhost/api/health", {
    headers: { "x-request-id": "bad header" },
  });
  const generated = requestIdFrom(forged);
  assert.notEqual(generated, "bad header");
  assert.equal(isRequestId(generated), true);
  assert.equal(isRequestId(newRequestId()), true);
});

test("health summarises critical and degraded checks", () => {
  assert.equal(
    summarize({ database: "ok", uploads: "ok", reports: "ok" }).status,
    "ok",
  );
  assert.equal(
    summarize({ database: "ok", uploads: "ok", reports: "degraded" }).status,
    "degraded",
  );
  assert.equal(
    summarize({ database: "ok", uploads: "ok", reports: "unavailable" }).status,
    "degraded",
  );
  assert.equal(
    summarize({ database: "unavailable", uploads: "ok", reports: "ok" }).status,
    "unavailable",
  );
  assert.equal(
    summarize({ database: "ok", uploads: "unavailable", reports: "ok" }).status,
    "unavailable",
  );
});

test("error notifier posts JSON once and never throws", async () => {
  const calls: { url: string; body: string }[] = [];
  const fakeFetch = (async (
    url: string | URL | Request,
    init?: RequestInit,
  ) => {
    calls.push({ url: String(url), body: String(init?.body) });
    return new Response("ok");
  }) as typeof fetch;

  const notify = createNotifier("https://collector.test/ingest", fakeFetch);
  assert.ok(notify);
  await notify(createRecord("error", "boom", { requestId: "req-1" }));
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://collector.test/ingest");
  assert.equal(JSON.parse(calls[0].body).message, "boom");

  assert.equal(createNotifier(undefined, fakeFetch), null);
  assert.equal(createNotifier("https://collector.test", null), null);

  const failing = createNotifier("https://collector.test", (async () => {
    throw new Error("network down");
  }) as typeof fetch);
  await failing!(createRecord("error", "still fine"));
});
