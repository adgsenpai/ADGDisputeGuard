import { test, expect } from "@playwright/test";
import { signIn, goTo, PERSONA } from "./helpers";

/**
 * Audit-ready case report PDF: the API compiles a per-case PDF (via pdflatex)
 * and the case workspace offers a download action.
 */
test.describe("console — case report PDF", () => {
  test("the API returns a PDF for a case", async ({ request }) => {
    const c3 = { "content-type": "application/json", "x-user-id": "3", "x-user-role": "customer" };
    const d = await (await request.post("/api/disputes", { headers: c3, data: { transactionId: 80, reason: "I never received this order.", idempotencyKey: `rep-${Date.now()}` } })).json();
    expect(d.dispute, JSON.stringify(d)).toBeTruthy();

    const res = await request.get(`/api/disputes/${d.dispute.id}/report`, { headers: { "x-user-id": "3", "x-user-role": "customer" } });
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("pdf");
    const body = await res.body();
    expect(body.subarray(0, 4).toString("latin1")).toBe("%PDF");
  });

  test("the case workspace offers a download action", async ({ page }) => {
    await signIn(page, PERSONA.customer2);
    await goTo(page, "transactions");
    await page.locator(".trow", { hasText: "Netflix" }).getByRole("button", { name: "Open dispute" }).click();
    await expect(page.locator(".toast--ok")).toBeVisible();
    await goTo(page, "disputes");
    await page.locator('.trow:has-text("(tx 72)")').getByRole("button", { name: "Inspect" }).click();
    await expect(page.getByRole("button", { name: "Download case report" })).toBeVisible();
  });
});
