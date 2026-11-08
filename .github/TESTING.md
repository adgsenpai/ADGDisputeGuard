# Automated testing

The Tests workflow runs on pushes to `main`, version tags, pull requests and manual requests.

- App jobs run unit tests, TypeScript checks and a production build on Node.js 22 and 24.
- The Rust job runs the engine tests, regenerates the equation report and compiles its PDF.
- The browser job builds the app and runs the Chrome Playwright suite. Playwright starts a fresh local app with an isolated data directory and the deterministic investigation fallback. CI does not require Ollama or a model download.

The workflow retains the engine report and browser reports, videos and failure traces for 14 days. Download them from the completed Actions run.

These checks target the committed application. They do not validate local changes that have not been pushed. Model-backed response quality remains separate from deterministic CI checks.

To run the equivalent checks locally:

```sh
npm ci
npm test
npm run typecheck
npm run build
bash engine/run-tests.sh
npx playwright install chrome
npx playwright test --config testing/e2e/playwright.config.ts
```

Use Node.js 22.13 or newer. Rust and LaTeX tools are needed for the engine report. The workflow installs the required PDF tools on its runner.
