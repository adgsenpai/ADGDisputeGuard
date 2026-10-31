import { test, expect } from "@playwright/test";

/**
 * Console lifecycle GUI flow: role-gated transitions, evidence upload, and the
 * audit trail. Opens a dispute as the customer, shows that the customer may
 * only submit evidence, then switches to the analyst and drives the dispute
 * through the authorised state machine to approval, checking the state badge
 * and audit trail at each step.
 *
 * Playwright owns the app server for the run, so the store is freshly seeded
 * and the chosen transaction starts with no dispute.
 */
function stateBadge(page: import("@playwright/test").Page) {
  return page.locator(".kv", { hasText: "State" }).locator(".badge");
}

test.describe("console — lifecycle, evidence and audit", () => {
  test("customer submits evidence; analyst drives the dispute to approval", async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));

    await page.goto("/console", { waitUntil: "domcontentloaded" });

    // Open a dispute on the Corner Coffee transaction as the customer.
    const corner = page.locator(".row", { hasText: "Corner Coffee" });
    await corner.getByRole("button", { name: "Open dispute" }).click();
    await expect(page.locator(".toast--ok")).toBeVisible();
    await expect(stateBadge(page)).toHaveText("submitted");

    // Role gating in the UI: the customer may only submit evidence.
    await expect(page.getByRole("button", { name: "evidence submitted" })).toBeVisible();
    await expect(page.getByRole("button", { name: "approve", exact: true })).toHaveCount(0);

    // Evidence upload happy path.
    await page.getByRole("button", { name: "Upload sample evidence" }).click();
    await expect(page.locator(".toast--ok")).toContainText(/Evidence stored/i);

    // Switch to the analyst — the staff transition controls appear.
    await page.locator("#role").selectOption("9");
    await expect(page.getByRole("button", { name: "begin review" })).toBeVisible();
    await expect(page.getByRole("button", { name: "approve", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "evidence submitted" })).toHaveCount(0);

    const auditCountBefore = await page.locator(".trail li").count();

    // Drive the authorised path: submitted -> under_review -> investigating -> approved.
    await page.getByRole("button", { name: "begin review" }).click();
    await expect(page.locator(".toast--ok")).toBeVisible();
    await expect(stateBadge(page)).toHaveText("under review");

    await page.getByRole("button", { name: "begin investigation" }).click();
    await expect(stateBadge(page)).toHaveText("investigating");

    await page.getByRole("button", { name: "approve", exact: true }).click();
    await expect(stateBadge(page)).toHaveText("approved");
    await expect(stateBadge(page)).toHaveClass(/badge--approved/);

    // The audit trail recorded the transitions.
    await expect(page.locator(".trail li")).not.toHaveCount(auditCountBefore);
    const trail = page.locator(".trail");
    await expect(trail).toContainText(/begin_review/);
    await expect(trail).toContainText(/approve/);

    expect(pageErrors, pageErrors.join("\n")).toEqual([]);
  });

  test("the server rejects a stale (wrong-version) transition", async ({ page, request }) => {
    // Open a dispute on City Shuttle via the API, then attempt a transition
    // with a stale expectedVersion — the optimistic-concurrency guard rejects it.
    const headers = { "content-type": "application/json", "x-user-id": "1", "x-user-role": "customer" };
    const create = await request.post("/api/disputes", {
      headers,
      data: { transactionId: 62, reason: "double charge", idempotencyKey: `e2e-stale-${Date.now()}` },
    });
    expect(create.ok()).toBeTruthy();
    const { dispute } = await create.json();

    const staff = { "content-type": "application/json", "x-user-id": "9", "x-user-role": "analyst" };
    const stale = await request.post(`/api/disputes/${dispute.id}/transition`, {
      headers: staff,
      data: { event: "begin_review", expectedVersion: dispute.version + 5 },
    });
    expect(stale.status()).toBe(409);
  });
});
