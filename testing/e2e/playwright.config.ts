import { defineConfig, devices } from "@playwright/test";

/**
 * GUI / end-to-end test configuration for DisputeGuard.
 *
 * Drives the real Next.js app (landing page + /console) in the system Chrome
 * and records a video of every test. The webServer block boots the app on
 * :3000 and is reused if one is already running, so the regression script and
 * local runs behave the same.
 */
const PORT = Number(process.env.E2E_PORT ?? 3000);
const BASE_URL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: ".",
  testMatch: /.*\.spec\.ts/,
  // GUI flows are sequential and share one dev server; keep it deterministic.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [
    ["list"],
    ["html", { outputFolder: "../media/playwright-report", open: "never" }],
  ],
  outputDir: "../media/test-results",
  use: {
    baseURL: BASE_URL,
    channel: "chrome",
    headless: true,
    viewport: { width: 1280, height: 720 },
    video: { mode: "on", size: { width: 1280, height: 720 } },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    actionTimeout: 10_000,
  },
  projects: [
    {
      name: "chrome",
      use: { ...devices["Desktop Chrome"], channel: "chrome" },
    },
  ],
  webServer: {
    command: "npm run start --prefix ../../apps/web -- --port " + PORT,
    url: BASE_URL,
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
    stdout: "pipe",
    stderr: "pipe",
    env: {
      // Force the deterministic investigation fallback so GUI tests do not
      // depend on a background Ollama instance or a pulled model. The showcase
      // recorder uses the real model separately.
      OLLAMA_BASE_URL: process.env.E2E_OLLAMA_BASE_URL ?? "http://127.0.0.1:9",
      OLLAMA_TIMEOUT_MS: "1000",
    },
  },
});
