# DisputeGuard testing

End-to-end quality layer for the project: one regression command, automated
GUI (browser) tests that drive the real app and record video, and the scripts
that produce the showcase media.

```
testing/
├── run-regression.sh        # runs every suite and fails if any fails
├── record-showcase.mjs      # records the showcase walkthrough + per-flow GIFs
├── e2e/
│   ├── playwright.config.ts  # system Chrome, video on, auto-starts the app
│   ├── helpers.ts            # passwordless sign-in + tab navigation helpers
│   ├── landing.spec.ts
│   ├── console-core.spec.ts
│   ├── console-dashboard.spec.ts
│   ├── console-transactions.spec.ts
│   ├── console-disputes.spec.ts
│   ├── console-lifecycle.spec.ts
│   ├── console-investigate.spec.ts
│   └── console-tabs.spec.ts
└── media/
    ├── videos/showcase.mp4
    ├── gifs/showcase.gif + per-flow GIFs
    ├── test-results/        # raw per-run artifacts (gitignored)
    └── playwright-report/   # generated HTML report (gitignored)
```

## Full regression

Runs the Rust engine tests + LaTeX report, the TypeScript unit tests, and the
Playwright GUI suite. Non-zero exit if any suite fails.

```sh
bash testing/run-regression.sh

# Subsets:
SKIP_E2E=1    bash testing/run-regression.sh   # engine + unit only (no browser)
SKIP_ENGINE=1 bash testing/run-regression.sh   # unit + GUI only (no Rust/LaTeX)
```

| Suite        | What runs                                             |
| ------------ | ----------------------------------------------------- |
| Rust engine  | `engine/run-tests.sh` — 50 unit tests, report 50/50   |
| App unit     | `apps/web` `npm test` — `node:test` cases             |
| GUI / e2e    | Playwright — landing + SaaS console flows, 14 tests     |

## GUI tests (Playwright)

The tests drive the **system Chrome** (`channel: "chrome"`) against a real
production build of the app; Playwright's `webServer` builds and starts it
automatically and records a video of every test under `media/test-results/`.

```sh
# Requires a production build first (the regression script does this for you):
npm run build --prefix apps/web

# Run all GUI tests:
node node_modules/@playwright/test/cli.js test --config testing/e2e/playwright.config.ts

# One spec, headed, for debugging:
node node_modules/@playwright/test/cli.js test --config testing/e2e/playwright.config.ts \
  console-lifecycle.spec.ts --headed
```

The investigation GUI test points Ollama at an unreachable endpoint so it
exercises the deterministic fallback — the allowlist and iteration/tool-call
budget are enforced in application code either way, so the bounded guarantees
hold with or without a model. Set `E2E_OLLAMA_BASE_URL` to test against a real
Ollama instance.

Coverage:

| Spec                          | Flow verified                                                      |
| ----------------------------- | ------------------------------------------------------------------ |
| `landing.spec.ts`             | Hero + sections render, shield/SVG fallback, docs link, no errors  |
| `console-core.spec.ts`        | Sign in, list transactions, open a dispute, idempotent replay, audit |
| `console-dashboard.spec.ts`   | KPI tiles and the three charts render                              |
| `console-transactions.spec.ts`| Search, category filter, risk badge, open from a filtered row      |
| `console-disputes.spec.ts`    | Dispute queue filters by state                                     |
| `console-lifecycle.spec.ts`   | Role gating, evidence upload, analyst path to approval, stale→409   |
| `console-investigate.spec.ts` | Bounded investigation renders; tool-call budget ≤ 3; advisory note  |
| `console-tabs.spec.ts`        | Investigations, Evidence, Audit and Settings tabs render           |
| `console-reason.spec.ts`      | Chargeback reason code, SLA countdown and evidence checklist       |
| `console-report.spec.ts`      | Per-case PDF download (API + UI action)                            |
| `console-polish.spec.ts`      | Light/dark theme toggle and the ⌘K command palette                 |

All console specs sign in through the passwordless persona login (`helpers.ts`).

## Recording the showcase

```sh
npm run build --prefix apps/web      # the recorder needs a production build
node testing/record-showcase.mjs
```

Produces `media/videos/showcase.mp4`, `media/gifs/showcase.gif`, and the
per-flow GIFs `login.gif`, `dashboard.gif` and `case-workspace.gif`. The
recorder seeds portfolio data via the API, starts its own app server on `:3123`,
drives a narrated walkthrough with on-screen captions, records it with Chrome,
and converts the clips to MP4/GIF with `ffmpeg` (must be on `PATH`).

## Requirements

- Node.js 22+, the project dependencies installed (`npm ci`).
- Google Chrome (the tests use the `chrome` channel).
- `ffmpeg` for the showcase MP4/GIF conversion.
- Rust (`rustup`) and `pdflatex` for the engine suite within the regression run.
