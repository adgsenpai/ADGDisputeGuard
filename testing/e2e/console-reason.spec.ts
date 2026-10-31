import { test, expect } from "@playwright/test";
import { signIn, goTo, PERSONA } from "./helpers";

/**
 * A dispute surfaces its card-scheme chargeback reason code, the SLA countdown,
 * and the required-evidence checklist in the case workspace. Uses customer 2's
 * Vodacom transaction (71 — "billed after cancelling"), untouched by other specs.
 */
test.describe("console — chargeback reason code + SLA", () => {
  test("shows the reason code, SLA and required evidence", async ({ page }) => {
    await signIn(page, PERSONA.customer2);
    await goTo(page, "transactions");
    await page.locator(".trow", { hasText: "Vodacom" }).getByRole("button", { name: "Open dispute" }).click();
    await expect(page.locator(".toast--ok")).toBeVisible();

    await goTo(page, "disputes");
    await page.locator('.trow:has-text("(tx 71)")').getByRole("button", { name: "Inspect" }).click();

    // Reason code pill (cancelled recurring -> Visa 13.2) and SLA.
    await expect(page.locator(".codepill")).toContainText("13.2");
    await expect(page.locator(".sla")).toBeVisible();
    await expect(page.locator(".sla")).toContainText(/SLA|Resolved/);

    // Required-evidence checklist is present.
    await expect(page.locator(".evlist li").first()).toBeVisible();
  });
});
