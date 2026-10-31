import { test, expect } from "@playwright/test";

/**
 * Landing page GUI regression.
 *
 * Verifies the marketing page renders its core structure, that the WebGL
 * shield degrades to an SVG fallback rather than throwing, that the major
 * sections and the documentation link are present, and that no uncaught page
 * errors occur. The test scrolls through each section so the recording doubles
 * as footage for the showcase video.
 */
const SECTIONS = ["approach", "workflow", "transactions", "architecture", "ralph", "documentation"];

test.describe("landing page", () => {
  test("renders hero, sections and docs without page errors", async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));

    await page.goto("/", { waitUntil: "domcontentloaded" });

    // Document title.
    await expect(page).toHaveTitle(/DisputeGuard/i);

    // Primary heading is visible.
    await expect(page.locator("h1").first()).toBeVisible();

    // The Three.js shield canvas or its SVG fallback is present — either is OK.
    const hasVisual =
      (await page.locator("canvas").count()) > 0 ||
      (await page.locator(".shield-scene img, svg").count()) > 0;
    expect(hasVisual, "expected a shield canvas or an SVG/fallback").toBeTruthy();

    // Each major section exists in the DOM and can be scrolled to (also builds
    // the walkthrough footage).
    for (const id of SECTIONS) {
      const section = page.locator(`#${id}`);
      await expect(section, `section #${id} should exist`).toHaveCount(1);
      await section.scrollIntoViewIfNeeded();
      await page.waitForTimeout(600);
    }

    // The engineering specification PDF is linked.
    await expect(
      page.locator('a[href="/documents/engineering-specification.pdf"]').first(),
    ).toHaveCount(1);

    // Back to the top for a clean final frame.
    await page.locator("#top").scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(800);

    // No uncaught page errors while the landing page runs.
    expect(pageErrors, pageErrors.join("\n")).toEqual([]);
  });
});
