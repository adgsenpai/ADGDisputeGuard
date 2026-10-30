//! Safe background retries (equations.tex, "Safe Background Retries").
//!
//! A worker may receive the same job more than once after a timeout or crash.
//! Before retrying, the application must know the operation is explicitly
//! retryable and carries a stable idempotency identifier, and a durable
//! result must make a repeated delivery return the original result exactly
//! once rather than duplicate an external effect.

use std::collections::HashMap;

/// A unit of background work.
#[derive(Debug, Clone)]
pub struct Job {
    /// Whether repeating this operation is known to be safe.
    pub retryable: bool,
    /// A stable identifier used to deduplicate deliveries.
    pub idempotency_id: String,
}

/// Configured retry policy.
#[derive(Debug, Clone, Copy)]
pub struct RetryPolicy {
    pub max_attempts: u32,
}

/// Classification of an operation failure.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum OpError {
    /// A transient failure that may be retried (e.g. a timeout).
    Retryable,
    /// A permanent failure that must not be retried automatically.
    NonRetryable,
}

/// The result of handling one delivery of a job.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum JobOutcome {
    /// A durable result already existed; returned it without re-running.
    Replayed(String),
    /// Ran the operation once and stored its durable result.
    Completed(String),
    /// A retryable failure within the retry budget; schedule another attempt.
    RetryScheduled { attempt: u32 },
    /// Failure recorded for operator review (budget exhausted or permanent).
    FailedForReview,
}

/// Reasons a job is refused before any work is attempted.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum JobError {
    /// The operation is not explicitly marked retryable.
    NotRetryable,
    /// The job has no stable idempotency identifier.
    MissingIdempotencyId,
}

#[derive(Default)]
pub struct JobRunner {
    /// Durable idempotency store: id -> stored result.
    durable: HashMap<String, String>,
}

impl JobRunner {
    pub fn new() -> Self {
        JobRunner::default()
    }

    /// Whether a durable result already exists for an id.
    pub fn durable_result(&self, id: &str) -> Option<&String> {
        self.durable.get(id)
    }

    /// Handle one delivery of `job`. `attempt` is 1-based. The operation is
    /// only run when there is no durable result yet; its result is stored so
    /// a later redelivery replays instead of repeating the effect.
    pub fn handle_job(
        &mut self,
        job: &Job,
        policy: &RetryPolicy,
        attempt: u32,
        op: impl FnOnce() -> Result<String, OpError>,
    ) -> Result<JobOutcome, JobError> {
        if !job.retryable {
            return Err(JobError::NotRetryable);
        }
        if job.idempotency_id.is_empty() {
            return Err(JobError::MissingIdempotencyId);
        }

        // Exactly-once effect: a stored result short-circuits re-execution.
        if let Some(result) = self.durable.get(&job.idempotency_id) {
            return Ok(JobOutcome::Replayed(result.clone()));
        }

        match op() {
            Ok(result) => {
                self.durable.insert(job.idempotency_id.clone(), result.clone());
                Ok(JobOutcome::Completed(result))
            }
            Err(OpError::Retryable) => {
                if attempt < policy.max_attempts {
                    Ok(JobOutcome::RetryScheduled { attempt: attempt + 1 })
                } else {
                    Ok(JobOutcome::FailedForReview)
                }
            }
            // Permanent failures are never retried automatically.
            Err(OpError::NonRetryable) => Ok(JobOutcome::FailedForReview),
        }
    }
}
