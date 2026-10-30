//! Evidence upload workflow (equations.tex, "Evidence Upload Workflow").
//!
//! A file is untrusted until the server has checked who uploaded it, its
//! size, its declared *and* detected content type, and whether scanning is
//! required and available. A filename or browser MIME-type claim is not proof
//! of content. Scanner unavailability is never reported as a clean scan.

/// Configured policy inputs (all are configuration, not baked-in constants).
#[derive(Debug, Clone)]
pub struct EvidencePolicy {
    pub max_size_bytes: u64,
    pub allowed_types: Vec<String>,
    pub allowed_extensions: Vec<String>,
    pub scanning_required: bool,
}

impl EvidencePolicy {
    /// A reasonable demonstration policy: small PDFs and images, scanning on.
    pub fn demo() -> Self {
        EvidencePolicy {
            max_size_bytes: 5 * 1024 * 1024,
            allowed_types: vec!["application/pdf".into(), "image/png".into(), "image/jpeg".into()],
            allowed_extensions: vec!["pdf".into(), "png".into(), "jpg".into(), "jpeg".into()],
            scanning_required: true,
        }
    }
}

/// An uploaded file as presented by the client, plus the server's own
/// content sniff (`detected_type`), which is trusted over the client claim.
#[derive(Debug, Clone)]
pub struct Upload {
    pub name: String,
    pub declared_type: String,
    pub detected_type: String,
    pub size_bytes: u64,
}

/// The result of a malware scan. Unavailable is distinct from clean.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ScanResult {
    Clean,
    Infected,
    Unavailable,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum EvidenceError {
    NotAuthorised,
    TooLarge { size: u64, limit: u64 },
    DeclaredTypeNotAllowed,
    ExtensionNotAllowed,
    DetectedTypeNotAllowed,
    ScannerUnavailable,
    ScanNotClean,
}

/// A receipt recorded once evidence is accepted and persisted.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct EvidenceReceipt {
    pub dispute_id: u64,
    /// A random, server-generated storage name (never the client filename).
    pub storage_name: String,
    pub size_bytes: u64,
    pub detected_type: String,
}

fn extension_of(name: &str) -> Option<String> {
    name.rsplit_once('.').map(|(_, ext)| ext.to_ascii_lowercase())
}

/// Validate and record an evidence upload. `may_submit` is the access-layer
/// decision (authenticated + case access); `scan` is the injected scanner
/// outcome; `storage_name` is the pre-generated random server-side name.
///
/// Checks run in the spec's order and the first failure short-circuits, so no
/// metadata is recorded for a rejected upload.
pub fn receive_evidence(
    may_submit: bool,
    dispute_id: u64,
    upload: &Upload,
    policy: &EvidencePolicy,
    storage_name: &str,
    scan: impl FnOnce() -> ScanResult,
) -> Result<EvidenceReceipt, EvidenceError> {
    if !may_submit {
        return Err(EvidenceError::NotAuthorised);
    }
    if upload.size_bytes > policy.max_size_bytes {
        return Err(EvidenceError::TooLarge {
            size: upload.size_bytes,
            limit: policy.max_size_bytes,
        });
    }
    if !policy.allowed_types.iter().any(|t| t == &upload.declared_type) {
        return Err(EvidenceError::DeclaredTypeNotAllowed);
    }
    match extension_of(&upload.name) {
        Some(ext) if policy.allowed_extensions.contains(&ext) => {}
        _ => return Err(EvidenceError::ExtensionNotAllowed),
    }
    // The server-detected content type must also be allowed; a filename or
    // declared MIME type is not proof of content.
    if !policy.allowed_types.iter().any(|t| t == &upload.detected_type) {
        return Err(EvidenceError::DetectedTypeNotAllowed);
    }

    if policy.scanning_required {
        match scan() {
            ScanResult::Clean => {}
            ScanResult::Infected => return Err(EvidenceError::ScanNotClean),
            // Unavailable must never be treated as clean.
            ScanResult::Unavailable => return Err(EvidenceError::ScannerUnavailable),
        }
    }

    Ok(EvidenceReceipt {
        dispute_id,
        storage_name: storage_name.to_string(),
        size_bytes: upload.size_bytes,
        detected_type: upload.detected_type.clone(),
    })
}
