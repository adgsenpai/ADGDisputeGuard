#!/bin/sh
set -eu

repo_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$repo_root"

if ! command -v docker >/dev/null 2>&1; then
    printf '%s\n' "Docker is required to build the SRS PDF." >&2
    exit 1
fi

mkdir -p build

docker run --rm \
    --user "$(id -u):$(id -g)" \
    --mount "type=bind,source=$repo_root,target=/work" \
    --workdir /work \
    texlive/texlive:TL2025-historic \
    latexmk -pdf -interaction=nonstopmode -halt-on-error -file-line-error \
        -outdir=build "planning/Software Spec/srs.tex"

printf 'Built %s/build/srs.pdf\n' "$repo_root"
