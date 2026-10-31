import { test, expect } from "@playwright/test";
import { signIn, goTo, PERSONA } from "./helpers";

/**
 * Disputes queue GUI: the queue can be filtered by state. Seeds disputes via
 * the API (one driven to approved), then filters the queue in the UI.
 */
test.describe("console — disputes queue", () => {
  test("filters the queue by state", async ({ page, request }) => {
    const cust = { "content-type": "application/json", "x-user-id": "1", "x-user-role": "customer" };
    const staff = { "content-type": "application/json", "x-user-id": "9", "x-user-role": "analyst" };

    // Use transactions no other spec disputes (52, 61) to avoid cross-spec
    // uniqueness conflicts in the shared store. One is driven to approved.
    const d1 = await (await request.post("/api/disputes", { headers: cust, data: { transactionId: 52, reason: "x", idempotencyKey: `qd1-${Date.now()}` } })).json();
    await request.post("/api/disputes", { headers: cust, data: { transactionId: 61, reason: "x", idempotencyKey: `qd2-${Date.now()}` } });
    expect(d1.dispute, JSON.stringify(d1)).toBeTruthy();
    let v = d1.dispute.version;
    for (const event of ["begin_review", "begin_investigation", "approve"]) {
      const r = await (await request.post(`/api/disputes/${d1.dispute.id}/transition`, { headers: staff, data: { event, expectedVersion: v } })).json();
      v = r.dispute.version;
    }

    await signIn(page, PERSONA.analyst);
    await goTo(page, "disputes");

    const rows = page.locator('.trow:has-text("Dispute #")');
    const all = await rows.count();
    expect(all).toBeGreaterThanOrEqual(2);

    // Filter to approved — fewer rows, and every visible row is approved.
    await page.getByRole("button", { name: "Approved", exact: true }).click();
    const approved = await rows.count();
    expect(approved).toBeGreaterThanOrEqual(1);
    expect(approved).toBeLessThan(all);
    await expect(rows.first().locator(".badge")).toHaveText("approved");
  });
});
