import { test } from "node:test";
import assert from "node:assert/strict";
import { auditFilters, auditWhere } from "../lib/audit-filters";

test("audit filters trim the search text and drop empty fields", () => {
  assert.deepEqual(auditFilters({ q: "  resit  " }), {
    query: "resit",
    userId: "",
    action: "",
    from: "",
    to: "",
  });
  assert.deepEqual(auditWhere(auditFilters({})), {});
});

test("a reversed date range is swapped instead of returning nothing", () => {
  const filters = auditFilters({ from: "2026-03-05", to: "2026-03-01" });
  assert.equal(filters.from, "2026-03-01");
  assert.equal(filters.to, "2026-03-05");
});

test("invalid or impossible dates are ignored so stale links still render", () => {
  for (const value of ["2026-13-01", "2026-02-30", "not-a-date", "2026-3-1"]) {
    const filters = auditFilters({ from: value, to: "" });
    assert.equal(filters.from, "", value);
  }
});

test("date bounds follow Malaysia time, not UTC", () => {
  const where = auditWhere(
    auditFilters({ from: "2026-03-01", to: "2026-03-01" }),
  );
  assert.deepEqual(where.createdAt, {
    gte: new Date("2026-02-28T16:00:00.000Z"),
    lte: new Date("2026-03-01T15:59:59.999Z"),
  });
});

test("only the supplied end of the range is bounded", () => {
  assert.deepEqual(auditWhere(auditFilters({ to: "2026-03-01" })).createdAt, {
    lte: new Date("2026-03-01T15:59:59.999Z"),
  });
  assert.deepEqual(auditWhere(auditFilters({ from: "2026-03-01" })).createdAt, {
    gte: new Date("2026-02-28T16:00:00.000Z"),
  });
});

test("oversized values are clipped before reaching the database", () => {
  const filters = auditFilters({ q: "x".repeat(500), user: "u".repeat(80) });
  assert.equal(filters.query.length, 200);
  assert.equal(filters.userId.length, 40);
});

test("search matches details, user names and action codes", () => {
  const or = auditWhere(auditFilters({ q: "resit" })).OR;
  assert.ok(Array.isArray(or));
  assert.equal(or.length, 3);
  assert.deepEqual(or[0], {
    detail: { contains: "resit", mode: "insensitive" },
  });
});

test("user and action filters combine with the search term", () => {
  const where = auditWhere(
    auditFilters({ q: "bayar", user: "user_1", action: "DOKUMEN_CIPTA" }),
  );
  assert.equal(where.userId, "user_1");
  assert.equal(where.action, "DOKUMEN_CIPTA");
  assert.ok(Array.isArray(where.OR));
  assert.equal(where.OR.length, 3);
});

test("array-valued parameters are ignored rather than throwing", () => {
  const filters = auditFilters({ q: ["a", "b"], from: ["2026-01-01"] });
  assert.equal(filters.query, "");
  assert.equal(filters.from, "");
});
