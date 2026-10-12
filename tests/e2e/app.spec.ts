import { test, expect, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { db } from "../../lib/db";

test.describe.configure({ mode: "serial" });
const adminEmail = process.env.SEED_ADMIN_EMAIL!;
const adminPassword = process.env.SEED_ADMIN_PASSWORD!;
async function login(page: Page, email = adminEmail, password = adminPassword) {
  await page.goto("/login");
  await page.getByLabel("Alamat e-mel").fill(email);
  await page.getByLabel("Kata laluan", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Log masuk" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}
test.beforeAll(async () => {
  if (new URL(process.env.DATABASE_URL!).pathname !== "/kira_rapi_e2e_test")
    throw new Error("E2E tests must use the isolated E2E database.");
  await mkdir(".data/screenshots", { recursive: true });
});
test.afterAll(() => db.$disconnect());

test("anonymous routes are protected and invalid login fails", async ({
  page,
  request,
}) => {
  expect((await request.get("/api/health")).status()).toBe(200);
  expect((await request.get("/api/me")).status()).toBe(401);
  expect((await request.get("/api/export")).status()).toBe(401);
  expect((await request.get("/api/reports?year=2026")).status()).toBe(401);
  expect((await request.get("/api/attachments/unknown")).status()).toBe(401);
  await page.goto("/dashboard/buku-tunai");
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel("Alamat e-mel").fill("nobody@example.invalid");
  await page
    .getByLabel("Kata laluan", { exact: true })
    .fill("incorrect-password");
  await page.getByRole("button", { name: "Log masuk" }).click();
  await expect(page.locator('.flash[role="alert"]')).toContainText(
    "tidak tepat",
  );
});

test("dashboard, modules, mobile navigation and print render without client errors", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await login(page);
  await expect(
    page.getByRole("heading", { name: /Selamat datang/ }),
  ).toBeVisible();
  await page.screenshot({
    path: ".data/screenshots/dashboard-desktop.png",
    fullPage: true,
  });
  for (const [route, heading] of [
    ["buku-tunai", "Buku tunai"],
    ["baucer-resit", "Resit & baucer"],
    ["yuran", "Yuran ahli"],
    ["akaun", "Akaun & dana"],
    ["rumusan", "Rumusan kewangan"],
    ["laporan-excel", "Jana laporan Excel"],
    ["settings", "Tetapan ruang kerja"],
    ["audit", "Jejak audit"],
  ]) {
    await page.goto(`/dashboard/${route}`);
    await expect(
      page.getByRole("heading", { level: 1, name: heading }),
    ).toBeVisible();
  }
  await page.goto("/dashboard/rumusan");
  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".sidebar")).toBeHidden();
  await expect(page.locator(".report-sheet")).toBeVisible();
  await page.pdf({
    path: ".data/screenshots/rumusan.pdf",
    format: "A4",
    printBackground: true,
  });
  await page.emulateMedia({ media: "screen" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dashboard");
  await expect(
    page.getByRole("heading", { name: /Selamat datang/ }),
  ).toBeVisible();
  await expect(page.locator(".chart")).toBeVisible();
  await page.screenshot({
    path: ".data/screenshots/dashboard-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Buka menu" }).click();
  await page
    .getByRole("navigation", { name: "Navigasi utama" })
    .getByRole("link", { name: "Yuran ahli" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Yuran ahli", exact: true }),
  ).toBeVisible();
  for (const route of [
    "yuran",
    "buku-tunai",
    "baucer-resit",
    "akaun",
    "settings",
    "rumusan",
    "laporan-excel",
  ]) {
    await page.goto(`/dashboard/${route}`);
    await expect(page.locator("main h1")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
  expect(errors).toEqual([]);
});

test("draft, attachment, independent approval, payment, export and reversal work end to end", async ({
  page,
  browser,
}) => {
  await login(page);
  await page.goto("/dashboard/baucer-resit#baharu");
  await expect(page.locator("#baharu")).toHaveAttribute("open", "");
  await page.getByLabel("Nama pembayar / penerima").fill("Pembekal Ujian E2E");
  await page.getByLabel("Amaun (RM)", { exact: true }).fill("170.35");
  await page
    .getByLabel("Butiran transaksi")
    .fill("Pembelian bahan program ujian");
  await page.getByLabel("Kategori", { exact: true }).fill("Program komuniti");
  await page.getByRole("button", { name: "Simpan draf", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Draf disimpan" }),
  ).toBeVisible();
  const documentPath = new URL(page.url()).pathname;
  const id = documentPath.split("/").at(-1)!;
  const before = await db.ledgerEntry.aggregate({ _sum: { amountSen: true } });
  await page.locator("#sunting summary").click();
  await page.locator('#sunting input[name="amount"]').fill("171.25");
  await page.getByRole("button", { name: "Simpan perubahan draf" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "dikemas kini" }),
  ).toBeVisible();
  const pdf = await page.pdf({ format: "A4" });
  await page.locator('input[type="file"]').setInputFiles({
    name: "bukti.pdf",
    mimeType: "application/pdf",
    buffer: pdf,
  });
  await page.getByRole("button", { name: "Simpan lampiran" }).click();
  const link = page.getByRole("link", { name: "bukti.pdf" });
  await expect(link).toBeVisible();
  const file = await page.request.get(
    (await link.getAttribute("href")) as string,
  );
  expect(file.status()).toBe(200);
  expect(file.headers()["content-type"]).toBe("application/pdf");
  await page.getByRole("button", { name: "Hantar untuk kelulusan" }).click();
  await expect(
    page.getByText("Dokumen anda perlu diluluskan oleh pentadbir lain."),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Luluskan dokumen" }),
  ).toHaveCount(0);
  const reviewerContext = await browser.newContext({
    baseURL: "http://localhost:3100",
  });
  const review = await reviewerContext.newPage();
  await login(
    review,
    "penyemak@kira-rapi.local",
    process.env.SEED_REVIEWER_PASSWORD!,
  );
  await review.goto(documentPath);
  await review.getByRole("button", { name: "Luluskan dokumen" }).click();
  await expect(review.locator(".heading-actions .status")).toHaveText(
    "Diluluskan",
  );
  await page.goto(documentPath);
  await page.getByRole("button", { name: "Sahkan bayaran" }).click();
  await expect(page.getByText("Telah direkod dalam buku tunai")).toBeVisible();
  const entry = await db.ledgerEntry.findUniqueOrThrow({
    where: { documentId: id },
  });
  expect(entry.amountSen).toBe(-17125n);
  const after = await db.ledgerEntry.aggregate({ _sum: { amountSen: true } });
  expect(after._sum.amountSen).toBe(before._sum.amountSen! - 17125n);
  const exported = await page.request.get("/api/export");
  expect(exported.status()).toBe(200);
  expect(await exported.text()).toContain("Pembelian bahan program ujian");
  await page.locator(".danger-disclosure summary").click();
  await page.getByLabel("Sebab pembatalan").fill("Pembelian ujian dibatalkan");
  await page.getByRole("button", { name: "Sahkan pembatalan" }).click();
  await expect(page.locator(".heading-actions .status")).toHaveText(
    "Dibatalkan",
  );
  expect(
    (await db.ledgerEntry.aggregate({ _sum: { amountSen: true } }))._sum
      .amountSen,
  ).toBe(before._sum.amountSen);
  await reviewerContext.close();
});

test("registration requires approval and ordinary users cannot access management controls", async ({
  page,
  browser,
}) => {
  await page.goto("/register");
  await page.getByLabel("Nama penuh").fill("Pembaca Ujian");
  await page.getByLabel("Alamat e-mel").fill("viewer@e2e.local");
  await page
    .getByLabel("Kata laluan", { exact: true })
    .fill(process.env.E2E_READER_PASSWORD!);
  await page.getByRole("button", { name: "Hantar permohonan" }).click();
  await expect(page.getByRole("status")).toContainText("Permohonan diterima");
  expect(
    (await db.user.findUniqueOrThrow({ where: { email: "viewer@e2e.local" } }))
      .status,
  ).toBe("PENDING");
  const adminContext = await browser.newContext({
    baseURL: "http://localhost:3100",
  });
  const admin = await adminContext.newPage();
  await login(admin);
  await admin.goto("/dashboard/settings");
  await admin
    .getByRole("row")
    .filter({ hasText: "viewer@e2e.local" })
    .getByRole("button", { name: "Aktifkan", exact: true })
    .click();
  await expect(
    admin
      .getByRole("row")
      .filter({ hasText: "viewer@e2e.local" })
      .locator(".status"),
  ).toHaveText("Aktif");
  await login(page, "viewer@e2e.local", process.env.E2E_READER_PASSWORD!);
  await page.goto("/dashboard/settings");
  await expect(
    page.getByRole("heading", { name: "Kata laluan anda" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Cipta pengguna" }),
  ).toHaveCount(0);
  await page.goto("/dashboard/buku-tunai");
  await expect(
    page.getByText("Pindahan antara akaun", { exact: true }),
  ).toHaveCount(0);
  await admin.goto("/dashboard/settings");
  await admin
    .getByRole("row")
    .filter({ hasText: "viewer@e2e.local" })
    .getByRole("button", { name: "Nyahaktif", exact: true })
    .click();
  await expect(
    admin
      .getByRole("row")
      .filter({ hasText: "viewer@e2e.local" })
      .locator(".status"),
  ).toHaveText("Tidak aktif");
  expect((await page.request.get("/api/me")).status()).toBe(401);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login$/);
  await adminContext.close();
});

test("linked Excel package and template PDF download from authenticated report screen", async ({
  page,
}) => {
  test.setTimeout(150_000);
  await login(page);
  await page.goto("/dashboard/laporan-excel");
  await page.screenshot({
    path: ".data/screenshots/laporan-excel.png",
    fullPage: true,
  });
  const year = await page.getByLabel("Tahun laporan").inputValue();
  expect((await page.request.get("/api/reports?year=invalid")).status()).toBe(
    400,
  );
  expect(
    (
      await page.request.get(`/api/reports?year=${year}&report=document`)
    ).status(),
  ).toBe(400);
  const gab = await page.getByLabel("Kolum GAB JKKR").inputValue();
  expect(
    (
      await page.request.get(
        `/api/reports?year=${year}&gab=${gab}&tumpang=${gab}`,
      )
    ).status(),
  ).toBe(400);
  const downloading = page.waitForEvent("download", { timeout: 90_000 });
  await page
    .getByRole("button", { name: "Jana 4 Excel berpaut (.zip)", exact: true })
    .click();
  const archive = await downloading;
  expect(archive.suggestedFilename()).toMatch(/\.zip$/);
  await archive.saveAs(".data/screenshots/laporan-excel.zip");
  await expect(
    page.getByRole("button", { name: "PDF format asal", exact: true }),
  ).toBeEnabled();
  const pdfDownloading = page.waitForEvent("download", { timeout: 110_000 });
  await page
    .getByRole("button", { name: "PDF format asal", exact: true })
    .click();
  const pdf = await pdfDownloading;
  expect(pdf.suggestedFilename()).toMatch(/\.pdf$/);
  await pdf.saveAs(".data/screenshots/laporan-excel.pdf");
  await expect(page.locator(".excel-error[role=alert]")).toHaveCount(0);
  const doc = await db.document.findFirstOrThrow({ where: { status: "PAID" } });
  const response = await page.request.get(
    `/api/reports?year=${year}&format=xlsx&report=document&document=${doc.id}`,
  );
  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toBe("private, no-store");
  expect((await response.body()).subarray(0, 2).toString()).toBe("PK");
});
