import { test, expect, type Page } from "@playwright/test";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { db } from "../../lib/db";

/**
 * Attachment authorisation (audit finding F-01).
 *
 * The download route used to check only that a session existed, so any member
 * could read any other member's receipt by asking for its ID. The ID is not a
 * secret: it is printed in the document page, which every member may open.
 *
 * The rule now lives in lib/access.ts: a draft belongs to its author and the
 * managers; anything past DRAFT is part of the book and readable by everyone.
 * This test pins the boundary from the outside, through real HTTP, because the
 * unit test can only prove the function and not the route that must call it.
 */

const uploadDir = process.env.UPLOAD_DIR || ".data/e2e-uploads";
const secret = "SECRET-RESIT-PEMILIK";
const pdf = Buffer.from(`%PDF-1.4\n% ${secret}\n%%EOF\n`);

const outsiderEmail = "outsider@e2e.local";
const outsiderPassword = "outsider-password-12345";

let documentId = "";
let attachmentId = "";
let storedName = "";
let outsiderId = "";

test.beforeAll(async () => {
  if (new URL(process.env.DATABASE_URL!).pathname !== "/kira_rapi_e2e_test")
    throw new Error("Security tests must use the isolated E2E database.");

  const admin = await db.user.findUniqueOrThrow({
    where: { email: process.env.SEED_ADMIN_EMAIL! },
  });
  const [account, fund] = await Promise.all([
    db.account.findFirstOrThrow({ orderBy: { code: "asc" } }),
    db.fund.findFirstOrThrow({ orderBy: { code: "asc" } }),
  ]);

  // An ordinary member: not a manager, so the draft rule is the only thing
  // standing between them and the file.
  const outsider = await db.user.create({
    data: {
      email: outsiderEmail,
      name: "Pembaca Luar",
      role: "USER",
      status: "ACTIVE",
      passwordHash: await bcrypt.hash(outsiderPassword, 12),
    },
  });
  outsiderId = outsider.id;

  const doc = await db.document.create({
    data: {
      number: `SEC-${Date.now()}`,
      type: "BAUCER",
      status: "DRAFT",
      date: new Date(),
      party: "Pembekal Ujian",
      description: "Dokumen ujian kawalan akses",
      category: "Ujian",
      amountSen: 1000n,
      accountId: account.id,
      fundId: fund.id,
      createdById: admin.id,
    },
  });
  documentId = doc.id;

  storedName = `${randomUUID()}.pdf`;
  await mkdir(uploadDir, { recursive: true });
  await writeFile(path.join(uploadDir, storedName), pdf);

  const attachment = await db.attachment.create({
    data: {
      documentId: doc.id,
      fileName: "resit-pemilik.pdf",
      storedName,
      mimeType: "application/pdf",
      size: pdf.length,
    },
  });
  attachmentId = attachment.id;
});

test.afterAll(async () => {
  await db.attachment.deleteMany({ where: { documentId } });
  await db.document.deleteMany({ where: { id: documentId } });
  await db.user.deleteMany({ where: { id: outsiderId } });
  await rm(path.join(uploadDir, storedName), { force: true });
  await db.$disconnect();
});

async function loginAs(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Alamat e-mel").fill(email);
  await page.getByLabel("Kata laluan", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Log masuk", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test("a draft attachment is readable by its author and refused to every other member", async ({
  page,
  browser,
}) => {
  await loginAs(
    page,
    process.env.SEED_ADMIN_EMAIL!,
    process.env.SEED_ADMIN_PASSWORD!,
  );
  const owner = await page.request.get(`/api/attachments/${attachmentId}`);
  expect(owner.status()).toBe(200);
  expect(await owner.text()).toContain(secret);

  const outsiderContext = await browser.newContext({
    baseURL: "http://localhost:3100",
  });
  const outsider = await outsiderContext.newPage();
  await loginAs(outsider, outsiderEmail, outsiderPassword);

  // 404, not 403: a 403 would confirm the ID exists and make the endpoint a
  // way to enumerate other people's attachments.
  const refused = await outsider.request.get(
    `/api/attachments/${attachmentId}`,
  );
  expect(refused.status()).toBe(404);
  expect(await refused.text()).not.toContain(secret);

  // The page must not offer a link it will not honour.
  await outsider.goto(`/dashboard/baucer-resit/${documentId}`);
  await expect(outsider.locator(".attachment-link")).toHaveCount(0);
  await expect(
    outsider.getByText(
      "Lampiran draf hanya boleh dibuka oleh penyedia dan pentadbir.",
    ),
  ).toBeVisible();

  await outsiderContext.close();
});

test("submitting the document makes the attachment readable by the whole organisation", async ({
  browser,
}) => {
  await db.document.update({
    where: { id: documentId },
    data: { status: "PENDING" },
  });

  const context = await browser.newContext({
    baseURL: "http://localhost:3100",
  });
  const member = await context.newPage();
  await loginAs(member, outsiderEmail, outsiderPassword);

  const allowed = await member.request.get(`/api/attachments/${attachmentId}`);
  expect(allowed.status()).toBe(200);
  expect(await allowed.text()).toContain(secret);

  // And the page links to it again.
  await member.goto(`/dashboard/baucer-resit/${documentId}`);
  await expect(member.locator(".attachment-link")).toBeVisible();

  await context.close();
});
