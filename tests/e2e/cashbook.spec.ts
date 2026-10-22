import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { db } from "../../lib/db";
import { ledgerData, ledgerPageData } from "../../lib/queries";

const email = "cashbook-reader@e2e.local";
const accountId = "cashbook-test-account";
const fundId = "cashbook-test-fund";
const scope = { month: "2001-01", account: accountId, fund: fundId };
const ledgerURL = "/dashboard/buku-tunai?" + new URLSearchParams(scope);

test.beforeAll(async () => {
  if (new URL(process.env.DATABASE_URL!).pathname !== "/kira_rapi_e2e_test")
    throw new Error("Cash book tests require the isolated E2E database.");
  const admin = await db.user.findUniqueOrThrow({
    where: { email: process.env.SEED_ADMIN_EMAIL! },
    select: { passwordHash: true },
  });
  await db.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      name: "Pembaca Buku Tunai",
      passwordHash: admin.passwordHash,
      role: "USER",
      status: "ACTIVE",
    },
  });
  await db.account.upsert({
    where: { id: accountId },
    update: {},
    create: {
      id: accountId,
      code: "CB-TEST",
      name: "Akaun ujian",
      type: "BANK",
    },
  });
  await db.fund.upsert({
    where: { id: fundId },
    update: {},
    create: { id: fundId, code: "CB-TEST", name: "Dana ujian" },
  });
  const otherAccount = await db.account.findFirstOrThrow({
    where: { id: { not: accountId } },
  });
  const otherFund = await db.fund.findFirstOrThrow({
    where: { id: { not: fundId } },
  });
  const base = {
    accountId,
    fundId,
    date: new Date("2001-01-02T00:00:00Z"),
    createdAt: new Date("2001-01-02T09:00:00Z"),
    category: "Utiliti",
    description: "Di luar pilihan",
    reference: "LUAR",
    amountSen: 999999n,
    type: "INCOME" as const,
  };
  await db.ledgerEntry.createMany({
    skipDuplicates: true,
    data: [
      {
        ...base,
        id: "cashbook-opening",
        date: new Date("2000-12-31T00:00:00Z"),
        type: "OPENING",
        amountSen: 100000n,
      },
      ...Array.from({ length: 110 }, (_, index) => {
        const number = String(index + 1).padStart(4, "0");
        return {
          ...base,
          id: `cashbook-${number}`,
          type: index % 2 ? ("EXPENSE" as const) : ("INCOME" as const),
          amountSen: index % 2 ? -300n : 1000n,
          description:
            index % 2 ? `Sasaran bayaran ${number}` : `Terimaan ${number}`,
          reference: `UT-CB-${number}`,
          category: index === 0 ? "Kategori tunggal" : "Utiliti",
        };
      }),
      { ...base, id: "cashbook-other-account", accountId: otherAccount.id },
      { ...base, id: "cashbook-other-fund", fundId: otherFund.id },
      {
        ...base,
        id: "cashbook-next-month",
        date: new Date("2001-02-01T00:00:00Z"),
      },
    ],
  });
  await mkdir(".data/screenshots/cashbook", { recursive: true });
});
test.afterAll(() => db.$disconnect());

test("cash book search and 50-row pages retain full balances, filters and exports", async ({
  page,
}) => {
  // Same date and creation time for all 110 rows exercises the ID tie-breaker.
  const data = await ledgerPageData({ ...scope, page: "2" });
  expect(data.entries).toHaveLength(50);
  expect(data.entries[0].reference).toBe("UT-CB-0051");
  expect(data.running[0]).toBe(118500n);
  expect(data).toMatchObject({
    opening: 100000n,
    income: 55000n,
    expense: 16500n,
    closing: 138500n,
  });
  for (const invalid of ["0", "-3", "invalid"]) {
    expect((await ledgerPageData({ ...scope, page: invalid })).page).toBe(1);
  }
  expect((await ledgerPageData({ ...scope, page: "999999" })).page).toBe(3);
  // Shared report queries must still return every record even if URL parameters include q/page.
  const report = await ledgerData({ ...scope, q: "missing", page: "2" });
  expect(report.entries).toHaveLength(110);
  expect(report.closing).toBe(138500n);

  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/login");
  await page.getByLabel("Alamat e-mel").fill(email);
  await page
    .getByLabel("Kata laluan", { exact: true })
    .fill(process.env.SEED_ADMIN_PASSWORD!);
  await page.getByRole("button", { name: "Log masuk", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto(ledgerURL);
  const rows = page.locator("tbody tr");
  await expect(rows).toHaveCount(50);
  await expect(rows.first()).toContainText("UT-CB-0001");
  await expect(rows.first().locator("td").last()).toHaveText("RM 1,010.00");
  await expect(page.locator(".table-footer")).toContainText(
    "Halaman 1 daripada 3 · 110 transaksi",
  );
  const metrics = await page.locator(".metrics-grid").textContent();
  await page.getByRole("link", { name: "Seterusnya →", exact: true }).click();
  await expect(rows).toHaveCount(50);
  await expect(rows.first()).toContainText("UT-CB-0051");
  await expect(rows.first().locator("td").last()).toHaveText("RM 1,185.00");

  // Searching from page two resets to page one and preserves the other filters.
  await page
    .getByRole("searchbox", { name: "Cari transaksi" })
    .fill("  sAsArAn  ");
  await page.getByRole("button", { name: "Tapis rekod", exact: true }).click();
  await expect(page.locator(".table-footer")).toContainText(
    "Halaman 1 daripada 2 · 55 transaksi",
  );
  await expect(rows).toHaveCount(50);
  await expect(rows.first()).toContainText("UT-CB-0002");
  await expect(rows.first().locator("td").last()).toHaveText("RM 1,007.00");
  await page.getByRole("link", { name: "Seterusnya →", exact: true }).click();
  await expect(rows).toHaveCount(5);
  await expect(rows.first()).toContainText("UT-CB-0102");
  await expect(rows.first().locator("td").last()).toHaveText("RM 1,357.00");
  await expect(rows.last().locator("td").last()).toHaveText("RM 1,385.00");
  expect(await page.locator(".metrics-grid").textContent()).toBe(metrics);
  const params = new URL(page.url()).searchParams;
  for (const [key, value] of Object.entries(scope))
    expect(params.get(key)).toBe(value);
  expect(params.get("q")).toBe("sAsArAn");
  await expect(
    page.getByRole("link", { name: "Seterusnya →", exact: true }),
  ).toHaveCount(0);

  const csvLink = await page
    .getByRole("link", { name: "Eksport CSV", exact: true })
    .getAttribute("href");
  const csv = await page.request.get(csvLink!);
  expect(csv.ok()).toBe(true);
  const lines = (await csv.text()).trim().split("\r\n");
  expect(lines).toHaveLength(112); // Header, opening balance and all 110 transactions.
  expect(lines.at(-1)).toContain(",1385.00");

  await page.setViewportSize({ width: 360, height: 800 });
  await expect(
    page.getByRole("searchbox", { name: "Cari transaksi" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: ".data/screenshots/cashbook/search-mobile.png",
    fullPage: true,
  });
  await page.getByRole("link", { name: "← Sebelum", exact: true }).click();
  await expect(rows).toHaveCount(50);

  for (const [query, reference, balance] of [
    ["ut-cb-0051", "UT-CB-0051", "RM 1,185.00"],
    ["KATEGORI TUNGGAL", "UT-CB-0001", "RM 1,010.00"],
  ]) {
    await page.getByRole("searchbox", { name: "Cari transaksi" }).fill(query);
    await page
      .getByRole("button", { name: "Tapis rekod", exact: true })
      .click();
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText(reference);
    await expect(rows.first().locator("td").last()).toHaveText(balance);
  }
  await page
    .getByRole("searchbox", { name: "Cari transaksi" })
    .fill("Tiada padanan");
  await page.getByRole("button", { name: "Tapis rekod", exact: true }).click();
  await expect(rows).toHaveCount(0);
  await expect(
    page.getByText("Tiada transaksi sepadan. Cuba carian atau penapis lain."),
  ).toBeVisible();
  await expect(page.locator(".table-footer")).toContainText(
    "Halaman 1 daripada 1 · 0 transaksi",
  );
  expect(await page.locator(".metrics-grid").textContent()).toBe(metrics);
  await page.getByRole("button", { name: /Tukar ke English/ }).click();
  await expect(
    page.getByRole("searchbox", { name: "Search transactions" }),
  ).toBeVisible();
  await expect(page.locator(".table-footer")).toContainText(
    "Page 1 of 1 · 0 transactions",
  );
  expect(errors).toEqual([]);
});
