#!/usr/bin/env bash
#
# Automated test + report pipeline for the DisputeGuard engine.
#
#   1. Runs the Rust unit/integration test suite (cargo test).
#   2. Runs the report binary, which re-checks every equation and flow and
#      emits a LaTeX report (report/report.tex).
#   3. Compiles the LaTeX report to a PDF (report/report.pdf) if pdflatex is
#      available.
#
# Exits non-zero if any test or report check fails, so it is CI-friendly.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Make a locally-installed rustup toolchain available if present.
if [ -f "$HOME/.cargo/env" ]; then
  # shellcheck disable=SC1091
  source "$HOME/.cargo/env"
fi

if ! command -v cargo >/dev/null 2>&1; then
  echo "error: cargo not found. Install Rust from https://rustup.rs" >&2
  exit 127
fi

echo "==> [1/3] Running cargo test"
cargo test

echo
echo "==> [2/3] Generating LaTeX report"
cargo run --quiet --bin report -- report/report.tex

echo
echo "==> [3/3] Compiling PDF"
if command -v pdflatex >/dev/null 2>&1; then
  cd report
  # Two passes so the page references/longtable headers settle.
  pdflatex -interaction=nonstopmode -halt-on-error report.tex >/dev/null
  pdflatex -interaction=nonstopmode -halt-on-error report.tex >/dev/null
  # Tidy LaTeX's intermediate files.
  rm -f report.aux report.log report.out report.toc
  cd "$SCRIPT_DIR"
  echo "    Wrote report/report.pdf"
else
  echo "    pdflatex not found; skipping PDF. The LaTeX source is at report/report.tex"
fi

echo
echo "All done."
