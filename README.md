# ADGDisputeGuard

<p align="center">
  <img src="graphics/disputeguard-logo.svg" alt="ADGSTUDIOS DisputeGuard logo" width="220">
</p>

![Project status](https://img.shields.io/badge/status-frontend%20implementation-blue)
![Development approach](https://img.shields.io/badge/approach-waterfall-6f42c1)
![Documentation](https://img.shields.io/badge/docs-LaTeX%20%7C%20PDF-orange)
![Build](https://img.shields.io/badge/PDF%20build-Docker-2496ED?logo=docker&logoColor=white)

> **Secure. Explainable. Auditable. Scalable.**

<p align="center">
  <img src="graphics/applogo.png" alt="DisputeGuard application icon" width="112">
</p>

ADGDisputeGuard is a card-dispute management platform in its
**frontend implementation phase**. We are currently following a **waterfall
approach**, using the documented requirements and design as the foundation for
implementation and verification. The landing page is implemented; the
backend and authenticated workspaces remain planned.

## Brand graphics

| Asset                                                     | Preview                        | Intended use                                 |
| --------------------------------------------------------- | ------------------------------ | -------------------------------------------- |
| [DisputeGuard logo (SVG)](graphics/disputeguard-logo.svg) | Vector shield logo shown above | README, documentation, and scalable displays |
| [Application icon (PNG)](graphics/applogo.png)            | App icon shown above           | Application and square icon placements       |

## Project dashboard

| Area                 | Current status                                                   |
| -------------------- | ---------------------------------------------------------------- |
| Project phase        | Frontend implementation                                          |
| Development approach | Waterfall                                                        |
| Current focus        | Interactive project landing page                                 |
| Next phases          | Backend, authenticated workspaces, integration, and verification |
| PDF documentation    | Buildable locally with Docker                                    |

## Documentation

| Document                            | What it covers                                                 | Source                                                    | PDF                                                                   |
| ----------------------------------- | -------------------------------------------------------------- | --------------------------------------------------------- | --------------------------------------------------------------------- |
| Engineering specification           | Architecture, domain model, security, operations, and testing  | [`spec.tex`](planning/Software%20Spec/spec.tex)           | [`spec.pdf`](planning/Software%20Spec/pdf-outputs/spec.pdf)           |
| Equations and algorithms            | Plain-language explanations and implementation pseudocode      | [`equations.tex`](planning/Software%20Spec/equations.tex) | [`equations.pdf`](planning/Software%20Spec/pdf-outputs/equations.pdf) |
| Software Requirements Specification | Testable requirements, acceptance criteria, and open decisions | [`srs.tex`](planning/Software%20Spec/srs.tex)             | [`srs.pdf`](planning/Software%20Spec/pdf-outputs/srs.pdf)             |

## Run the landing page

Requires Node.js 22.13 or newer and npm. From the repository root:

```sh
npm ci
npm run dev
```

Open [localhost:3000](http://localhost:3000). For a production preview:

```sh
npm run build
npm run start
```

Use `PORT=3100 npm run start` to choose another port. `npm run typecheck`
checks the frontend's TypeScript types. Run `npm test` for the investigation
loop termination and sample transaction integrity checks.

The Next.js application lives in `apps/web`. It includes a Three.js shield,
a responsive landing page, swipeable sample payment cards, selectable
transactions connected to an interactive dispute journey, an explorable
architecture diagram, a RALPH concept visualisation, and the three project PDFs. Fonts are
served locally. Reduced-motion preferences are respected, and an SVG
fallback is shown when WebGL is unavailable.

The walkthrough is an illustrative frontend demonstration with mock data;
it does not submit disputes, authenticate users, or move money. The three
90+ figures are Lighthouse **targets**, not reported benchmark results.
The architecture diagram describes the planned system.

The card carousel supports pointer swipes, previous/next controls, direct
card selection, and left/right keyboard arrows. Each card has its own mock
transactions. Completed payments can populate the dispute walkthrough;
pending payments explain the demo restriction without submitting anything.

The RALPH planning files are currently empty. The landing-page concept is
therefore based on the bounded investigation algorithm in the engineering
specification and equations document, rather than a finalised RALPH design.
Its three scenarios demonstrate successful human handoff, iteration-budget
exhaustion, and rejection of a disallowed tool. The simulation performs no
model calls, financial actions, or backend writes. Its two/three-iteration
limits are illustrative; production limits remain configuration decisions.

Document copies served by the website live in `apps/web/public/documents`.
Refresh those copies when the source PDFs in `planning/Software Spec/pdf-outputs`
change. The website's logo is copied from `graphics/disputeguard-logo.svg`.

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
