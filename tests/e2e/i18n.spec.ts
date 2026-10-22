import { test, expect, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { db } from "../../lib/db";

const cookieName = "kira-rapi-lang";
const baseURL = "http://localhost:3100";
const languageAdminEmail = "i18n-admin@e2e.local";

async function englishLogin(page: Page) {
  await page
    .context()
    .addCookies([{ name: cookieName, value: "en", url: baseURL }]);
  await page.goto("/login");
  await page.getByLabel("Email address").fill(languageAdminEmail);
  await page
    .getByLabel("Password", { exact: true })
    .fill(process.env.SEED_ADMIN_PASSWORD!);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test.beforeAll(async () => {
  if (new URL(process.env.DATABASE_URL!).pathname !== "/kira_rapi_e2e_test")
    throw new Error("Language tests require the isolated E2E database.");
  // Use a separate fixture user so the expanded suite does not exhaust the
  // production login throttle for the account used by the other test files.
  const admin = await db.user.findUniqueOrThrow({
    where: { email: process.env.SEED_ADMIN_EMAIL! },
    select: { passwordHash: true },
  });
  await db.user.upsert({
    where: { email: languageAdminEmail },
    update: {},
    create: {
      email: languageAdminEmail,
      name: "Pentadbir Bahasa",
      passwordHash: admin.passwordHash,
      role: "SUPER_ADMIN",
      status: "ACTIVE",
    },
  });
  await mkdir(".data/screenshots/i18n", { recursive: true });
});
test.afterAll(() => db.$disconnect());

test("language defaults to Malay and a persistent cookie controls server-rendered auth screens", async ({
  page,
  browser,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const original = await page.request.get("/login", {
    headers: { "Accept-Language": "en-GB" },
  });
  expect(await original.text()).toMatch(/<html[^>]*lang="ms"/);
  await page
    .context()
    .addCookies([{ name: cookieName, value: "unsupported", url: baseURL }]);
  await page.goto("/login");
  await expect(page.locator("html")).toHaveAttribute("lang", "ms");
  await page
    .getByRole("button", { name: "Tukar ke English", exact: true })
    .click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(
    page.getByRole("heading", { name: "Sign in to your workspace." }),
  ).toBeVisible();
  const preference = (await page.context().cookies()).find(
    (cookie) => cookie.name === cookieName,
  )!;
  expect(preference).toMatchObject({
    value: "en",
    path: "/",
    sameSite: "Lax",
    httpOnly: true,
  });
  expect(preference.expires).toBeGreaterThan(
    Date.now() / 1000 + 300 * 24 * 60 * 60,
  );
  expect(
    await page.evaluate(() => localStorage.getItem("kira-rapi-lang")),
  ).toBeNull();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page.getByRole("link", { name: "Request access", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Request access.", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Full name")).toBeVisible();

  const noJS = await browser.newContext({
    javaScriptEnabled: false,
    storageState: await page.context().storageState(),
    baseURL,
  });
  try {
    const serverPage = await noJS.newPage();
    await serverPage.goto("/login");
    await expect(serverPage.locator("html")).toHaveAttribute("lang", "en");
    await expect(
      serverPage.getByRole("heading", { name: "Sign in to your workspace." }),
    ).toBeVisible();
    await expect(serverPage.getByLabel("Email address")).toBeVisible();
  } finally {
    await noJS.close();
  }

  await page.goto("/login");
  await page.getByLabel("Email address").fill("missing-i18n@example.invalid");
  await page.getByLabel("Password", { exact: true }).fill("incorrect-password");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page.locator(".flash[role=alert]")).toContainText(
    "The email or password is incorrect",
  );
  await page
    .getByRole("button", { name: "Switch to Bahasa Melayu", exact: true })
    .click();
  await expect(page.locator("html")).toHaveAttribute("lang", "ms");
  await expect(page.locator(".flash[role=alert]")).toContainText(
    "E-mel atau kata laluan tidak tepat",
  );
  expect(errors).toEqual([]);
});

test("English navigation works across modules, preserves filters and theme, and fits mobile", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await englishLogin(page);
  await expect(page.getByRole("heading", { name: /^Welcome,/ })).toBeVisible();
  await page.screenshot({
    path: ".data/screenshots/i18n/dashboard-en-day.png",
    fullPage: true,
    animations: "disabled",
  });
  await page
    .getByRole("button", { name: "Switch to night mode", exact: true })
    .click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.screenshot({
    path: ".data/screenshots/i18n/dashboard-en-night.png",
    fullPage: true,
    animations: "disabled",
  });
  await page
    .getByRole("navigation", { name: "Main navigation", exact: true })
    .getByRole("link", { name: "Cash Book", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Cash Book", exact: true }),
  ).toBeVisible();
  await page.goto("/dashboard/buku-tunai?month=2026-05");
  await page
    .getByRole("button", { name: "Switch to Bahasa Melayu", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Buku tunai", exact: true }),
  ).toBeVisible();
  await expect(page).toHaveURL(/month=2026-05/);
  await expect(page.getByLabel("Bulan", { exact: true })).toHaveValue(
    "2026-05",
  );
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page
    .getByRole("button", { name: "Tukar ke English", exact: true })
    .click();
  for (const [route, heading] of [
    ["baucer-resit", "Receipts & vouchers"],
    ["yuran", "Member dues"],
    ["akaun", "Accounts & funds"],
    ["rumusan", "Financial summary"],
    ["laporan-excel", "Generate Excel reports"],
    ["settings", "Workspace settings"],
    ["audit", "Audit trail"],
  ]) {
    await page.goto(`/dashboard/${route}`);
    await expect(
      page.getByRole("heading", { level: 1, name: heading, exact: true }),
    ).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.setViewportSize({ width: 360, height: 800 });
  for (const route of [
    "",
    "buku-tunai",
    "baucer-resit",
    "settings",
    "laporan-excel",
  ]) {
    await page.goto(`/dashboard${route ? `/${route}` : ""}`);
    await expect(page.locator("main h1")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect(
      page.getByRole("button", {
        name: "Switch to Bahasa Melayu",
        exact: true,
      }),
    ).toBeVisible();
  }
  await page.screenshot({
    path: ".data/screenshots/i18n/reports-en-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Open menu", exact: true }).click();
  await page
    .getByRole("navigation", { name: "Main navigation", exact: true })
    .getByRole("link", { name: "Cash Book", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Cash Book", exact: true }),
  ).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  expect(errors).toEqual([]);
});

test("English form actions keep stored values and printable documents in Malay", async ({
  page,
}) => {
  await englishLogin(page);
  await page.goto("/dashboard/baucer-resit#baharu");
  await page.getByLabel("Payer / payee name").fill("Pembayar Ujian Bahasa");
  await page.getByLabel("Amount (RM)", { exact: true }).fill("28.50");
  await page
    .getByLabel("Transaction details")
    .fill("Pembelian barang komuniti");
  await page.getByLabel("Category", { exact: true }).fill("Program komuniti");
  await page
    .getByLabel("Payment method", { exact: true })
    .selectOption("TUNAI");
  await page
    .getByRole("button", { name: "Switch to Bahasa Melayu", exact: true })
    .click();
  await expect(page.getByLabel("Nama pembayar / penerima")).toHaveValue(
    "Pembayar Ujian Bahasa",
  );
  await expect(page.getByLabel("Kaedah bayaran", { exact: true })).toHaveValue(
    "TUNAI",
  );
  await page
    .getByRole("button", { name: "Tukar ke English", exact: true })
    .click();
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.locator(".flash[role=status]")).toContainText(
    "Draft saved.",
  );
  await expect(page.locator(".print-sheet")).toHaveAttribute("lang", "ms");
  await expect(page.locator(".print-sheet")).toContainText("BAUCER BAYARAN");
  await expect(page.locator(".print-sheet")).toContainText("Tunai");
  await expect(page.locator(".print-sheet")).toContainText("ringgit Malaysia");
  await expect(page.locator(".print-sheet")).not.toContainText(
    "PAYMENT VOUCHER",
  );
  const document = await page.locator(".print-sheet").textContent();
  await page
    .getByRole("button", { name: "Switch to Bahasa Melayu", exact: true })
    .click();
  await expect(page.locator("html")).toHaveAttribute("lang", "ms");
  expect(await page.locator(".print-sheet").textContent()).toBe(document);

  await page.goto("/dashboard/rumusan");
  await expect(page.locator(".report-sheet")).toBeVisible();
  const summary = await page.locator(".report-sheet").textContent();
  await page
    .getByRole("button", { name: "Tukar ke English", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Financial summary", exact: true }),
  ).toBeVisible();
  expect(await page.locator(".report-sheet").textContent()).toBe(summary);
  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".sidebar")).toBeHidden();
  await expect(page.locator(".language-toggle")).toBeHidden();
  await expect(page.locator(".report-sheet")).toContainText(
    "LAPORAN KEWANGAN BULANAN",
  );
  await page.pdf({
    path: ".data/screenshots/i18n/summary-from-en.pdf",
    format: "A4",
    printBackground: true,
  });
});

// Needs the Python virtualenv and LibreOffice; the CI browser job has neither.
test.skip(
  process.env.E2E_SKIP_REPORTS === "true",
  "requires the Excel/PDF reporting toolchain",
);
test("English report UI downloads the same four Malay workbooks and Malay PDF", async ({
  page,
}) => {
  test.setTimeout(150_000);
  await englishLogin(page);
  await page.goto("/dashboard/laporan-excel");
  await expect(
    page.getByText("Excel and PDF reports are generated in Bahasa Melayu.", {
      exact: true,
    }),
  ).toBeVisible();
  const download = page.waitForEvent("download", { timeout: 90_000 });
  await page
    .getByRole("button", {
      name: "Generate 4 linked Excel files (.zip)",
      exact: true,
    })
    .click();
  await (await download).saveAs(".data/screenshots/i18n/reports-en.zip");
  await expect(
    page.getByRole("button", { name: "PDF in original format", exact: true }),
  ).toBeEnabled();
  const pdfDownload = page.waitForEvent("download", { timeout: 110_000 });
  await page
    .getByRole("button", { name: "PDF in original format", exact: true })
    .click();
  await (await pdfDownload).saveAs(".data/screenshots/i18n/report-from-en.pdf");
  const pdf = execFileSync(
    "pdftotext",
    ["-layout", ".data/screenshots/i18n/report-from-en.pdf", "-"],
    { encoding: "utf8" },
  );
  expect(pdf).toContain("LAPORAN KEWANGAN BULANAN");
  expect(pdf).toContain("Disediakan Oleh");
  expect(pdf).not.toContain("MONTHLY FINANCIAL REPORT");

  await page
    .getByRole("button", { name: "Switch to Bahasa Melayu", exact: true })
    .click();
  await expect(page.locator("html")).toHaveAttribute("lang", "ms");
  const malayDownload = page.waitForEvent("download", { timeout: 90_000 });
  await page
    .getByRole("button", { name: "Jana 4 Excel berpaut (.zip)", exact: true })
    .click();
  await (await malayDownload).saveAs(".data/screenshots/i18n/reports-ms.zip");
  // Compare worksheet XML, styles and external links. Only the exact generation
  // timestamp from Panduan!B15 (also cached in linked workbooks) may differ.
  const comparison = execFileSync(
    ".venv/bin/python",
    [
      "-c",
      String.raw`
import io, re, zipfile, xml.etree.ElementTree as ET
from pathlib import Path
root=Path('.data/screenshots/i18n')
ns={'s':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
def generated_at(package):
    with zipfile.ZipFile(io.BytesIO(package.read('1. Baucer dan Resit.xlsx'))) as workbook:
        sheets=ET.fromstring(workbook.read('xl/workbook.xml')).findall('s:sheets/s:sheet',ns)
        index=next(i for i,sheet in enumerate(sheets,1) if sheet.get('name')=='Panduan')
        sheet=ET.fromstring(workbook.read(f'xl/worksheets/sheet{index}.xml'))
        assert sheet.find('.//s:c[@r="A15"]/s:is/s:t',ns).text=='Masa dijana'
        value=sheet.find('.//s:c[@r="B15"]/s:is/s:t',ns).text
        assert re.fullmatch(r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z',value)
        return value.encode()
with zipfile.ZipFile(root/'reports-en.zip') as en, zipfile.ZipFile(root/'reports-ms.zip') as ms:
    assert en.namelist()==ms.namelist()
    assert en.read('BACA DAHULU.txt')==ms.read('BACA DAHULU.txt')
    workbooks=[name for name in en.namelist() if name.endswith('.xlsx')]
    assert len(workbooks)==4
    en_time,ms_time=generated_at(en),generated_at(ms)
    for filename in workbooks:
        with zipfile.ZipFile(io.BytesIO(en.read(filename))) as a, zipfile.ZipFile(io.BytesIO(ms.read(filename))) as b:
            assert a.namelist()==b.namelist(), filename
            for part in a.namelist():
                if part.startswith('xl/'):
                    assert a.read(part).replace(en_time,b'GENERATION_TIME')==b.read(part).replace(ms_time,b'GENERATION_TIME'), (filename,part)
print('Four Malay workbooks are identical across UI languages.')
`,
    ],
    { encoding: "utf8" },
  );
  expect(comparison).toContain("Four Malay workbooks are identical");
});
