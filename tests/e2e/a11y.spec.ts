import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// Everything below `serious` is a judgement call in this app (contrast on muted
// helper text, `region` landmarks around tables). Serious and critical are the
// findings that actually stop somebody using the page, so they gate the suite.
const IMPACT = ["serious", "critical"];

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Alamat e-mel").fill(process.env.SEED_ADMIN_EMAIL!);
  await page
    .getByLabel("Kata laluan", { exact: true })
    .fill(process.env.SEED_ADMIN_PASSWORD!);
  await page.getByRole("button", { name: "Log masuk", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

function describeViolations(
  violations: Awaited<ReturnType<AxeBuilder["analyze"]>>["violations"],
) {
  return violations
    .filter((violation) =>
      violation.impact ? IMPACT.includes(violation.impact) : false,
    )
    .map(
      (violation) =>
        `${violation.id} (${violation.impact}): ${violation.help}\n` +
        violation.nodes
          .slice(0, 3)
          .map((node) => `  ${node.target.join(" ")}`)
          .join("\n"),
    );
}

// Problems accumulate across screens so one run reports every failing page
// instead of stopping at the first.
const problems: string[] = [];

async function audit(page: Page, label: string) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  problems.push(
    ...describeViolations(results.violations).map(
      (problem) => `${label}: ${problem}`,
    ),
  );
}

test.afterAll(() => {
  expect(problems, "Accessibility problems").toEqual([]);
});

test("public screens are accessible in both themes", async ({ page }) => {
  for (const theme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: theme });
    await page.goto("/login");
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    await audit(page, `login (${theme})`);

    await page.goto("/register");
    await audit(page, `register (${theme})`);
  }
});

test("financial screens are accessible after signing in", async ({ page }) => {
  await login(page);

  // Both themes, not just the default one. Colour contrast is the rule most
  // likely to regress here: a fixed colour that reads well on paper is unread
  // on the night surface, and no other test would notice.
  for (const theme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: theme });
    for (const [path, label] of [
      ["/dashboard", "dashboard"],
      ["/dashboard/baucer-resit", "vouchers and receipts"],
      ["/dashboard/buku-tunai", "cashbook"],
      ["/dashboard/rumusan", "summary"],
      ["/dashboard/yuran", "fees"],
      ["/dashboard/akaun", "accounts"],
      ["/dashboard/laporan-excel", "Excel reports"],
      ["/dashboard/audit", "audit trail"],
      ["/dashboard/settings", "settings"],
    ] as const) {
      await page.goto(path);
      await expect(page.locator("main, [role=main]").first()).toBeVisible();
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      await audit(page, `${label} (${theme})`);
    }
  }
});

test("a failed sign-in is announced and leaves the page accessible", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("Alamat e-mel").fill("nobody@example.test");
  await page.getByLabel("Kata laluan", { exact: true }).fill("wrong-password");
  await page.getByRole("button", { name: "Log masuk", exact: true }).click();

  // Flash renders role="alert" for errors, so a screen reader hears the
  // failure; the reload must not drop the labels either.
  await expect(page.getByRole("alert")).toBeVisible();
  await audit(page, "login with an error");
});
