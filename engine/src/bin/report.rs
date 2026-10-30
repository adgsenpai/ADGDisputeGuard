//! Test-report generator: runs a battery of checks against the DisputeGuard
//! engine and writes a LaTeX report (tables of pass/fail plus worked numeric
//! examples). Usage:
//!
//!   cargo run --bin report -- [output.tex]
//!
//! Default output is `report/report.tex` under the crate directory.

use std::env;
use std::fs;
use std::path::PathBuf;
use std::process;

use disputeguard_engine::access::*;
use disputeguard_engine::investigation::{self, Scenario, Stage};
use disputeguard_engine::lifecycle::*;
use disputeguard_engine::money::{Money, MoneyError, BHD, JPY, USD, ZAR};
use disputeguard_engine::risk::*;
use disputeguard_engine::samples::*;
use disputeguard_engine::service::*;

/// A single named check with its observed value and pass/fail verdict.
struct Check {
    name: String,
    detail: String,
    passed: bool,
}

/// A titled group of checks that becomes one table in the report.
struct Section {
    title: String,
    blurb: String,
    checks: Vec<Check>,
}

struct Report {
    sections: Vec<Section>,
}

impl Report {
    fn new() -> Self {
        Report { sections: Vec::new() }
    }

    fn section(&mut self, title: &str, blurb: &str) -> &mut Section {
        self.sections.push(Section {
            title: title.to_string(),
            blurb: blurb.to_string(),
            checks: Vec::new(),
        });
        self.sections.last_mut().unwrap()
    }

    fn total(&self) -> usize {
        self.sections.iter().map(|s| s.checks.len()).sum()
    }

    fn passed(&self) -> usize {
        self.sections
            .iter()
            .flat_map(|s| &s.checks)
            .filter(|c| c.passed)
            .count()
    }
}

impl Section {
    fn check(&mut self, name: &str, detail: impl Into<String>, passed: bool) {
        self.checks.push(Check {
            name: name.to_string(),
            detail: detail.into(),
            passed,
        });
    }
}

const EPS: f64 = 1e-9;

fn approx(a: f64, b: f64, tol: f64) -> bool {
    (a - b).abs() < tol
}

/// Escape the characters LaTeX treats specially so detail strings render.
fn tex_escape(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for ch in s.chars() {
        match ch {
            '&' | '%' | '$' | '#' | '_' | '{' | '}' => {
                out.push('\\');
                out.push(ch);
            }
            '~' => out.push_str("\\textasciitilde{}"),
            '^' => out.push_str("\\textasciicircum{}"),
            '\\' => out.push_str("\\textbackslash{}"),
            // `<` and `>` become inverted punctuation in the default font
            // encoding, which mangles arrows like `->`; emit text variants.
            '<' => out.push_str("\\textless{}"),
            '>' => out.push_str("\\textgreater{}"),
            '…' => out.push_str("..."),
            _ => out.push(ch),
        }
    }
    out
}

fn build_report() -> Report {
    let mut report = Report::new();

    // --- Money -------------------------------------------------------------
    {
        let s = report.section(
            "Money and Exact Amounts",
            "Amounts are whole minor units; precision follows the currency and \
             floating-point rounding never appears.",
        );
        let m = Money::parse("1234.56", ZAR).unwrap();
        s.check("R1234.56 parses to cents", format!("minor = {}", m.minor), m.minor == 123456);

        let sum = Money::parse("0.10", ZAR)
            .unwrap()
            .checked_add(&Money::parse("0.20", ZAR).unwrap())
            .unwrap();
        s.check("0.10 + 0.20 is exact", format!("minor = {} (= 0.30)", sum.minor), sum.minor == 30);

        s.check(
            "JPY rejects fractional input",
            "parse(\"1.5\", JPY) = BadPrecision",
            Money::parse("1.5", JPY) == Err(MoneyError::BadPrecision),
        );
        s.check(
            "BHD keeps three decimals",
            format!("minor = {}", Money::parse("1.234", BHD).unwrap().minor),
            Money::parse("1.234", BHD).unwrap().minor == 1234,
        );
        let mismatch = Money::from_minor(10, ZAR).checked_add(&Money::from_minor(10, USD));
        s.check(
            "Cross-currency add is refused",
            "ZAR + USD = CurrencyMismatch",
            matches!(mismatch, Err(MoneyError::CurrencyMismatch { .. })),
        );
    }

    // --- Access ------------------------------------------------------------
    {
        let s = report.section(
            "Ownership and Permission",
            "View depends on ownership or an analyst/admin role; dispute \
             creation always requires ownership.",
        );
        let tx = Transaction { id: 10, owner_id: 1 };
        let owner = User { id: 1, role: Role::Customer };
        let stranger = User { id: 2, role: Role::Customer };
        let analyst = User { id: 9, role: Role::Analyst };
        s.check("Owner can view", "CanView(owner, t) = true", can_view(&owner, &tx));
        s.check("Stranger cannot view", "CanView(stranger, t) = false", !can_view(&stranger, &tx));
        s.check("Analyst can view", "role grants CanView", can_view(&analyst, &tx));
        s.check("Only owner can create", "analyst cannot create a dispute", !can_create_dispute(&analyst, &tx) && can_create_dispute(&owner, &tx));
    }

    // --- Lifecycle ---------------------------------------------------------
    {
        let s = report.section(
            "Dispute Lifecycle and Concurrency",
            "Only authorised transitions proceed; stale versions are rejected \
             and successful changes bump the version.",
        );
        s.check(
            "SUBMITTED + BEGIN_REVIEW -> UNDER_REVIEW",
            "authorised transition",
            transition(State::Submitted, Event::BeginReview) == Some(State::UnderReview),
        );
        s.check(
            "SUBMITTED + ISSUE_REFUND -> bottom",
            "refund is never a lifecycle transition",
            transition(State::Submitted, Event::IssueRefund).is_none(),
        );
        let d = Dispute { id: 1, transaction_id: 10, state: State::Submitted, version: 3 };
        let ok = apply_transition(&d, Event::BeginReview, 3).unwrap();
        s.check("Version bumps on success", format!("v {} -> {}", d.version, ok.version), ok.version == 4);
        s.check(
            "Stale version is rejected",
            "expected 2 != actual 3",
            matches!(apply_transition(&d, Event::BeginReview, 2), Err(TransitionError::VersionConflict { .. })),
        );
    }

    // --- Creation flow -----------------------------------------------------
    {
        let s = report.section(
            "Dispute Creation: Idempotency and Uniqueness",
            "Retries return the original result; at most one active dispute \
             may exist per transaction.",
        );
        let mut store = DisputeStore::new();
        store.add_transaction(Transaction { id: 10, owner_id: 1 });
        let owner = User { id: 1, role: Role::Customer };
        let first = store.create_dispute(&owner, 10, 0xABCD, "key-1").unwrap();
        let retry = store.create_dispute(&owner, 10, 0xABCD, "key-1").unwrap();
        s.check(
            "Retry replays original dispute",
            format!("ids {} == {}, replayed = {}", first.dispute.id, retry.dispute.id, retry.replayed),
            retry.replayed && retry.dispute.id == first.dispute.id,
        );
        s.check(
            "Key reuse with new body refused",
            "KeyReuseWithDifferentRequest",
            store.create_dispute(&owner, 10, 0x9999, "key-1") == Err(CreateError::KeyReuseWithDifferentRequest),
        );
        s.check(
            "Second active dispute refused",
            "ActiveDisputeExists",
            store.create_dispute(&owner, 10, 0x2, "key-b") == Err(CreateError::ActiveDisputeExists),
        );
        s.check("Active count is 1", format!("count = {}", store.active_dispute_count(10)), store.active_dispute_count(10) == 1);
    }

    // --- Risk math ---------------------------------------------------------
    {
        let s = report.section(
            "Deterministic Risk Indicators",
            "Each signal has its own safe guards; a missing input is reported \
             as unavailable rather than treated as low risk.",
        );
        let x_max = 10_000.0;
        let a_big = amount_signal(9_000.0, x_max).unwrap();
        s.check(
            "Amount signal bounded in [0,1]",
            format!("A(9000; x_max=10000) = {a_big:.4}"),
            (0.0..=1.0).contains(&a_big) && a_big > amount_signal(100.0, x_max).unwrap(),
        );
        s.check(
            "Amount signal clamps at scale",
            "A(1e6; x_max=10000) = 1.0000",
            approx(amount_signal(1_000_000.0, x_max).unwrap(), 1.0, EPS),
        );

        let z = z_score(HISTORY_STEADY, 900.0).unwrap();
        s.check("z-score flags R900 outlier", format!("z = {z:.3} (> 3)"), z > 3.0);
        s.check(
            "z-score unavailable at zero variance",
            "constant history -> None",
            z_score(HISTORY_CONSTANT, 900.0).is_none(),
        );

        let zr = robust_z_score(HISTORY_STEADY, 900.0).unwrap();
        s.check("Robust z (MAD) flags outlier", format!("z* = {zr:.3}"), zr > 3.0);
        s.check(
            "MAD = 0 is undefined (no div-by-zero)",
            "constant history -> None",
            robust_z_score(HISTORY_CONSTANT, 900.0).is_none(),
        );

        s.check("Velocity needs positive window", "V(12, 0) = None", velocity(12, 0.0).is_none());

        let dist = haversine_km(JOHANNESBURG.0, JOHANNESBURG.1, CAPE_TOWN.0, CAPE_TOWN.1).unwrap();
        s.check(
            "Haversine JHB->CPT ~ 1262 km",
            format!("d = {dist:.1} km"),
            approx(dist, 1262.0, 25.0),
        );
        let vreq = required_velocity(Some(dist), 1.0).unwrap();
        s.check(
            "Impossible travel velocity detected",
            format!("v_required = {vreq:.0} km/h over 1 h"),
            vreq > 1000.0,
        );

        let signals = Signals {
            amount: Some(0.5),
            velocity: Some(0.4),
            merchant: Some(0.1),
            history: Some(0.9),
            geography: Some(0.3),
        };
        let weights = Weights { amount: 0.2, velocity: 0.2, merchant: 0.2, history: 0.2, geography: 0.2 };
        let score = combined_score(&signals, &weights).unwrap();
        s.check("Combined score in [0,1]", format!("R = {score:.3}"), approx(score, 0.44, EPS));
        s.check(
            "Missing signal refuses a score",
            "geography = None -> MissingSignal",
            combined_score(&Signals { geography: None, ..signals }, &weights) == Err(RiskError::MissingSignal("geography")),
        );
        let bad = Weights { amount: 0.5, velocity: 0.2, merchant: 0.2, history: 0.2, geography: 0.2 };
        s.check(
            "Weights must sum to 1",
            "sum = 1.3 -> InvalidWeights",
            combined_score(&signals, &bad) == Err(RiskError::InvalidWeights),
        );
    }

    // --- Investigation -----------------------------------------------------
    {
        let s = report.section(
            "Bounded AI Investigation",
            "The loop gathers only allowlisted, read-only observations and \
             stops on budget or a disallowed tool, leaving the case unchanged.",
        );
        let complete = investigation::run(Scenario::Complete);
        s.check(
            "Complete run reaches human review",
            format!("stage = Review, tool_calls = {}", complete.tool_calls),
            complete.stage == Stage::Review && complete.tool_calls == 3,
        );
        let budget = investigation::run(Scenario::Budget);
        s.check(
            "Budget stops before 3rd tool call",
            format!("stage = Stopped, tool_calls = {}", budget.tool_calls),
            budget.stage == Stage::Stopped && budget.tool_calls == 2,
        );
        let blocked = investigation::run(Scenario::Blocked);
        s.check(
            "Disallowed tool blocked pre-execution",
            format!("tool_calls = {}, observations = {}", blocked.tool_calls, blocked.observations),
            blocked.stage == Stage::Stopped && blocked.tool_calls == 1,
        );
    }

    // --- Sample data -------------------------------------------------------
    {
        let s = report.section(
            "Sample Transaction Data",
            "The demo transactions shared with the web landing page use unique \
             references and exact positive minor units.",
        );
        let ids: std::collections::HashSet<_> = DEMO_TRANSACTIONS.iter().map(|t| t.id).collect();
        s.check(
            "References are unique",
            format!("{} transactions, {} unique ids", DEMO_TRANSACTIONS.len(), ids.len()),
            ids.len() == DEMO_TRANSACTIONS.len(),
        );
        s.check(
            "All amounts positive minor units",
            "every amount_minor > 0",
            DEMO_TRANSACTIONS.iter().all(|t| t.amount_minor > 0),
        );
    }

    report
}

fn render_latex(report: &Report) -> String {
    let total = report.total();
    let passed = report.passed();
    let failed = total - passed;
    let now = "October 2026";

    let mut tex = String::new();
    tex.push_str(r#"\documentclass[11pt,a4paper]{article}
\usepackage[margin=2.2cm]{geometry}
\usepackage{booktabs}
\usepackage{longtable}
\usepackage{array}
\usepackage{xcolor}
\usepackage{colortbl}
\usepackage{fancyhdr}
\usepackage{hyperref}
\usepackage{microtype}

\definecolor{ADGBlue}{RGB}{19,67,115}
\definecolor{ADGDark}{RGB}{22,29,38}
\definecolor{PassGreen}{RGB}{20,110,60}
\definecolor{FailRed}{RGB}{170,30,30}
\definecolor{RowTint}{RGB}{245,247,249}

\hypersetup{colorlinks=true,linkcolor=ADGBlue,urlcolor=ADGBlue,
  pdftitle={DisputeGuard Engine Test Report},pdfauthor={ADGSTUDIOS}}

\pagestyle{fancy}
\fancyhf{}
\lhead{\textbf{ADGSTUDIOS}}
\rhead{DisputeGuard Engine Test Report}
\cfoot{\thepage}
\setlength{\headheight}{14pt}

\newcommand{\pass}{\textcolor{PassGreen}{\textbf{PASS}}}
\newcommand{\fail}{\textcolor{FailRed}{\textbf{FAIL}}}

\begin{document}

\begin{titlepage}
  \centering
  \vspace*{2cm}
  {\Huge\bfseries ADGSTUDIOS\par}
  \vspace{0.4cm}
  {\LARGE\color{ADGBlue}\bfseries DisputeGuard\par}
  \vspace{1.3cm}
  \rule{0.85\textwidth}{0.8pt}
  \vspace{0.8cm}
  {\Large\bfseries Engine Test Report\par}
  \vspace{0.4cm}
  {\large Automated verification of the equations and flows\par}
  \vfill
"#);

    let status_macro = if failed == 0 { "\\pass" } else { "\\fail" };
    tex.push_str(&format!(
        "  {{\\Large {status_macro}\\quad {passed} / {total} checks passed\\par}}\n"
    ));
    tex.push_str(&format!("  \\vspace{{0.6cm}}\n  {{\\large Generated {now} \\quad|\\quad Rust reference engine\\par}}\n"));
    tex.push_str(r#"  \vfill
  \textit{Companion to the DisputeGuard Equations and Algorithms guide.}
\end{titlepage}

\section*{Summary}
"#);
    tex.push_str(&format!(
        "\\begin{{center}}\n\\begin{{tabular}}{{@{{}}lr@{{}}}}\n\\toprule\nMetric & Value \\\\\n\\midrule\nTotal checks & {total} \\\\\nPassed & \\textcolor{{PassGreen}}{{{passed}}} \\\\\nFailed & \\textcolor{{FailRed}}{{{failed}}} \\\\\nSections & {} \\\\\n\\bottomrule\n\\end{{tabular}}\n\\end{{center}}\n\n",
        report.sections.len()
    ));
    tex.push_str("\\noindent This report is produced by the \\texttt{report} binary in the \\texttt{disputeguard-engine} crate. Each row runs a deterministic check against the reference implementation and records the observed value.\\par\n\\vspace{0.5em}\n");

    for section in &report.sections {
        let s_total = section.checks.len();
        let s_pass = section.checks.iter().filter(|c| c.passed).count();
        tex.push_str(&format!(
            "\n\\section*{{{} \\hfill \\normalsize\\textcolor{{ADGBlue}}{{{s_pass}/{s_total}}}}}\n",
            tex_escape(&section.title)
        ));
        tex.push_str(&format!("\\noindent {}\\par\\vspace{{0.4em}}\n", tex_escape(&section.blurb)));
        tex.push_str("\\renewcommand{\\arraystretch}{1.25}\n");
        tex.push_str("\\begin{longtable}{@{}p{0.40\\textwidth}p{0.45\\textwidth}r@{}}\n\\toprule\n\\textbf{Check} & \\textbf{Observed} & \\textbf{Result} \\\\\n\\midrule\n\\endhead\n");
        for check in &section.checks {
            let verdict = if check.passed { "\\pass" } else { "\\fail" };
            tex.push_str(&format!(
                "{} & \\texttt{{\\small {}}} & {} \\\\\n",
                tex_escape(&check.name),
                tex_escape(&check.detail),
                verdict
            ));
        }
        tex.push_str("\\bottomrule\n\\end{longtable}\n");
    }

    // Sample transactions appendix.
    tex.push_str("\n\\section*{Appendix: Sample Transactions}\n");
    tex.push_str("\\noindent The nine demo transactions used as fixtures (amounts shown as exact ZAR from integer cents).\\par\\vspace{0.4em}\n");
    tex.push_str("\\renewcommand{\\arraystretch}{1.2}\n");
    tex.push_str("\\begin{longtable}{@{}lllr@{}}\n\\toprule\n\\textbf{Ref} & \\textbf{Merchant} & \\textbf{Category} & \\textbf{Amount (ZAR)} \\\\\n\\midrule\n\\endhead\n");
    for t in DEMO_TRANSACTIONS {
        tex.push_str(&format!(
            "{} & {} & {} & {} \\\\\n",
            tex_escape(t.id),
            tex_escape(t.merchant),
            tex_escape(t.category),
            t.money().to_decimal_string()
        ));
    }
    tex.push_str("\\bottomrule\n\\end{longtable}\n");

    tex.push_str("\n\\vfill\n\\noindent\\textit{All figures are illustrative. Risk indicators are advisory and never decide a dispute.}\n");
    tex.push_str("\n\\end{document}\n");
    tex
}

fn main() {
    let args: Vec<String> = env::args().collect();
    let out_path = PathBuf::from(args.get(1).cloned().unwrap_or_else(|| {
        let manifest = env!("CARGO_MANIFEST_DIR");
        format!("{manifest}/report/report.tex")
    }));

    let report = build_report();
    let tex = render_latex(&report);

    if let Some(parent) = out_path.parent() {
        if let Err(e) = fs::create_dir_all(parent) {
            eprintln!("failed to create {}: {e}", parent.display());
            process::exit(2);
        }
    }
    if let Err(e) = fs::write(&out_path, tex) {
        eprintln!("failed to write {}: {e}", out_path.display());
        process::exit(2);
    }

    let total = report.total();
    let passed = report.passed();
    let failed = total - passed;
    println!(
        "Wrote {} ({passed}/{total} checks passed, {failed} failed).",
        out_path.display()
    );
    // Non-zero exit if any check failed, so CI/automation notices.
    if failed > 0 {
        process::exit(1);
    }
}
