# Ralph Loop — DisputeGuard Engine Completion

Autonomous loop to complete the DisputeGuard **Rust reference engine** so it
covers every equation and flow in `planning/Software Spec/equations.tex`, each
with tests, all tests green, and the LaTeX report regenerated.

## Per-iteration protocol (do this every loop)

1. Read this file. Pick the **first unchecked** backlog item.
2. Implement it in `engine/` (library code + tests).
3. Run `cd engine && ./run-tests.sh` — **all unit tests must pass** and the
   report must regenerate with 0 failed checks.
4. Check the item off in the backlog below (change `[ ]` to `[x]`).
5. Commit and **push** (`git push origin main`) — one commit per item. No
   Claude/Opus attribution lines (user instruction).
6. If every item is checked and `./run-tests.sh` is green, emit the completion
   promise. Otherwise end the turn so the loop continues.

## Definition of done

- Every backlog item below is `[x]`.
- `cd engine && ./run-tests.sh` passes (cargo tests + report, 0 failed checks).
- The engine reference-implements each spec section listed below.

## Backlog

- [x] Reference engine scaffold: money, access, lifecycle, service, risk, investigation, samples, report, run-tests.sh
- [ ] **Merchant & signal normalisation**: map raw anomaly z-scores to bounded `[0,1]` signals (history, velocity, geography) and add a deterministic merchant signal; tests for boundaries and monotonicity.
- [ ] **Velocity z-score (`z_V`)**: implement `z_V = (V - mu) / sigma` with `sigma > 0` guard and unavailable-on-insufficient-history; tests.
- [ ] **Full transition table + role gating**: complete `T(S,E)` for all specified states/events and add `actor_may_perform(actor, event, dispute)`; tests for allowed/denied actors and every edge.
- [ ] **Audit & event log**: append dispute events + audit events atomically on creation and transition; expose an ordered event history; tests that the log matches the state changes.
- [ ] **Evidence upload workflow** (`receive_evidence`): size/type/extension/detected-content checks, random server-side name, scan-required guard (scanner-unavailable != clean), metadata persisted with audit; tests for each rejection path and the happy path.
- [ ] **Safe background retries** (`handle_job`): durable idempotency record, retryable vs non-retryable classification, replay returns stored result once; tests for duplicate delivery and non-retryable failure.
- [ ] **Risk calculation integration**: `calculate_risk(dispute)` assembling all signals through the normalisation layer, returning either a score or an explicit unavailable-with-reason; tests.
- [ ] **Report coverage**: extend the LaTeX report with sections/checks for every new module; confirm `run-tests.sh` regenerates the PDF with 0 failed checks.

## State

- Loop owner: autonomous session
- Source of truth for scope: `planning/Software Spec/equations.tex`
- Completion promise: `DISPUTEGUARD ENGINE COMPLETE`
