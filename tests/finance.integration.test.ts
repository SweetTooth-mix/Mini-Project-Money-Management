import { test, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { db } from "../lib/db";
import {
  createAccount,
  createDocument,
  closePeriod,
  transfer,
  transitionDocument,
  updateDocument,
  type Actor,
  type DocumentInput,
} from "../lib/finance";
import { dateOnly, today } from "../lib/money";
import { ledgerData } from "../lib/queries";
import { auditData, auditExportRows } from "../lib/audit";
import { check, loginBuckets, record, reset } from "../lib/throttle";

if (!new URL(process.env.DATABASE_URL!).pathname.endsWith("_test"))
  throw new Error(
    "Refusing to run integration tests against a non-test database.",
  );
let author: Actor,
  reviewer: Actor,
  reader: Actor,
  input: DocumentInput,
  account2: string;
beforeEach(async () => {
  await db.$executeRawUnsafe(
    'TRUNCATE TABLE "Session", "LoginAttempt", "Attachment", "Due", "Member", "AuditLog", "LedgerEntry", "Document", "Counter", "Account", "Fund", "Organization", "User" CASCADE',
  );
  await db.organization.create({
    data: { id: "main", name: "Test Organisation" },
  });
  const a = await db.user.create({
    data: {
      name: "Author",
      email: "author@test.local",
      role: "SUPER_ADMIN",
      status: "ACTIVE",
      passwordHash: "not-used-in-service-tests",
    },
  });
  const b = await db.user.create({
    data: {
      name: "Reviewer",
      email: "reviewer@test.local",
      role: "ADMIN",
      status: "ACTIVE",
      passwordHash: "not-used-in-service-tests",
    },
  });
  const c = await db.user.create({
    data: {
      name: "Reader",
      email: "reader@test.local",
      role: "USER",
      status: "ACTIVE",
      passwordHash: "not-used-in-service-tests",
    },
  });
  author = a;
  reviewer = b;
  reader = c;
  const fund = await db.fund.create({
    data: { code: "FUND", name: "Test Fund" },
  });
  const account = await createAccount(author, {
    code: "BANK",
    name: "Test Bank",
    type: "BANK",
    openingSen: 100000n,
    fundId: fund.id,
    date: dateOnly(today()),
  });
  const cash = await createAccount(author, {
    code: "CASH",
    name: "Test Cash",
    type: "CASH",
    openingSen: 0n,
    fundId: fund.id,
    date: dateOnly(today()),
  });
  account2 = cash.id;
  input = {
    type: "BAUCER",
    date: dateOnly(today()),
    party: "Supplier",
    description: "Test payment",
    category: "Test",
    amountSen: 12345n,
    accountId: account.id,
    fundId: fund.id,
    paymentMethod: "BANK",
    reference: "",
  };
});
after(() => db.$disconnect());

async function approved(type: "BAUCER" | "RESIT" = "BAUCER") {
  const doc = await createDocument(author, { ...input, type });
  await transitionDocument(author, doc.id, "submit");
  await transitionDocument(reviewer, doc.id, "approve");
  return doc;
}

test("draft does not affect balance; requires independent manager approval", async () => {
  const doc = await createDocument(author, input);
  assert.equal(await db.ledgerEntry.count(), 1);
  await assert.rejects(transitionDocument(author, doc.id, "pay"), /diluluskan/);
  await transitionDocument(author, doc.id, "submit");
  await assert.rejects(
    transitionDocument(author, doc.id, "approve"),
    /pentadbir lain/,
  );
  await assert.rejects(
    transitionDocument(reader, doc.id, "approve"),
    /pentadbir/,
  );
  await transitionDocument(reviewer, doc.id, "approve");
  await transitionDocument(author, doc.id, "pay");
  const balance = await db.ledgerEntry.aggregate({ _sum: { amountSen: true } });
  assert.equal(balance._sum.amountSen, 87655n);
});
test("concurrent duplicate payment posts exactly one entry and audit event", async () => {
  const doc = await approved();
  const results = await Promise.allSettled([
    transitionDocument(author, doc.id, "pay"),
    transitionDocument(reviewer, doc.id, "pay"),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(
    await db.ledgerEntry.count({ where: { documentId: doc.id } }),
    1,
  );
  assert.equal(
    await db.auditLog.count({
      where: { entityId: doc.id, action: "DOKUMEN_PAY" },
    }),
    1,
  );
});
test("paid document cancellation preserves original entry and reverses once", async () => {
  const doc = await approved();
  await transitionDocument(author, doc.id, "pay");
  const original = await db.ledgerEntry.findUniqueOrThrow({
    where: { documentId: doc.id },
  });
  await transitionDocument(author, doc.id, "void", "Pembayaran dibatalkan");
  const reversal = await db.ledgerEntry.findUniqueOrThrow({
    where: { reversalOfId: original.id },
  });
  assert.equal(reversal.amountSen, -original.amountSen);
  assert.equal(await db.ledgerEntry.count(), 3);
  await assert.rejects(
    transitionDocument(author, doc.id, "void", "Pembayaran dibatalkan"),
    /ditutup/,
  );
  assert.equal(
    (await db.ledgerEntry.aggregate({ _sum: { amountSen: true } }))._sum
      .amountSen,
    100000n,
  );
});
test("transfers create a balanced pair and never inflate reported income", async () => {
  await transfer(author, {
    fromId: input.accountId,
    toId: account2,
    fundId: input.fundId,
    amountSen: 505n,
    date: input.date,
    description: "Cash float",
  });
  const pair = await db.ledgerEntry.findMany({
    where: { transferId: { not: null } },
  });
  assert.equal(pair.length, 2);
  assert.equal(pair[0].amountSen + pair[1].amountSen, 0n);
  assert.equal(pair[0].transferId, pair[1].transferId);
  const report = await ledgerData({ month: today().slice(0, 7) });
  assert.equal(report.income, 0n);
  assert.equal(report.expense, 0n);
  assert.equal(report.closing, 100000n);
  await assert.rejects(
    transfer(reader, {
      fromId: input.accountId,
      toId: account2,
      fundId: input.fundId,
      amountSen: 1n,
      date: input.date,
      description: "Forbidden",
    }),
    /pentadbir/,
  );
});
test("closed periods block retroactive documents and payment posting", async () => {
  const yesterday = new Date(input.date);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const doc = await createDocument(author, { ...input, date: yesterday });
  await transitionDocument(author, doc.id, "submit");
  await transitionDocument(reviewer, doc.id, "approve");
  await closePeriod(author, yesterday);
  await assert.rejects(
    createDocument(author, { ...input, date: yesterday }),
    /dikunci/,
  );
  await assert.rejects(
    transitionDocument(author, doc.id, "pay", "", yesterday),
    /dikunci/,
  );
  assert.equal(
    await db.ledgerEntry.count({ where: { documentId: doc.id } }),
    0,
  );
  await transitionDocument(author, doc.id, "pay");
});
test("dues settle only when receipt posts and reopen when reversed", async () => {
  const member = await db.member.create({
    data: { code: "M1", name: "Member", monthlySen: 1000n },
  });
  const due = await db.due.create({
    data: { memberId: member.id, year: 2026, month: 10, amountSen: 1000n },
  });
  const doc = await createDocument(
    author,
    { ...input, type: "RESIT", amountSen: 999999n },
    due.id,
  );
  assert.equal(doc.amountSen, 1000n);
  assert.equal(
    (await db.due.findUniqueOrThrow({ where: { id: due.id } })).paidAt,
    null,
  );
  await assert.rejects(createDocument(author, input, due.id), /sudah/);
  await transitionDocument(author, doc.id, "submit");
  await transitionDocument(reviewer, doc.id, "approve");
  await transitionDocument(author, doc.id, "pay");
  assert.ok((await db.due.findUniqueOrThrow({ where: { id: due.id } })).paidAt);
  await transitionDocument(author, doc.id, "void", "Resit tersalah rekod");
  const reopened = await db.due.findUniqueOrThrow({ where: { id: due.id } });
  assert.equal(reopened.paidAt, null);
  assert.equal(reopened.documentId, null);
});
test("approved document retains organization snapshot", async () => {
  const doc = await approved();
  await db.organization.update({
    where: { id: "main" },
    data: { name: "Renamed" },
  });
  const stored = await db.document.findUniqueOrThrow({ where: { id: doc.id } });
  assert.equal((stored.snapshot as { name: string }).name, "Test Organisation");
});
test("database enforces append-only ledger/audit and immutable submitted values", async () => {
  const doc = await approved();
  await transitionDocument(author, doc.id, "pay");
  const entry = await db.ledgerEntry.findUniqueOrThrow({
    where: { documentId: doc.id },
  });
  await assert.rejects(
    db.ledgerEntry.delete({ where: { id: entry.id } }),
    /append-only/,
  );
  await assert.rejects(
    db.ledgerEntry.update({
      where: { id: entry.id },
      data: { amountSen: -1n },
    }),
    /append-only/,
  );
  await assert.rejects(
    db.document.update({ where: { id: doc.id }, data: { amountSen: 1n } }),
    /immutable/,
  );
  await assert.rejects(
    db.auditLog.deleteMany({ where: { entityId: doc.id } }),
    /append-only/,
  );
});
test("disabled actors cannot write even with a previously issued role", async () => {
  await db.user.update({
    where: { id: author.id },
    data: { status: "DISABLED" },
  });
  await assert.rejects(createDocument(author, input), /Sesi berubah/);
});

test("only the creator can edit a draft, and submission freezes its financial content", async () => {
  const doc = await createDocument(author, input);
  await assert.rejects(
    updateDocument(reviewer, doc.id, { ...input, amountSen: 1n }),
    /penyedia/,
  );
  await updateDocument(author, doc.id, { ...input, amountSen: 999n });
  assert.equal(
    (await db.document.findUniqueOrThrow({ where: { id: doc.id } })).amountSen,
    999n,
  );
  await transitionDocument(author, doc.id, "submit");
  await assert.rejects(updateDocument(author, doc.id, input), /draf/);
  assert.equal(
    await db.auditLog.count({
      where: { entityId: doc.id, action: "DOKUMEN_SUNTING" },
    }),
    1,
  );
});

test("only failures count towards a login throttle and success clears them", async () => {
  const buckets = loginBuckets({
    email: "author@test.local",
    ip: "203.0.113.7",
  });
  // A successful sign-in must not consume the shared address budget.
  await reset(buckets.resettable);
  assert.equal((await check(buckets.all)).allowed, true);

  for (let attempt = 0; attempt < 8; attempt += 1) {
    assert.equal((await check(buckets.all)).allowed, true);
    await record(buckets.all);
  }
  const blocked = await check(buckets.all);
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.retryAfterSeconds > 0);
  assert.ok(blocked.retryAfterSeconds <= 15 * 60);

  // Clearing the account buckets restores access without touching the address total.
  await reset(buckets.resettable);
  assert.equal((await check(buckets.all)).allowed, true);
  const addressBucket = buckets.all.find((bucket) => bucket.limit === 25)!;
  const stored = await db.loginAttempt.findUniqueOrThrow({
    where: { key: addressBucket.key },
  });
  assert.equal(stored.attempts, 8);
});

test("concurrent failures do not lose throttle increments", async () => {
  const buckets = loginBuckets({
    email: "race@test.local",
    ip: "198.51.100.4",
  });
  await Promise.all(
    Array.from({ length: 5 }, async () => {
      await check(buckets.all);
      await record(buckets.all);
    }),
  );
  const pair = buckets.all.find((bucket) => bucket.limit === 8)!;
  const stored = await db.loginAttempt.findUniqueOrThrow({
    where: { key: pair.key },
  });
  assert.equal(stored.attempts, 5);
});

test("audit log filters by user, action, search text and Malaysia date range", async () => {
  const doc = await createDocument(author, input);
  await transitionDocument(author, doc.id, "submit");
  await transitionDocument(reviewer, doc.id, "approve");

  const all = await auditData({});
  assert.equal(all.count, 3);
  assert.deepEqual(all.actions.slice().sort(), [
    "DOKUMEN_APPROVE",
    "DOKUMEN_CIPTA",
    "DOKUMEN_SUBMIT",
  ]);

  const byReviewer = await auditData({ user: reviewer.id });
  assert.equal(byReviewer.count, 1);
  assert.equal(byReviewer.logs[0].action, "DOKUMEN_APPROVE");

  const byAction = await auditData({ action: "DOKUMEN_CIPTA" });
  assert.equal(byAction.count, 1);

  // Every entry for this document mentions its number in the detail column.
  const byText = await auditData({ q: doc.number });
  assert.equal(byText.count, 3);

  const miss = await auditData({ q: "tiada-yang-sepadan" });
  assert.equal(miss.count, 0);
  assert.equal(miss.logs.length, 0);

  const todayRange = await auditData({ from: today(), to: today() });
  assert.equal(todayRange.count, 3);

  const past = await auditData({ to: "2000-01-01" });
  assert.equal(past.count, 0);

  const exported = await auditExportRows({ action: "DOKUMEN_CIPTA" });
  assert.equal(exported.length, 1);
  assert.equal(exported[0].user.email, "author@test.local");
});
