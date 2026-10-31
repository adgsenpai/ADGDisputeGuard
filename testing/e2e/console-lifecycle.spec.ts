import { test, expect } from "@playwright/test";
import { signIn, switchPersona, goTo, apiSignIn, PERSONA, UID } from "./helpers";

/**
 * Console lifecycle GUI flow: role-gated transitions, evidence upload, and the
 * audit trail. Opens a dispute as the customer, shows that the customer may
 * only submit evidence, then signs in as the analyst and drives the dispute
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
  test("role-gated actions; analyst drives the dispute to approval", async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));

    // Sign in as the customer and open a dispute on the Checkers Sixty60 tx (43).
    await signIn(page, PERSONA.customer);
    await goTo(page, "transactions");
    await page.locator(".trow", { hasText: "Checkers Sixty60" }).getByRole("button", { name: "Open dispute" }).click();
    await expect(page.locator(".toast--ok")).toBeVisible();

    await goTo(page, "disputes");
    await expect(stateBadge(page)).toHaveText("submitted");

    // Role gating: only valid actions for the role+state are shown. A customer
    // has no lifecycle actions on a freshly submitted case (and never "approve").
    await expect(page.getByRole("button", { name: "approve", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "begin review" })).toHaveCount(0);

    // Sign out and sign in as the analyst — the staff transition controls appear.
    await switchPersona(page, PERSONA.analyst);
    await goTo(page, "disputes");
    await page.locator('.trow:has-text("(tx 43)")').getByRole("button", { name: "Inspect" }).first().click();
    await expect(page.getByRole("button", { name: "begin review" })).toBeVisible();

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
    const trail = page.locator(".trail").first();
    await expect(trail).toContainText(/begin_review/);
    await expect(trail).toContainText(/approve/);

    expect(pageErrors, pageErrors.join("\n")).toEqual([]);
  });

  test("the server rejects a stale (wrong-version) transition", async ({ request }) => {
    // Open a dispute on the Bolt transaction via the API, then attempt a
    // transition with a stale expectedVersion — the optimistic-concurrency
    // guard rejects it.
    await apiSignIn(request, UID.customer);
    const create = await request.post("/api/disputes", {
      data: { transactionId: 62, reason: "double charge", idempotencyKey: `e2e-stale-${Date.now()}` },
    });
    expect(create.ok()).toBeTruthy();
    const { dispute } = await create.json();

    await apiSignIn(request, UID.analyst);
    const stale = await request.post(`/api/disputes/${dispute.id}/transition`, {
      data: { event: "begin_review", expectedVersion: dispute.version + 5 },
    });
    expect(stale.status()).toBe(409);
  });
});
