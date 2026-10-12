import { test, expect, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Alamat e-mel").fill(process.env.SEED_ADMIN_EMAIL!);
  await page
    .getByLabel("Kata laluan", { exact: true })
    .fill(process.env.SEED_ADMIN_PASSWORD!);
  await page.getByRole("button", { name: "Log masuk", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test.beforeAll(async () => {
  await mkdir(".data/screenshots", { recursive: true });
});

test("theme follows system initially and explicit choice persists across reloads and auth screens", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/login");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page
    .getByRole("button", { name: "Aktifkan mod siang", exact: true })
    .click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.goto("/register");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page
    .getByRole("button", { name: "Aktifkan mod malam", exact: true })
    .click();
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/login");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(errors).toEqual([]);
});

test("both themes render financial screens and night mode keeps print white", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.emulateMedia({ colorScheme: "light" });
  await login(page);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.locator(".mobile-menu")).toBeHidden();
  await expect(page.locator(".mobile-close")).toBeHidden();
  await page.screenshot({
    path: ".data/screenshots/redesign-dashboard-day.png",
    fullPage: true,
    animations: "disabled",
  });
  await page
    .getByRole("button", { name: "Aktifkan mod malam", exact: true })
    .click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.screenshot({
    path: ".data/screenshots/redesign-dashboard-night.png",
    fullPage: true,
    animations: "disabled",
  });
  for (const route of [
    "buku-tunai",
    "baucer-resit",
    "yuran",
    "akaun",
    "settings",
    "audit",
    "laporan-excel",
  ]) {
    await page.goto(`/dashboard/${route}`);
    await expect(page.locator("main h1")).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.screenshot({
    path: ".data/screenshots/redesign-excel-night.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.goto("/dashboard/rumusan");
  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".sidebar")).toBeHidden();
  await expect(page.locator(".report-sheet")).toBeVisible();
  expect(
    await page.evaluate(() => getComputedStyle(document.body).backgroundColor),
  ).toBe("rgb(255, 255, 255)");
  await page.pdf({
    path: ".data/screenshots/redesign-print-from-night.pdf",
    format: "A4",
    printBackground: true,
  });
  expect(errors).toEqual([]);
});

test("mobile navigation contains focus, closes with Escape and returns focus", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await login(page);
  const toggle = page.locator('button[aria-controls="workspace-navigation"]');
  await toggle.focus();
  await toggle.press("Enter");
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect
    .poll(() =>
      page.evaluate(() => !!document.activeElement?.closest(".sidebar")),
    )
    .toBe(true);
  const count = await page
    .locator(".sidebar a[href], .sidebar button:not([disabled])")
    .count();
  for (let i = 0; i < count + 2; i++) {
    await page.keyboard.press("Tab");
    expect(
      await page.evaluate(() => !!document.activeElement?.closest(".sidebar")),
    ).toBe(true);
  }
  await page.keyboard.press("Shift+Tab");
  expect(
    await page.evaluate(() => !!document.activeElement?.closest(".sidebar")),
  ).toBe(true);
  await page.keyboard.press("Escape");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(toggle).toBeFocused();
  await page.keyboard.press("Tab");
  expect(
    await page.evaluate(() => !!document.activeElement?.closest(".sidebar")),
  ).toBe(false);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: ".data/screenshots/redesign-mobile-day.png",
    fullPage: true,
    animations: "disabled",
  });
  await page
    .getByRole("button", { name: "Aktifkan mod malam", exact: true })
    .click();
  await page.screenshot({
    path: ".data/screenshots/redesign-mobile-night.png",
    fullPage: true,
    animations: "disabled",
  });
  await toggle.click();
  await page
    .getByRole("link", { name: "Kira Rapi — dashboard", exact: true })
    .click();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await toggle.click();
  await page
    .getByRole("navigation", { name: "Navigasi utama" })
    .getByRole("link", { name: "Laporan Excel", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Jana laporan Excel", exact: true }),
  ).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
});
