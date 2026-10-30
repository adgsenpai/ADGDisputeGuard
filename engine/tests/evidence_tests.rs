//! Unit tests for the evidence upload workflow.

use disputeguard_engine::evidence::*;

fn pdf_upload() -> Upload {
    Upload {
        name: "statement.pdf".into(),
        declared_type: "application/pdf".into(),
        detected_type: "application/pdf".into(),
        size_bytes: 1024,
    }
}

fn accept(upload: &Upload, scan: ScanResult) -> Result<EvidenceReceipt, EvidenceError> {
    receive_evidence(true, 1, upload, &EvidencePolicy::demo(), "srv-abc123", || scan)
}

#[test]
fn clean_authorised_upload_is_accepted() {
    let receipt = accept(&pdf_upload(), ScanResult::Clean).unwrap();
    assert_eq!(receipt.storage_name, "srv-abc123"); // never the client name
    assert_eq!(receipt.detected_type, "application/pdf");
}

#[test]
fn unauthorised_upload_is_refused_first() {
    let err = receive_evidence(false, 1, &pdf_upload(), &EvidencePolicy::demo(), "s", || ScanResult::Clean);
    assert_eq!(err, Err(EvidenceError::NotAuthorised));
}

#[test]
fn oversize_upload_is_refused() {
    let mut u = pdf_upload();
    u.size_bytes = EvidencePolicy::demo().max_size_bytes + 1;
    assert!(matches!(accept(&u, ScanResult::Clean), Err(EvidenceError::TooLarge { .. })));
}

#[test]
fn declared_type_must_be_allowed() {
    let mut u = pdf_upload();
    u.declared_type = "application/zip".into();
    assert_eq!(accept(&u, ScanResult::Clean), Err(EvidenceError::DeclaredTypeNotAllowed));
}

#[test]
fn extension_must_be_allowed() {
    let mut u = pdf_upload();
    u.name = "statement.exe".into();
    assert_eq!(accept(&u, ScanResult::Clean), Err(EvidenceError::ExtensionNotAllowed));
}

#[test]
fn detected_type_overrides_declared_claim() {
    // Client claims PDF with a .pdf name, but the bytes sniff as something else.
    let mut u = pdf_upload();
    u.detected_type = "application/x-dosexec".into();
    assert_eq!(accept(&u, ScanResult::Clean), Err(EvidenceError::DetectedTypeNotAllowed));
}

#[test]
fn infected_file_is_rejected() {
    assert_eq!(accept(&pdf_upload(), ScanResult::Infected), Err(EvidenceError::ScanNotClean));
}

#[test]
fn scanner_unavailable_is_not_clean() {
    assert_eq!(
        accept(&pdf_upload(), ScanResult::Unavailable),
        Err(EvidenceError::ScannerUnavailable)
    );
}

#[test]
fn scanning_can_be_disabled_by_policy() {
    let policy = EvidencePolicy { scanning_required: false, ..EvidencePolicy::demo() };
    // The scanner closure must not even be consulted; proof via a panicking one.
    let receipt = receive_evidence(true, 7, &pdf_upload(), &policy, "srv-xyz", || {
        panic!("scanner must not run when scanning is disabled")
    })
    .unwrap();
    assert_eq!(receipt.dispute_id, 7);
}
