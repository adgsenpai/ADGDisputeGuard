//! Unit tests for safe background retries.

use disputeguard_engine::jobs::*;
use std::cell::Cell;

fn job() -> Job {
    Job { retryable: true, idempotency_id: "job-1".into() }
}

const POLICY: RetryPolicy = RetryPolicy { max_attempts: 3 };

#[test]
fn non_retryable_job_is_refused() {
    let mut runner = JobRunner::new();
    let j = Job { retryable: false, ..job() };
    assert_eq!(
        runner.handle_job(&j, &POLICY, 1, || Ok("x".into())),
        Err(JobError::NotRetryable)
    );
}

#[test]
fn job_without_idempotency_id_is_refused() {
    let mut runner = JobRunner::new();
    let j = Job { idempotency_id: String::new(), ..job() };
    assert_eq!(
        runner.handle_job(&j, &POLICY, 1, || Ok("x".into())),
        Err(JobError::MissingIdempotencyId)
    );
}

#[test]
fn duplicate_delivery_runs_effect_exactly_once() {
    let mut runner = JobRunner::new();
    let runs = Cell::new(0u32);
    let op = || {
        runs.set(runs.get() + 1);
        Ok::<_, OpError>("refund-ok".to_string())
    };
    // First delivery runs and stores.
    let first = runner.handle_job(&job(), &POLICY, 1, op).unwrap();
    assert_eq!(first, JobOutcome::Completed("refund-ok".into()));
    // Second delivery replays the stored result without re-running.
    let second = runner
        .handle_job(&job(), &POLICY, 2, || {
            runs.set(runs.get() + 1);
            Ok::<_, OpError>("refund-ok".to_string())
        })
        .unwrap();
    assert_eq!(second, JobOutcome::Replayed("refund-ok".into()));
    assert_eq!(runs.get(), 1, "the external effect must run exactly once");
}

#[test]
fn retryable_failure_schedules_within_budget_then_stops() {
    let mut runner = JobRunner::new();
    // Attempt below the budget schedules another attempt.
    let r = runner.handle_job(&job(), &POLICY, 1, || Err(OpError::Retryable)).unwrap();
    assert_eq!(r, JobOutcome::RetryScheduled { attempt: 2 });
    // At the budget it is recorded for review instead of looping forever.
    let r = runner.handle_job(&job(), &POLICY, 3, || Err(OpError::Retryable)).unwrap();
    assert_eq!(r, JobOutcome::FailedForReview);
    // No durable result was stored for a failed operation.
    assert!(runner.durable_result("job-1").is_none());
}

#[test]
fn non_retryable_failure_is_not_retried() {
    let mut runner = JobRunner::new();
    let r = runner.handle_job(&job(), &POLICY, 1, || Err(OpError::NonRetryable)).unwrap();
    assert_eq!(r, JobOutcome::FailedForReview);
}
