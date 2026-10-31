import { test, expect } from "@playwright/test";
import { signIn, PERSONA } from "./helpers";

/**
 * Polish: the light/dark theme toggle and the ⌘K command palette.
 */
test.describe("console — theme and command palette", () => {
  test("toggles the theme and navigates via the command palette", async ({ page }) => {
    await signIn(page, PERSONA.analyst);

    // Default is dark; toggling sets a light theme on the document element.
    await page.getByRole("button", { name: "Switch to light theme" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await page.getByRole("button", { name: "Switch to dark theme" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

    // Command palette: open, search, run.
    await page.getByRole("button", { name: "Open command palette" }).click();
    await expect(page.locator(".cmdk")).toBeVisible();
    await page.getByLabel("Command palette search").fill("Disputes");
    await page.getByLabel("Command palette search").press("Enter");
    await expect(page.locator(".cmdk")).toHaveCount(0);
    await expect(page.locator('[data-nav="disputes"]')).toHaveClass(/nav__item--active/);

    // The keyboard shortcut also opens it.
    await page.keyboard.press("Control+k");
    await expect(page.locator(".cmdk")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator(".cmdk")).toHaveCount(0);
  });
});
