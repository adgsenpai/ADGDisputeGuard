#!/bin/sh
set -eu

repo_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$repo_root"

./scripts/build-spec-pdf.sh
./scripts/build-equations-pdf.sh
./scripts/build-srs-pdf.sh

output_dir="planning/Software Spec/pdf-outputs"
mkdir -p "$output_dir"

mv -f \
    build/spec.pdf \
    build/equations.pdf \
    build/srs.pdf \
    "$output_dir/"

printf 'Moved PDFs to %s/%s\n' "$repo_root" "$output_dir"
