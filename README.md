# ADGDisputeGuard

## Build the PDFs

With Docker installed and running, build all three PDFs and move them into
the specification folder:

```sh
./scripts/build-and-collect-pdfs.sh
```

The individual build scripts are also available when you only need one
document:

```sh
./scripts/build-spec-pdf.sh
./scripts/build-equations-pdf.sh
./scripts/build-srs-pdf.sh
```

The standalone companion [equations and algorithms guide](planning/Software%20Spec/equations.tex)
explains the system's core calculations in plain language and provides
implementation pseudocode. The [Software Requirements Specification](planning/Software%20Spec/srs.tex)
defines uniquely identified, testable system requirements and acceptance
conditions. The build scripts use the TeX Live 2025 Docker image. Individual
scripts write to `build/`; the combined script moves the completed PDFs to
`planning/Software Spec/pdf-outputs/`.
