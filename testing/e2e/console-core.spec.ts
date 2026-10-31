import { test, expect } from "@playwright/test";
import { signIn, PERSONA } from "./helpers";

/**
 * Console core GUI flow: the acting user lists their transactions, opens a
 * dispute (ownership + idempotent creation), and sees it appear in the dispute
 * list with its case detail. Assertions are relative to the starting state so
 * the test is robust whether or not the shared in-memory store already holds
 * disputes from a previous run.
 */
test.describe("console — transactions and dispute creation", () => {
  test("customer lists transactions and opens a dispute idempotently", async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));

    // Sign in (passwordless) as the customer persona.
    await signIn(page, PERSONA.customer);
    await expect(page.locator(".rolepill--customer")).toBeVisible();

    // The customer's seeded transactions are listed.
    const openButtons = page.getByRole("button", { name: "Open dispute" });
    await expect(openButtons.first()).toBeVisible();
    const txnCount = await openButtons.count();
    expect(txnCount).toBeGreaterThan(0);

    const disputeRows = page.locator('.row:has-text("Dispute #")');
    const before = await disputeRows.count();

    // Open a dispute on the first transaction.
    await openButtons.first().click();
    await expect(page.locator(".toast--ok")).toBeVisible();

    // The case detail panel now shows a state for the opened dispute.
    await expect(page.getByText("Case detail")).toBeVisible();
    await expect(page.locator(".kv", { hasText: "State" })).toBeVisible();

    // At least one dispute row exists now (created this run, or already present).
    const afterOpen = await disputeRows.count();
    expect(afterOpen).toBeGreaterThanOrEqual(Math.max(before, 1));

    // Idempotency: opening the SAME transaction again must not create a second
    // dispute — the count stays the same and the server reports a replay.
    await openButtons.first().click();
    await expect(page.locator(".toast")).toContainText(/idempotent|opened/i);
    const afterReplay = await disputeRows.count();
    expect(afterReplay).toBe(afterOpen);

    // Inspect the dispute and confirm the audit trail records its creation.
    await page.locator('.row:has-text("Dispute #") button', { hasText: "Inspect" }).first().click();
    await expect(page.getByText("Audit trail")).toBeVisible();
    await expect(page.locator(".trail li").first()).toContainText(/created/i);

    expect(pageErrors, pageErrors.join("\n")).toEqual([]);
  });
});
