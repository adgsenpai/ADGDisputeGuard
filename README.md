# ADGDisputeGuard

<p align="center">
  <img src="graphics/disputeguard-logo.svg" alt="ADGSTUDIOS DisputeGuard logo" width="220">
</p>

![Project status](https://img.shields.io/badge/status-framework%20building-blue)
![Development approach](https://img.shields.io/badge/approach-waterfall-6f42c1)
![Documentation](https://img.shields.io/badge/docs-LaTeX%20%7C%20PDF-orange)
![Build](https://img.shields.io/badge/PDF%20build-Docker-2496ED?logo=docker&logoColor=white)

> **Secure. Explainable. Auditable. Scalable.**

<p align="center">
  <img src="graphics/applogo.png" alt="DisputeGuard application icon" width="112">
</p>

ADGDisputeGuard is a card-dispute management platform in its
**framework-building phase**. We are currently following a **waterfall
approach**, defining and documenting requirements and design before moving
through implementation and verification.

## Brand graphics

| Asset | Preview | Intended use |
|---|---|---|
| [DisputeGuard logo (SVG)](graphics/disputeguard-logo.svg) | Vector shield logo shown above | README, documentation, and scalable displays |
| [Application icon (PNG)](graphics/applogo.png) | App icon shown above | Application and square icon placements |

## Project dashboard

| Area | Current status |
|---|---|
| Project phase | Framework building |
| Development approach | Waterfall |
| Current focus | Requirements, architecture, and workflow definition |
| Next phases | Implementation, integration, and verification |
| PDF documentation | Buildable locally with Docker |

## Documentation

| Document | What it covers | Source | PDF |
|---|---|---|---|
| Engineering specification | Architecture, domain model, security, operations, and testing | [`spec.tex`](planning/Software%20Spec/spec.tex) | [`spec.pdf`](planning/Software%20Spec/pdf-outputs/spec.pdf) |
| Equations and algorithms | Plain-language explanations and implementation pseudocode | [`equations.tex`](planning/Software%20Spec/equations.tex) | [`equations.pdf`](planning/Software%20Spec/pdf-outputs/equations.pdf) |
| Software Requirements Specification | Testable requirements, acceptance criteria, and open decisions | [`srs.tex`](planning/Software%20Spec/srs.tex) | [`srs.pdf`](planning/Software%20Spec/pdf-outputs/srs.pdf) |

## Build the documentation

With Docker installed and running, build the three PDFs and collect them in
`planning/Software Spec/pdf-outputs/`:

```sh
./scripts/build-and-collect-pdfs.sh
```

To build a single document without collecting the other PDFs:

```sh
./scripts/build-spec-pdf.sh
./scripts/build-equations-pdf.sh
./scripts/build-srs-pdf.sh
```

Individual scripts write build files to `build/`. The combined script builds
all three documents and moves the resulting PDFs to the output folder.
