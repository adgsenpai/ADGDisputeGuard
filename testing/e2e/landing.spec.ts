import { test, expect } from "@playwright/test";

/**
 * Landing page GUI regression. Verifies the marketing page renders its core
 * structure and that the WebGL shield degrades to an SVG fallback rather than
 * throwing. A short recording of the page is captured for the showcase.
 */
test.describe("landing page", () => {
  test("renders the hero and core sections without page errors", async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));

    await page.goto("/", { waitUntil: "domcontentloaded" });

    // The document has a sensible title.
    await expect(page).toHaveTitle(/DisputeGuard/i);

    // The primary heading is present.
    const h1 = page.locator("h1").first();
    await expect(h1).toBeVisible();

    // A canvas (Three.js shield) or its SVG fallback is present — either is OK.
    const hasVisual =
      (await page.locator("canvas").count()) > 0 ||
      (await page.locator("svg").count()) > 0;
    expect(hasVisual).toBeTruthy();

    // Let any client animation settle, then capture a beat for the showcase.
    await page.waitForTimeout(1500);

    // No uncaught page errors while the landing page runs.
    expect(pageErrors, pageErrors.join("\n")).toEqual([]);
  });
});
