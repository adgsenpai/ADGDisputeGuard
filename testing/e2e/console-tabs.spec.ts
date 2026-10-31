import { test, expect } from "@playwright/test";
import { signIn, goTo, PERSONA } from "./helpers";

/**
 * Aux tabs smoke: Investigations, Evidence, Audit and Settings render real
 * content. Seeds a dispute with evidence and an investigation via the API
 * (transaction 90, owned by customer 4) so the registers have data.
 */
test.describe("console — aux tabs", () => {
  test("investigations, evidence, audit and settings render", async ({ page, request }) => {
    const c4 = { "content-type": "application/json", "x-user-id": "4", "x-user-role": "customer" };
    const d = await (await request.post("/api/disputes", { headers: c4, data: { transactionId: 90, reason: "x", idempotencyKey: `tabs-${Date.now()}` } })).json();
    expect(d.dispute, JSON.stringify(d)).toBeTruthy();
    await request.post(`/api/disputes/${d.dispute.id}/evidence`, {
      headers: c4,
      data: { upload: { name: "statement.pdf", declaredType: "application/pdf", detectedType: "application/pdf", sizeBytes: 20480 }, scan: "clean" },
    });
    await request.post(`/api/disputes/${d.dispute.id}/investigate`, { headers: c4 });

    await signIn(page, PERSONA.analyst);

    await goTo(page, "investigations");
    await expect(page.getByText("Recent investigations")).toBeVisible();
    await expect(page.locator(".trow", { hasText: `Dispute #${d.dispute.id}` }).first()).toBeVisible();

    await goTo(page, "evidence");
    await expect(page.getByText("Evidence register")).toBeVisible();
    await expect(page.locator(".trow", { hasText: `Dispute #${d.dispute.id}` }).first()).toBeVisible();

    await goTo(page, "audit");
    await expect(page.locator(".card__title", { hasText: "Audit log" })).toBeVisible();
    await expect(page.locator(".trail--full li").first()).toBeVisible();
    // Tamper-evident hash chain verifies.
    await expect(page.locator(".integrity--ok")).toBeVisible();
    await expect(page.locator(".integrity--ok")).toContainText(/Integrity verified/i);

    await goTo(page, "settings");
    await expect(page.locator(".card__title", { hasText: "Your profile" })).toBeVisible();
    await expect(page.locator(".profile__name", { hasText: PERSONA.analyst })).toBeVisible();
  });
});
