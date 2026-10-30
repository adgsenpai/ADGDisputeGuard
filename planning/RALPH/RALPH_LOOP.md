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
- [ ] **Ollama-backed bounded investigation**: an investigation service that drives the bounded loop using a local Ollama model for the structured proposal/summary steps, with the allowlist, read-only tools, and budget enforced in app code (not the prompt). Graceful fallback when Ollama is unreachable. Tests for the bounds/allowlist with the model mocked.
- [ ] **App UI**: pages to view transactions, open a dispute, see its lifecycle/audit trail and advisory risk, and run an investigation — wired to the API routes.
- [ ] **Infrastructure**: `infra/docker-compose.yml` with the web app + an Ollama service, a web `Dockerfile`, `.env.example`, a model pull/bootstrap script, and README docs for running it.
- [ ] **Phase 2 report/docs**: update README and (if useful) the LaTeX report to describe the app + infra; confirm `npm test` and `./run-tests.sh` are both green.

## State

- Loop owner: autonomous session
- Source of truth for scope: `planning/Software Spec/equations.tex` (+ `engine/` reference implementation)
- Completion promise: `DISPUTEGUARD ENGINE COMPLETE`
- Note: the promise now means **all** backlog items (Phase 1 + Phase 2) are done and all test suites are green.
