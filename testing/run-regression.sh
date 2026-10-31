#!/usr/bin/env bash
#
# DisputeGuard full regression.
#
# Runs every suite the project owns and fails if any of them fail:
#   1. Rust reference engine  - cargo unit tests + regenerate/compile the LaTeX
#                               report (must be 0 failed checks).
#   2. App unit tests         - the TypeScript domain/API/investigation suite.
#   3. GUI / end-to-end tests - Playwright driving the real app in Chrome,
#                               recording video of every flow.
#
# Usage:
#   bash testing/run-regression.sh            # everything
#   SKIP_E2E=1 bash testing/run-regression.sh # unit + engine only (no browser)
#   SKIP_ENGINE=1 bash testing/run-regression.sh
#
# Exit code is non-zero if any selected suite fails.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

bold() { printf '\n\033[1m==> %s\033[0m\n' "$1"; }
pass() { printf '\033[32m[PASS]\033[0m %s\n' "$1"; }
fail() { printf '\033[31m[FAIL]\033[0m %s\n' "$1"; }

FAILURES=()

run_step() {
  local name="$1"; shift
  bold "$name"
  if "$@"; then
    pass "$name"
  else
    fail "$name"
    FAILURES+=("$name")
  fi
}

# 1. Rust engine: unit tests + LaTeX report (0 failed checks enforced by the script).
engine_suite() {
  ( cd "$ROOT/engine" && ./run-tests.sh )
}

# 2. App unit tests (node:test via tsx).
unit_suite() {
  ( cd "$ROOT/apps/web" && npm test )
}

# 3. GUI / e2e: build the app, then run Playwright (its webServer starts it).
e2e_suite() {
  ( cd "$ROOT/apps/web" && npm run build ) || return 1
  node "$ROOT/node_modules/@playwright/test/cli.js" test \
    --config "$ROOT/testing/e2e/playwright.config.ts"
}

if [ "${SKIP_ENGINE:-0}" != "1" ]; then
  run_step "Rust engine tests + LaTeX report" engine_suite
else
  bold "Rust engine tests + LaTeX report"; echo "(skipped: SKIP_ENGINE=1)"
fi

run_step "App unit tests (npm test)" unit_suite

if [ "${SKIP_E2E:-0}" != "1" ]; then
  run_step "GUI / end-to-end tests (Playwright)" e2e_suite
else
  bold "GUI / end-to-end tests (Playwright)"; echo "(skipped: SKIP_E2E=1)"
fi

echo
if [ "${#FAILURES[@]}" -eq 0 ]; then
  bold "REGRESSION PASSED — all selected suites green"
  exit 0
else
  bold "REGRESSION FAILED"
  for f in "${FAILURES[@]}"; do fail "$f"; done
  exit 1
fi
