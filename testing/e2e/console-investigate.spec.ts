import { test, expect } from "@playwright/test";

/**
 * Console investigation GUI flow: run the bounded, Ollama-backed investigation
 * from the UI and verify the result renders and the budget/allowlist bounds
 * hold. The test server is configured with an unreachable Ollama endpoint, so
 * the investigation takes the deterministic fallback path — the bounds are
 * enforced in application code either way.
 */
test.describe("console — bounded investigation", () => {
  test("runs an investigation and respects the tool-call budget", async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));

    await page.goto("/console", { waitUntil: "domcontentloaded" });

    // Open a dispute on the Mr Price transaction and inspect it.
    const studio = page.locator(".row", { hasText: "Mr Price" });
    await studio.getByRole("button", { name: "Open dispute" }).click();
    await expect(page.locator(".toast--ok")).toBeVisible();

    // Run the bounded investigation.
    await page.getByRole("button", { name: "Run bounded investigation" }).click();

    // The result panel renders with a summary.
    const summary = page.locator(".summary");
    await expect(summary).toBeVisible({ timeout: 15_000 });

    // It reports either the model or the deterministic fallback (here: fallback).
    const head = summary.locator(".summary__head");
    await expect(head).toContainText(/Deterministic fallback|Ollama model/);

    // The budget bound holds: tool calls must not exceed the configured max (3).
    const headText = (await head.innerText()).trim();
    const toolCalls = Number(headText.match(/(\d+)\s*tool calls/i)?.[1] ?? "NaN");
    expect(Number.isFinite(toolCalls)).toBeTruthy();
    expect(toolCalls).toBeLessThanOrEqual(3);

    // There is a reasoning/trail history and the advisory disclaimer.
    await expect(summary.locator(".trail li").first()).toBeVisible();
    await expect(summary).toContainText(/Advisory only/i);

    expect(pageErrors, pageErrors.join("\n")).toEqual([]);
  });
});
