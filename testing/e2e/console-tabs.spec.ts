import { test, expect } from "@playwright/test";
import { signIn, goTo, apiSignIn, PERSONA, UID } from "./helpers";

/**
 * Aux tabs smoke: Investigations, Evidence, Audit and Settings render real
 * content. Seeds a dispute with evidence and an investigation via the API
 * (transaction 90, owned by customer 4) so the registers have data.
 */
test.describe("console — aux tabs", () => {
  test("investigations, evidence, audit and settings render", async ({ page, request }) => {
    await apiSignIn(request, UID.customer4);
    const d = await (await request.post("/api/disputes", { data: { transactionId: 90, reason: "x", idempotencyKey: `tabs-${Date.now()}` } })).json();
    expect(d.dispute, JSON.stringify(d)).toBeTruthy();
    // Evidence is now a real validated file upload (multipart). A 1x1 PNG is valid.
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
    const ev = await request.post(`/api/disputes/${d.dispute.id}/evidence`, {
      multipart: { file: { name: "evidence.png", mimeType: "image/png", buffer: png } },
    });
    expect(ev.ok(), await ev.text()).toBeTruthy();
    await request.post(`/api/disputes/${d.dispute.id}/investigate`, {});

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
