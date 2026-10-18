//! End-to-end install test: really downloads (or reuses a cached archive), initializes, starts,
//! connects to, stops and uninstalls a PostgreSQL server in a temporary folder.
//!
//! Slow and needs the network, so it is ignored by default:
//!   cargo test -p runtime-postgres --test install_e2e -- --ignored --nocapture
//! Set `POSTCOMPASS_PG_ARCHIVE` to a downloaded archive to skip the download.

use std::sync::{Arc, Mutex};

use pc_core::runtime::{
    CancellationToken, InstallContext, InstallEvent, InstallRequest, LocalRuntime, ServerStatus, StepState,
};
use runtime_postgres::PostgresRuntime;

const VERSION: &str = "18.6.0";

#[tokio::test(flavor = "multi_thread")]
#[ignore = "downloads PostgreSQL and runs a real server"]
async fn installs_starts_stops_and_uninstalls() {
    let root = std::env::temp_dir().join(format!("postcompass-e2e-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&root);

    if let Ok(archive) = std::env::var("POSTCOMPASS_PG_ARCHIVE") {
        let name = std::path::Path::new(&archive).file_name().unwrap().to_owned();
        std::fs::create_dir_all(root.join("downloads")).unwrap();
        std::fs::copy(&archive, root.join("downloads").join(name)).unwrap();
    }

    let runtime = PostgresRuntime;
    // Inside the range detection probes (5432–5442), so the detection check below can see it
    let port = runtime_postgres::first_free_port(5433).filter(|p| *p <= 5442).expect("a free port in 5433–5442");
    let events: Arc<Mutex<Vec<InstallEvent>>> = Arc::default();
    let sink = events.clone();
    let ctx = InstallContext {
        progress: Arc::new(move |event| {
            if let InstallEvent::Step { step, state, detail } = &event {
                println!("{step:?} {state:?} {}", detail.as_deref().unwrap_or(""));
            }
            sink.lock().unwrap().push(event);
        }),
        cancel: CancellationToken::new(),
        root_dir: root.clone(),
    };

    let request = InstallRequest {
        version: VERSION.into(),
        port,
        name: "E2E PostgreSQL".into(),
        password: "e2e-Secret-123".into(),
        data_dir: None,
        auto_start: false,
    };

    let server = runtime.install(request, ctx).await.expect("install succeeds");
    assert_eq!(runtime.status(&server).await, ServerStatus::Running);
    assert!(runtime_postgres::is_postgres("127.0.0.1", port).await, "server answers the handshake");

    // Every step finished (done or skipped), none failed
    let failed = events
        .lock()
        .unwrap()
        .iter()
        .any(|e| matches!(e, InstallEvent::Step { state: StepState::Failed, .. }));
    assert!(!failed, "no install step failed");

    // Detection labels our own install as managed
    let report = runtime.detect(Some(root.clone())).await;
    assert!(report.servers.iter().any(|s| s.port == port), "detection sees the running server");

    runtime.stop(&server).await.expect("stop succeeds");
    assert_eq!(runtime.status(&server).await, ServerStatus::Stopped);

    runtime.start(&server).await.expect("restart succeeds");
    assert_eq!(runtime.status(&server).await, ServerStatus::Running);

    runtime.uninstall(&server, false).await.expect("uninstall succeeds");
    assert!(!std::path::Path::new(&server.data_dir).exists(), "data folder deleted");

    let _ = std::fs::remove_dir_all(&root);
}

#[tokio::test(flavor = "multi_thread")]
#[ignore = "downloads PostgreSQL"]
async fn port_in_use_fails_cleanly() {
    let root = std::env::temp_dir().join(format!("postcompass-e2e-port-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&root);
    let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let port = listener.local_addr().unwrap().port();

    let ctx = InstallContext {
        progress: Arc::new(|_| {}),
        cancel: CancellationToken::new(),
        root_dir: root.clone(),
    };
    let request = InstallRequest {
        version: VERSION.into(),
        port,
        name: "Port test".into(),
        password: "e2e-Secret-123".into(),
        data_dir: None,
        auto_start: false,
    };
    let err = PostgresRuntime.install(request, ctx).await.unwrap_err();
    assert_eq!(err.code(), pc_core::ErrorCode::PortInUse);
    assert!(!root.join("servers").exists(), "nothing left behind");
    let _ = std::fs::remove_dir_all(&root);
}
