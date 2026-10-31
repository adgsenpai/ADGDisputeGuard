# Ralph Loop — DisputeGuard Engine Completion

Autonomous loop to complete the DisputeGuard **Rust reference engine** so it
covers every equation and flow in `planning/Software Spec/equations.tex`, each
with tests, all tests green, and the LaTeX report regenerated.

## Per-iteration protocol (do this every loop)

1. Read this file. Pick the **first unchecked** backlog item.
2. Implement it (engine item → `engine/`; app item → `apps/web/`; infra item →
   repo root / `infra/`), always with tests.
3. Run the relevant tests — **all unit tests must pass**:
   - engine: `cd engine && ./run-tests.sh` (cargo tests + report, 0 failed checks)
   - app: `cd apps/web && npm test` (node:test suite)
4. Check the item off in the backlog below (change `[ ]` to `[x]`).
5. **Append a row to `planning/RALPH/RALPH_LOG.md`** (the audit trail): item,
   verification, and the commit hash.
6. Commit and **push** (`git push origin main`) — one commit per item. No
   Claude/Opus attribution lines (user instruction).
7. If every item is checked and all tests are green, emit the completion
   promise. Otherwise end the turn so the loop continues.

## Definition of done

- Every backlog item below is `[x]`.
- `cd engine && ./run-tests.sh` passes (cargo tests + report, 0 failed checks).
- `cd apps/web && npm test` passes.
- The engine reference-implements each spec section, the Next.js app exposes
  the dispute flows with an Ollama-backed bounded investigation, and the
  infrastructure (docker-compose with Ollama) is in place.
- Every completed item is logged in `RALPH_LOG.md`.

## Backlog

- [x] Reference engine scaffold: money, access, lifecycle, service, risk, investigation, samples, report, run-tests.sh
- [x] **Merchant & signal normalisation**: map raw anomaly z-scores to bounded `[0,1]` signals (history, velocity, geography) and add a deterministic merchant signal; tests for boundaries and monotonicity.
- [x] **Velocity z-score (`z_V`)**: implement `z_V = (V - mu) / sigma` with `sigma > 0` guard and unavailable-on-insufficient-history; tests.
- [x] **Full transition table + role gating**: complete `T(S,E)` for all specified states/events and add `actor_may_perform(actor, event, dispute)`; tests for allowed/denied actors and every edge.
- [x] **Audit & event log**: append dispute events + audit events atomically on creation and transition; expose an ordered event history; tests that the log matches the state changes.
- [x] **Evidence upload workflow** (`receive_evidence`): size/type/extension/detected-content checks, random server-side name, scan-required guard (scanner-unavailable != clean), metadata persisted with audit; tests for each rejection path and the happy path.
- [x] **Safe background retries** (`handle_job`): durable idempotency record, retryable vs non-retryable classification, replay returns stored result once; tests for duplicate delivery and non-retryable failure.
- [x] **Risk calculation integration**: `calculate_risk(dispute)` assembling all signals through the normalisation layer, returning either a score or an explicit unavailable-with-reason; tests.
- [x] **Report coverage**: extend the LaTeX report with sections/checks for every new module; confirm `run-tests.sh` regenerates the PDF with 0 failed checks.

### Phase 2 — Next.js application + Ollama + infrastructure

- [x] **App domain core (TS port + tests)**: port the engine's money, access, lifecycle, risk and investigation logic to `apps/web/lib/domain/` as typed TS, with a `node:test` suite (`npm test`). This is the app's source of truth for the flows.
- [x] **Dispute API routes**: Next.js route handlers under `apps/web/app/api/` for create dispute (idempotent, ownership, one-active guard), list/get, lifecycle transition (role-gated, version-checked), and evidence intake validation — backed by the domain core and an in-memory store. Tests for the handlers' logic.
- [x] **Ollama-backed bounded investigation**: an investigation service that drives the bounded loop using a local Ollama model for the structured proposal/summary steps, with the allowlist, read-only tools, and budget enforced in app code (not the prompt). Graceful fallback when Ollama is unreachable. Tests for the bounds/allowlist with the model mocked.
- [x] **App UI**: pages to view transactions, open a dispute, see its lifecycle/audit trail and advisory risk, and run an investigation — wired to the API routes.
- [x] **Infrastructure**: `infra/docker-compose.yml` with the web app + an Ollama service, a web `Dockerfile`, `.env.example`, a model pull/bootstrap script, and README docs for running it.
- [x] **Phase 2 report/docs**: update README and (if useful) the LaTeX report to describe the app + infra; confirm `npm test` and `./run-tests.sh` are both green.

### Phase 3 — Regression + GUI testing + showcase video

Adds an end-to-end quality layer: a single regression command that runs every
suite, automated GUI (browser) tests that drive the real app and record video,
and a showcase video embedded in the README. GUI tests use Playwright driving
the system Chrome; recordings are converted to MP4/GIF with ffmpeg.

Per-item protocol for this phase:

1. Implement the item under `testing/` (or wire scripts / README).
2. Run `bash testing/run-regression.sh` — **all** suites must pass
   (Rust tests + LaTeX report 0 failed checks, TS unit tests, Playwright e2e).
3. Check the item off, append a row to `RALPH_LOG.md`, commit and push (one
   commit per item, no attribution lines).

- [x] **Regression harness**: `testing/run-regression.sh` runs the Rust tests + LaTeX report, the TS `npm test`, and the Playwright e2e suite, failing if any suite fails; Playwright config (system Chrome, video on, auto-starts the app); `.gitignore` for raw run artifacts (keep curated media). Landing smoke spec green.
- [x] **Landing page GUI test**: `testing/e2e/landing.spec.ts` — page renders hero + core sections, WebGL shield or SVG fallback present, no uncaught page errors; video recorded.
- [x] **Console core GUI test**: `testing/e2e/console-core.spec.ts` — switch role, list transactions, open a dispute (ownership/idempotency), see it in the dispute list.
- [x] **Console lifecycle + evidence + audit GUI test**: `testing/e2e/console-lifecycle.spec.ts` — role-gated lifecycle transition, evidence upload validation, audit trail reflects the changes.
- [x] **Console investigation GUI test**: `testing/e2e/console-investigate.spec.ts` — run the bounded investigation from the UI, see the result and that the budget/allowlist bounds hold.
- [x] **Showcase video**: `testing/record-showcase.mjs` drives a narrated end-to-end walkthrough, records it, and ffmpeg produces an optimised `testing/media/videos/showcase.mp4` and `testing/media/gifs/showcase.gif` (plus per-flow GIFs from the spec videos), committed.
- [x] **README showcase + testing docs**: embed the showcase GIF (and link the MP4) in `README.md`, document regression + GUI testing, and add `testing/README.md`; confirm `testing/run-regression.sh` is green.

### Phase 4 — Modern SaaS console (login, RBAC, dashboard, SA data)

Turns the `/console` demo into a polished, modern SaaS application: a
passwordless persona login that also picks the RBAC role (pseudo Mzansi names +
generated African-style avatars), an app shell with a sidebar and many tabs, a
metrics dashboard, and authentic South African transaction data. Every slice
keeps `testing/run-regression.sh` green — the unit tests and the Playwright GUI
specs are updated in lockstep with the UI/data.

Per-item protocol for this phase:

1. Implement the item under `apps/web/` (components, lib, pages), updating the
   affected unit tests and e2e specs so they match.
2. Run `bash testing/run-regression.sh` — **all** suites must pass.
3. Check the item off, append a row to `RALPH_LOG.md`, commit and push (one
   commit per item, no attribution lines).

- [x] **Design system + SA data + personas**: new `console.css` design tokens and base UI; `lib/personas.ts` (Mzansi personas → roles, mapped to backend user ids); generated SVG `Avatar` (`lib/avatar.ts` / component, no external calls, no real people); extend `DEMO_USERS` and rewrite `SEED_TRANSACTIONS` with real South African merchants across several customer personas (keep tx 42 = R1 249,00 for the pinned test). Update `api.test.mjs` owner filter and the e2e merchant references. Regression green.
- [x] **Passwordless login + identity**: a login screen (persona cards with avatar, name, role badge) that signs in without a password and sets the RBAC identity (persisted in `localStorage`), with sign-out; `/console` requires a signed-in persona. Add an e2e sign-in helper and gate spec; update existing specs to sign in first.
- [x] **App shell + navigation**: sidebar + topbar shell with tabbed views (Dashboard, Transactions, Disputes, Investigations, Evidence, Audit, Settings), signed-in persona menu, responsive + theme-aware; migrate the existing transaction/dispute/case functionality into the Transactions and Disputes tabs. Update e2e to navigate tabs.
- [x] **Dashboard**: KPI tiles (open / in-review / approved / rejected disputes, total disputed ZAR, average advisory risk) and accessible inline-SVG charts (disputes by state, disputed amount by category, risk distribution) plus a recent-activity feed, computed from the store. e2e asserts the KPIs render.
- [x] **Transactions tab**: modern table with search, category filters, amount + advisory risk badge, and open-dispute action; respects RBAC visibility. e2e covers search/filter + open.
- [x] **Disputes queue + case workspace**: a filterable dispute queue and a case workspace with a lifecycle stepper, role-gated actions, evidence panel, bounded investigation, and an audit timeline. e2e covers the analyst path + investigation in the new UI.
- [x] **Investigations + Evidence + Audit + Settings tabs**: aggregate views across cases (recent investigations, evidence register, full audit log) and a settings/profile tab. e2e smoke for each tab.
- [x] **Showcase refresh + docs**: re-record the showcase against the new SaaS UI (login → dashboard → flows), refresh README/`testing/README.md`; confirm `testing/run-regression.sh` is fully green.

### Phase 5 — Bank-grade (reason codes, integrity, PDF, i18n, real auth)

Closes the gaps a bank's engineers probe for, with features that are both
impressive and defensible: real card-scheme chargeback reason codes with
regulatory SLAs, a tamper-evident audit log, audit-ready case report PDFs, a
multi-language console, UI polish, and real signed session tokens so the API no
longer trusts a client-sent role. Every slice keeps `testing/run-regression.sh`
green, updating unit tests and e2e specs in lockstep.

Per-item protocol for this phase:

1. Implement the item under `apps/web/` (and `engine/`/scripts if needed),
   updating affected unit tests and e2e specs so they match.
2. Run `bash testing/run-regression.sh` — **all** suites must pass.
3. Check the item off, append a row to `RALPH_LOG.md`, commit and push (one
   commit per item, no attribution lines).

- [x] **Chargeback reason codes + SLAs**: a Visa/Mastercard reason-code catalogue (`lib/chargeback.ts`) with title, description, required evidence, and a regulatory SLA window; derive a suggested code when a dispute is opened; store `openedAt` + reason code per dispute; surface the code, required-evidence checklist, an SLA countdown, and a provisional-credit indicator in the case workspace. Unit tests for the mapping; e2e asserts the code + SLA render.
- [x] **Tamper-evident audit log**: hash-chain every audit event (each entry carries the hash of the previous), add `GET /api/audit/verify` that recomputes the chain, and show an integrity badge in the Audit tab. Unit tests for chain validity and tamper detection; e2e asserts the verified badge.
- [x] **Case report PDF export**: a `GET /api/disputes/[id]/report` (or script) that renders an audit-ready per-case LaTeX report (transaction, reason code, lifecycle, evidence, investigation, audit trail) and compiles a PDF via the existing pdflatex pipeline, with a "Download case report" action. Test the LaTeX generation; e2e asserts the download action exists.
- [x] **Multi-language console (EN/isiZulu/Afrikaans)**: an i18n layer (`lib/i18n.ts`) with dictionaries for the three languages, a language switcher in the shell, console strings translated (persisted choice). Unit test for dictionary completeness; e2e switches language and asserts a translated string.
- [x] **Polish: theme + command palette**: a light/dark theme toggle (tokens already defined; add a light palette) persisted per viewer, and a ⌘K/Ctrl-K command palette to jump between tabs and cases. e2e toggles theme and opens the palette.
- [x] **Real session tokens**: a `POST /api/session` that mints a signed (HMAC) session token for the chosen persona server-side, a `DELETE /api/session` to end it, and request auth that **verifies the token** and derives identity from it — the API no longer trusts `x-user-role` from the client. Update the login to obtain a token, the client to send it, and all unit/e2e/API callers. Unit tests for signing/verification and tamper/expiry rejection.
- [x] **Showcase refresh + docs**: re-record the showcase to feature the bank-grade additions, refresh README/`testing/README.md`; confirm `testing/run-regression.sh` is fully green.

## State

- Loop owner: autonomous session
- Source of truth for scope: `planning/Software Spec/equations.tex` (+ `engine/` reference implementation)
- Phase 1 + Phase 2 completion promise (met): `DISPUTEGUARD ENGINE COMPLETE`
- Phase 3 completion promise (met): `DISPUTEGUARD QA COMPLETE`
- Phase 4 completion promise (met): `DISPUTEGUARD SAAS COMPLETE`
- Phase 5 completion promise: `DISPUTEGUARD BANKGRADE COMPLETE`
- Note: the Phase 5 promise means every Phase 5 backlog item is done and
  `testing/run-regression.sh` passes (all suites green, bank-grade features
  shipped and the showcase re-recorded).
