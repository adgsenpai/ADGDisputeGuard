import { expect, type Page } from "@playwright/test";

// Persona names used by the passwordless sign-in (see apps/web/lib/personas.ts).
export const PERSONA = {
  customer: "Thabo Nkosi",
  customer2: "Lerato Mokoena",
  analyst: "Nomsa Mahlangu",
  admin: "Mandla Ndlovu",
} as const;

// Sign in via the login screen. Each Playwright test gets a fresh context, so
// the login screen is shown on first navigation.
export async function signIn(page: Page, personaName: string) {
  await page.goto("/console", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: `Sign in as ${personaName}` }).click();
  await expect(page.getByText("DisputeGuard Console")).toBeVisible();
}

// Sign out and sign back in as a different persona (switches RBAC role).
export async function switchPersona(page: Page, personaName: string) {
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.getByRole("button", { name: `Sign in as ${personaName}` }).click();
  await expect(page.getByText("DisputeGuard Console")).toBeVisible();
}
