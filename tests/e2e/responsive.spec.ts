import { test, expect, type Page } from "@playwright/test";

/**
 * Responsive coverage.
 *
 * The rest of the suite only ever runs at the desktop viewport, or at 360–390px
 * for the phone checks, so the tablet band (portrait 768 and landscape 1024)
 * was never exercised. That is exactly where the drawer replaces the sidebar
 * and where a wide table starts to compete for space, so a regression there
 * would ship unnoticed.
 *
 * Every assertion is about layout, not pixels: no horizontal page scroll, no
 * text below the readable floor, and touch targets big enough for a thumb.
 */

const VIEWPORTS = [
  { name: "phone", width: 360, height: 800 },
  { name: "tablet portrait", width: 768, height: 1024 },
  { name: "tablet landscape", width: 1024, height: 768 },
] as const;

const ROUTES = [
  ["/dashboard", "dashboard"],
  ["/dashboard/buku-tunai", "cashbook"],
  ["/dashboard/baucer-resit", "vouchers"],
  ["/dashboard/yuran", "fees"],
  ["/dashboard/akaun", "accounts"],
  ["/dashboard/rumusan", "summary"],
  ["/dashboard/laporan-excel", "Excel reports"],
  ["/dashboard/settings", "settings"],
] as const;

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Alamat e-mel").fill(process.env.SEED_ADMIN_EMAIL!);
  await page
    .getByLabel("Kata laluan", { exact: true })
    .fill(process.env.SEED_ADMIN_PASSWORD!);
  await page.getByRole("button", { name: "Log masuk", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

/** The page must not scroll sideways; tables scroll inside their own box. */
async function expectNoPageOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBe(true);
}

for (const viewport of VIEWPORTS) {
  test(`${viewport.name} (${viewport.width}px) fits every screen without sideways scroll`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height,
    });
    await login(page);
    for (const [path] of ROUTES) {
      await page.goto(path);
      await expect(page.locator("main h1").first()).toBeVisible();
      await expectNoPageOverflow(page);
    }
    expect(errors).toEqual([]);
  });
}

test("tablet keeps the sidebar as a drawer and opens it on demand", async ({
  page,
}) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await login(page);

  // Below 1100px the permanent column is gone and the menu button takes over.
  await expect(page.locator(".mobile-menu")).toBeVisible();
  const sidebar = page.locator(".sidebar");
  await expect(sidebar).not.toBeInViewport();

  await page.locator(".mobile-menu").click();
  await expect(sidebar).toBeInViewport();
  // A backdrop appears so a tap outside closes the drawer.
  await expect(page.locator(".nav-backdrop")).toBeVisible();

  // Escape still closes it, and focus returns to the trigger.
  await page.keyboard.press("Escape");
  await expect(sidebar).not.toBeInViewport();
  await expect(page.locator(".mobile-menu")).toBeFocused();

  // Navigating from the drawer works at this width too.
  await page.locator(".mobile-menu").click();
  await sidebar.getByRole("link", { name: "Buku tunai" }).click();
  await expect(page).toHaveURL(/\/dashboard\/buku-tunai$/);
  await expect(page.locator("main h1")).toBeVisible();
  await expectNoPageOverflow(page);
});

test("touch targets stay reachable and text stays readable on a phone", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await login(page);
  await page.goto("/dashboard/buku-tunai");

  // Thumb-sized controls: WCAG 2.5.8 asks for 24px. The menu button and the
  // theme/language toggles share the crowded top bar.
  for (const selector of [".mobile-menu", ".theme-toggle"]) {
    const box = await page.locator(selector).first().boundingBox();
    expect(box, `${selector} should be visible`).not.toBeNull();
    expect(Math.min(box!.width, box!.height)).toBeGreaterThanOrEqual(24);
  }

  // The bell is dropped below 600px on purpose: the top bar has no room for it
  // next to the profile, and the pending count is already on the vouchers link.
  // Asserting the intent keeps someone from "fixing" it back into the bar.
  await expect(page.locator(".topbar .notification")).toBeHidden();
  await expect(
    page.locator('.sidebar a[href="/dashboard/baucer-resit"] .nav-count'),
  ).toBeAttached();

  // Nothing in the main content renders below 11px at this width: 9-10px is
  // unreadable on a phone held at arm's length.
  const tooSmall = await page.evaluate(() => {
    const offenders: string[] = [];
    for (const element of document.querySelectorAll("main *")) {
      const size = Number.parseFloat(window.getComputedStyle(element).fontSize);
      const hasText = [...element.childNodes].some(
        (node) =>
          node.nodeType === Node.TEXT_NODE && (node.textContent ?? "").trim(),
      );
      if (hasText && size < 11) offenders.push(element.className || "?");
    }
    return offenders.slice(0, 5);
  });
  expect(tooSmall).toEqual([]);

  // Inputs are 16px so iOS does not zoom the page when one is focused.
  const inputSize = await page
    .getByRole("searchbox", { name: "Cari transaksi" })
    .evaluate((element) => window.getComputedStyle(element).fontSize);
  expect(inputSize).toBe("16px");
});

test("a wide table scrolls inside its panel and shows the edge shadows", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await login(page);

  // The cash book has the widest table in the app.
  await page.goto("/dashboard/buku-tunai");
  const scroller = page.locator(".table-scroll").first();
  await expect(scroller).toBeVisible();

  const metrics = await scroller.evaluate((element) => ({
    scrollWidth: element.scrollWidth,
    clientWidth: element.clientWidth,
    overscroll: window.getComputedStyle(element).overscrollBehaviorX,
    backgrounds: window.getComputedStyle(element).backgroundImage,
  }));
  // It genuinely overflows, which is what the shadow is there to advertise.
  expect(metrics.scrollWidth).toBeGreaterThan(metrics.clientWidth);
  expect(metrics.overscroll).toBe("contain");
  expect(metrics.backgrounds).toContain("radial-gradient");

  // Scrolling the container moves it; the page itself does not move.
  await scroller.evaluate((element) => {
    element.scrollLeft = element.scrollWidth;
  });
  expect(
    await page.evaluate(() => window.scrollX === 0 || !("scrollX" in window)),
  ).toBe(true);
  await expectNoPageOverflow(page);
});

test("a short table shows no scroll shadow, because nothing is hidden", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await login(page);
  await page.goto("/dashboard/yuran");
  const scroller = page.locator(".table-scroll").first();
  const overflows = await scroller.evaluate(
    (element) => element.scrollWidth > element.clientWidth + 1,
  );
  // On a wide screen the table fits, so the affordance must stay invisible.
  expect(overflows).toBe(false);
});
