import { test, expect } from "@playwright/test";
import { signIn, PERSONA } from "./helpers";

/**
 * Dashboard GUI: the KPI tiles and the three charts render for a signed-in
 * analyst. A couple of disputes are seeded via the API first so the charts
 * have data.
 */
test.describe("console — dashboard", () => {
  test("renders KPI tiles and charts", async ({ page, request }) => {
    const cust = { "content-type": "application/json", "x-user-id": "1", "x-user-role": "customer" };
    await request.post("/api/disputes", {
      headers: cust,
      data: { transactionId: 42, reason: "x", idempotencyKey: `dash-${Date.now()}` },
    });

    await signIn(page, PERSONA.analyst);
    // Dashboard is the default view.
    for (const label of ["Transactions", "Open disputes", "Approved", "Rejected", "Avg advisory risk", "Disputed value"]) {
      await expect(page.locator(".kpi__label", { hasText: label })).toBeVisible();
    }

    // The three charts are present.
    await expect(page.getByText("Disputes by state")).toBeVisible();
    await expect(page.getByText("Disputed value by category")).toBeVisible();
    await expect(page.getByText("Risk distribution")).toBeVisible();

    // At least one chart bar rendered.
    await expect(page.locator(".chart__fill").first()).toBeVisible();
  });
});
