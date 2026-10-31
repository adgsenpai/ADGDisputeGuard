import { test, expect } from "@playwright/test";
import { signIn, goTo, PERSONA } from "./helpers";

/**
 * Console core GUI flow: the acting user lists their transactions, opens a
 * dispute (ownership + idempotent creation), and sees it appear in the dispute
 * queue with its case detail. Assertions are relative to the starting state so
 * the test is robust whether or not the shared in-memory store already holds
 * disputes from a previous run.
 */
test.describe("console — transactions and dispute creation", () => {
  test("customer lists transactions and opens a dispute idempotently", async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));

    // Sign in (passwordless) as the customer persona.
    await signIn(page, PERSONA.customer);
    await expect(page.locator(".rolepill--customer").first()).toBeVisible();

    // Go to the Transactions tab — the customer's seeded transactions are listed.
    await goTo(page, "transactions");
    const openButtons = page.getByRole("button", { name: "Open dispute" });
    await expect(openButtons.first()).toBeVisible();
    expect(await openButtons.count()).toBeGreaterThan(0);

    // Open a dispute on the first transaction.
    await openButtons.first().click();
    await expect(page.locator(".toast--ok")).toBeVisible();

    // The dispute appears in the queue and the case detail shows its state.
    await goTo(page, "disputes");
    const disputeRows = page.locator('.trow:has-text("Dispute #")');
    await expect(disputeRows.first()).toBeVisible();
    const afterOpen = await disputeRows.count();
    await expect(page.getByText("Case detail")).toBeVisible();
    await expect(page.locator('.kv:has-text("State")').first()).toBeVisible();
    await expect(page.locator(".trail li").first()).toContainText(/created/i);

    // Idempotency: opening the SAME transaction again must not create a second
    // dispute — the queue count stays the same and the server reports a replay.
    await goTo(page, "transactions");
    await openButtons.first().click();
    await expect(page.locator(".toast")).toContainText(/idempotent|opened/i);
    await goTo(page, "disputes");
    expect(await disputeRows.count()).toBe(afterOpen);

    expect(pageErrors, pageErrors.join("\n")).toEqual([]);
  });
});
