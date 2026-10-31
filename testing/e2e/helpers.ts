import { expect, type APIRequestContext, type Page } from "@playwright/test";

// Persona names used by the passwordless sign-in (see apps/web/lib/personas.ts).
export const PERSONA = {
  customer: "Thabo Nkosi",
  customer2: "Lerato Mokoena",
  analyst: "Nomsa Mahlangu",
  admin: "Mandla Ndlovu",
} as const;

// Persona user ids (match apps/web/lib/personas.ts).
export const UID = { customer: 1, customer2: 2, customer3: 3, customer4: 4, analyst: 9, admin: 99 } as const;

// Authenticate the API request context as a demo persona. The dg_session cookie
// is stored in the request context and sent on subsequent calls; calling it
// again switches the active identity. API calls carry no Origin header, so the
// proxy's cross-origin check does not apply to them.
export async function apiSignIn(request: APIRequestContext, userId: number) {
  const res = await request.post("/api/auth", { data: { action: "demo", userId } });
  expect(res.ok(), `demo sign-in for user ${userId} failed`).toBeTruthy();
}

// Sign in via the login screen. Each Playwright test gets a fresh context, so
// the login screen is shown on first navigation.
export async function signIn(page: Page, personaName: string) {
  await page.goto("/console", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: `Sign in as ${personaName}` }).click();
  await expect(page.getByTestId("console-shell")).toBeVisible();
}

// Sign out and sign back in as a different persona (switches RBAC role).
export async function switchPersona(page: Page, personaName: string) {
  await page.getByRole("button", { name: "Sign out" }).first().click();
  await page.getByRole("button", { name: `Sign in as ${personaName}` }).click();
  await expect(page.getByTestId("console-shell")).toBeVisible();
}

// Navigate to a tab via the sidebar nav.
export async function goTo(page: Page, nav: string) {
  await page.locator(`[data-nav="${nav}"]`).click();
}
