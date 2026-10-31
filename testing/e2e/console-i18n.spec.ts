import { test, expect } from "@playwright/test";
import { signIn, PERSONA } from "./helpers";

/**
 * The console can switch language (English / isiZulu / Afrikaans). Switching to
 * isiZulu translates the navigation and KPI labels.
 */
test.describe("console — multi-language", () => {
  test("switches language and translates the UI", async ({ page }) => {
    await signIn(page, PERSONA.analyst);

    // Default English nav label.
    await expect(page.locator('[data-nav="disputes"]')).toContainText("Disputes");

    // Switch to isiZulu.
    await page.getByLabel("Language").selectOption("zu");
    await expect(page.locator('[data-nav="disputes"]')).toContainText("Izikhalazo");
    await expect(page.locator(".kpi__label", { hasText: "Izintengiselwano" }).first()).toBeVisible();

    // Switch to Afrikaans.
    await page.getByLabel("Language").selectOption("af");
    await expect(page.locator('[data-nav="disputes"]')).toContainText("Geskille");
  });
});
