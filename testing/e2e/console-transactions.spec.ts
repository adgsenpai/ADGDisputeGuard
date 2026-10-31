import { test, expect } from "@playwright/test";
import { signIn, goTo, PERSONA } from "./helpers";

/**
 * Transactions tab GUI: search and category filtering over the customer's
 * transactions, advisory risk badges, and opening a dispute from a filtered row.
 */
test.describe("console — transactions tab", () => {
  test("searches, filters by category, shows risk and opens a dispute", async ({ page }) => {
    await signIn(page, PERSONA.customer);
    await goTo(page, "transactions");

    const rows = page.locator(".trow--tx");
    const total = await rows.count();
    expect(total).toBeGreaterThan(1);

    // A risk badge renders on rows.
    await expect(page.locator(".riskchip").first()).toBeVisible();

    // Search narrows the list.
    await page.getByLabel("Search transactions").fill("Takealot");
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText("Takealot");

    // Clear, then filter by the Shopping category.
    await page.getByLabel("Search transactions").fill("");
    await page.getByRole("button", { name: "Shopping", exact: true }).click();
    const shopping = await rows.count();
    expect(shopping).toBeGreaterThanOrEqual(1);
    expect(shopping).toBeLessThan(total);

    // Open a dispute from a filtered row.
    await rows.first().getByRole("button", { name: "Open dispute" }).click();
    await expect(page.locator(".toast--ok")).toBeVisible();
  });
});
