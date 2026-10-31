# Ralph Loop — Audit Trail

Append-only log of what each Ralph iteration completed. One row per backlog
item: the item, the verification (tests + report checks), and the pushed
commit. Newest at the bottom.

## Phase 1 — Rust reference engine

| # | Item | Verification | Commit |
|---|------|--------------|--------|
| 0 | Reference engine scaffold | 27 tests, 34/34 report checks | `19e806a` |
| 1 | Risk signal normalisation + merchant signal | +4 math tests | `d2e16df` |
| 2 | Transaction velocity z-score + velocity signal | +1 math test | `b2370b9` |
| 3 | Role gating for lifecycle transitions | +1 flow test | `5555470` |
| 4 | Durable audit/event log in the dispute store | +1 flow test | `e8ded00` |
| 5 | Evidence upload workflow | +9 evidence tests | `3d32dfa` |
| 6 | Safe background-retry handler | +5 jobs tests | `ec1777c` |
| 7 | End-to-end risk calculation from raw inputs | +2 math tests | `fe9a5d3` |
| 8 | Report coverage for all modules | 50/50 report checks | `d7ac5a4` |

**Phase 1 result:** engine green — 50 Rust unit tests, LaTeX report 50/50 checks.

## Phase 2 — Next.js application + Ollama + infrastructure

| # | Item | Verification | Commit |
|---|------|--------------|--------|
| 9 | App domain core (TS port) | +8 node:test (13 total) | `850acc6` |
| 10 | Dispute API routes | +6 API tests (19 total), tsc clean | `dbd8eac` |
| 11 | Ollama-backed bounded investigation | +6 tests, model mocked (25 total) | `48b124d` |
| 12 | App UI (console) | next build passes, tsc clean | `89a118d` |
| 13 | Infrastructure (docker-compose + Ollama) | next build + npm test green, YAML valid | `2a37930` |
| 14 | Phase 2 report/docs | both suites green (50 Rust + 50/50 report, 25 TS) | `4741462` |

**Phase 2 result:** app green — 25 TS tests, `next build` passes, docker-compose stack with Ollama.

## Phase 3 — Regression + GUI testing + showcase video

| # | Item | Verification | Commit |
|---|------|--------------|--------|
| 15 | Regression harness + Playwright config + landing smoke | `run-regression.sh` green: 50 Rust + 50/50 report, 25 TS, 1 e2e | `d632467` |

## Completion

All backlog items (Phase 1 + Phase 2) are done and both test suites are green.
Promise emitted: `DISPUTEGUARD ENGINE COMPLETE`.

Phase 3 in progress; completion promise `DISPUTEGUARD QA COMPLETE`.
