import { test, expect, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";

// Regenerates the screenshots that README.md and docs/UI-UX.md embed.
//
// These are the only images in the repository, so they must not drift from
// the running interface. Refresh them with:
//
//   npm run build
//   npm run test:e2e -- docs-screenshots
//   npm run docs:screenshots -- --write
//
// CI publishes the same set as the `docs-screenshots` artefact on every run.

const OUT = ".data/screenshots/docs";

const DAY_MODE = /Aktifkan mod siang|Switch to day mode/i;
const NIGHT_MODE = /Aktifkan mod malam|Switch to night mode/i;
const TO_ENGLISH = /Tukar ke English|Switch to English/i;
const TO_MALAY = /Tukar ke Bahasa Melayu|Switch to Bahasa Melayu/i;

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Alamat e-mel").fill(process.env.SEED_ADMIN_EMAIL!);
  await page
    .getByLabel("Kata laluan", { exact: true })
    .fill(process.env.SEED_ADMIN_PASSWORD!);
  await page.getByRole("button", { name: "Log masuk", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

async function shoot(page: Page, name: string, fullPage = true) {
  // Animations are disabled so panels and charts are captured in their final
  // state instead of mid-transition.
  await page.screenshot({
    path: `${OUT}/${name}.png`,
    fullPage,
    animations: "disabled",
  });
}

async function useTheme(page: Page, theme: "light" | "dark") {
  // An explicit choice wins over the system preference, so the toggle is
  // driven rather than emulated whenever the two disagree.
  await page.emulateMedia({ colorScheme: theme });
  await page.reload();
  if ((await page.locator("html").getAttribute("data-theme")) !== theme) {
    await page
      .getByRole("button", { name: theme === "dark" ? NIGHT_MODE : DAY_MODE })
      .click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
  }
}

async function useLanguage(page: Page, language: "ms" | "en") {
  if ((await page.locator("html").getAttribute("lang")) === language) return;
  await page
    .getByRole("button", { name: language === "en" ? TO_ENGLISH : TO_MALAY })
    .click();
  await expect(page.locator("html")).toHaveAttribute("lang", language);
}

test.beforeAll(async () => {
  await mkdir(OUT, { recursive: true });
});

test("document the dashboard in both themes and both languages", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await login(page);

  await useTheme(page, "light");
  await shoot(page, "dashboard");
  await useTheme(page, "dark");
  await shoot(page, "dashboard-night");

  await useLanguage(page, "en");
  await shoot(page, "dashboard-en-night");
  await useTheme(page, "light");
  await shoot(page, "dashboard-en-day");
  await useLanguage(page, "ms");
});

test("document the dashboard on a phone in both themes", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);

  await useTheme(page, "light");
  await shoot(page, "dashboard-mobile");
  await shoot(page, "mobile");
  await useTheme(page, "dark");
  await shoot(page, "dashboard-mobile-night");

  await useLanguage(page, "en");
  await shoot(page, "reports-en-mobile");
  await useLanguage(page, "ms");
});

test("document the report generator, its night mode and the printed sheet", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await login(page);

  await useTheme(page, "light");
  await page.goto("/dashboard/laporan-excel");
  await expect(page.locator(".report-form").first()).toBeVisible();
  await shoot(page, "laporan-excel");

  await useTheme(page, "dark");
  await shoot(page, "laporan-excel-night");

  // The PDF is the printed sheet, so capture the sheet itself rather than
  // browser print chrome. It stays white in night mode by design.
  await page.goto("/dashboard/rumusan");
  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".sidebar")).toBeHidden();
  const sheet = page.locator(".report-sheet").first();
  await expect(sheet).toBeVisible();
  await sheet.screenshot({
    path: `${OUT}/laporan-excel-pdf.png`,
    animations: "disabled",
  });
});
