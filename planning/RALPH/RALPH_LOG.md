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
| 16 | Landing page GUI test | `run-regression.sh` green; landing spec walks all sections, docs link, no page errors | `bac1e22` |
| 17 | Console core GUI test | `run-regression.sh` green; lists txns, opens dispute, idempotent replay, audit shows created | `073b7aa` |
| 18 | Console lifecycle + evidence + audit GUI test | `run-regression.sh` green; role gating, evidence upload, full analyst path to approved, stale-version 409 | `26ed371` |
| 19 | Console investigation GUI test | `run-regression.sh` green; runs bounded investigation, asserts tool-call budget <= 3 and advisory disclaimer | `dfeb181` |
| 20 | Showcase video + per-flow GIFs | `run-regression.sh` green; `record-showcase.mjs` produced showcase.mp4 (26s, 1.2 MB) + showcase.gif (3 MB) + 3 per-flow GIFs | `5c2b64b` |
| 21 | README showcase + testing docs | `run-regression.sh` green; showcase GIF embedded + MP4 linked in README, `testing/README.md` added | `1d44883` |

**Phase 3 result:** QA green — single regression command runs 50 Rust + 50/50
report, 25 TS, and 5 Playwright GUI tests; showcase video recorded and embedded.

## Phase 4 — Modern SaaS console

| # | Item | Verification | Commit |
|---|------|--------------|--------|
| 22 | Design system + SA data + personas | `run-regression.sh` green; personas + generated avatars + theme tokens + SA seed data across 5 customers; unit + e2e updated | `14255b5` |
| 23 | Passwordless login + identity | `run-regression.sh` green; persona login screen + RBAC identity in localStorage, sign-out, console gated; e2e sign-in helper | `640a801` |
| 24 | App shell + navigation | `run-regression.sh` green; sidebar+topbar shell, 7 tabs, dashboard/transactions/disputes workspace/audit/settings, `/api/audit`; e2e navigate tabs | `618a605` |
| 25 | Dashboard | `run-regression.sh` green; KPI tiles + avg advisory risk + 3 accessible charts (state, category, risk) from shared risk helper; dashboard e2e | `7f0864b` |
| 26 | Transactions tab | `run-regression.sh` green; search + category chips + advisory risk badge per row, open dispute from filtered row; transactions e2e | `974ca5c` |
| 27 | Disputes queue + case workspace | `run-regression.sh` green; queue search + state filters, case workspace advisory-risk indicator; disputes-queue e2e | `9cddee5` |
| 28 | Investigations + Evidence + Audit + Settings tabs | `run-regression.sh` green; server evidence + investigation registers (`/api/evidence`, `/api/investigations`), aggregate tabs + settings; unit + aux-tabs e2e | `70e85c5` |
| 29 | Showcase refresh + docs | `run-regression.sh` green (50 Rust + 50/50, 27 TS, 9 GUI); showcase re-recorded against SaaS UI, README + testing docs refreshed | `b1d6017` |

**Phase 4 result:** modern SaaS console shipped — passwordless persona login
with RBAC, generated African-style avatars, dashboard with charts, tabbed shell,
South African data; 27 TS + 9 Playwright GUI tests green, showcase re-recorded.

## Phase 5 — Bank-grade

| # | Item | Verification | Commit |
|---|------|--------------|--------|
| 30 | Chargeback reason codes + SLAs | `run-regression.sh` green (30 TS, 10 GUI); Visa/MC reason-code catalogue, per-dispute code + openedAt, SLA countdown, evidence checklist, provisional credit | `29bf77e` |
| 31 | Tamper-evident audit log | `run-regression.sh` green (34 TS, 10 GUI); SHA-256 hash-chained audit events, `/api/audit/verify`, integrity badge; chain + tamper-detection unit tests | `1035568` |
| 32 | Case report PDF export | `run-regression.sh` green (36 TS, 12 GUI); `/api/disputes/[id]/report` renders audit-ready LaTeX + pdflatex PDF with reason code, audit trail, evidence, chain head; download action; render + API tests | `a5ff2a7` |
| 33 | Multi-language console (EN/isiZulu/Afrikaans) | `run-regression.sh` green (39 TS, 13 GUI); i18n layer + language switcher, translated nav/views/KPIs/login; completeness + e2e tests | `4ae411e` |

## Completion

All backlog items (Phase 1 + Phase 2 + Phase 3 + Phase 4) are done and every suite is green.
Promises emitted: `DISPUTEGUARD ENGINE COMPLETE` (Phase 1+2),
`DISPUTEGUARD QA COMPLETE` (Phase 3), `DISPUTEGUARD SAAS COMPLETE` (Phase 4).
