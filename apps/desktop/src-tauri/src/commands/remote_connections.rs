//! Commands for user-managed remote PostgreSQL connections (AWS RDS, GCP Cloud SQL, Azure, Cloudflare Hyperdrive, etc.).
//!
//! Passwords are stored in the OS keychain under the key `remote:<id>` and are never written to
//! `state.json`. The UI receives `RemoteConnection` without any password field.

use std::sync::Arc;
use std::time::Instant;

use pc_core::driver::{ConnectionConfig, SslMode as DriverSslMode};
use pc_core::{CoreError, DatabaseKind};
use serde::Deserialize;
use tauri::State;

use crate::connections::{Connections, remote_connection_id};
use crate::secrets;
use crate::state::{AppState, RemoteConnection, SslMode, Store};

// ── Helpers ──────────────────────────────────────────────────────────────────

fn new_id() -> String {
    // Simple unique id: timestamp + random bytes
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    let rand: u32 = {
        let mut b = [0u8; 4];
        getrandom::fill(&mut b).unwrap_or(());
        u32::from_le_bytes(b)
    };
    format!("rc-{now}-{rand:08x}")
}

fn to_driver_ssl(mode: SslMode) -> DriverSslMode {
    match mode {
        SslMode::Disable => DriverSslMode::Disable,
        SslMode::Prefer => DriverSslMode::Prefer,
        SslMode::Require => DriverSslMode::Require,
        SslMode::VerifyFull => DriverSslMode::VerifyFull,
    }
}

fn make_config(rc: &RemoteConnection, password: String) -> ConnectionConfig {
    ConnectionConfig {
        host: rc.host.clone(),
        port: rc.port,
        user: rc.user.clone(),
        password,
        database: rc.database.clone(),
        ssl_mode: to_driver_ssl(rc.ssl_mode),
    }
}

// ── Request DTOs ──────────────────────────────────────────────────────────────

/// Fields the user fills in when creating or editing a remote connection.
#[derive(Debug, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct RemoteConnectionRequest {
    pub name: String,
    pub host: String,
    pub port: u16,
    pub user: String,
    pub password: String,
    pub database: String,
    pub ssl_mode: SslMode,
    pub provider: String,
}

// ── Commands ──────────────────────────────────────────────────────────────────

/// Saves a new remote connection. The password goes to the OS keychain; everything else to state.
#[tauri::command]
#[specta::specta]
pub fn add_remote_connection(
    store: State<'_, Store>,
    request: RemoteConnectionRequest,
) -> Result<AppState, CoreError> {
    let id = new_id();
    let rc = RemoteConnection {
        id: id.clone(),
        name: request.name,
        host: request.host,
        port: request.port,
        user: request.user,
        database: request.database,
        ssl_mode: request.ssl_mode,
        provider: request.provider,
        created_at: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as f64,
    };
    secrets::set_remote_password(&id, &request.password)?;
    store.update(|state| state.remote_connections.push(rc))?;
    Ok(store.snapshot())
}

/// Updates an existing remote connection. If `password` is an empty string the existing one is kept.
#[tauri::command]
#[specta::specta]
pub fn update_remote_connection(
    store: State<'_, Store>,
    id: String,
    request: RemoteConnectionRequest,
) -> Result<AppState, CoreError> {
    // Validate it exists
    store.remote_connection(&id)?;

    if !request.password.is_empty() {
        secrets::set_remote_password(&id, &request.password)?;
    }

    store.update(|state| {
        if let Some(rc) = state.remote_connections.iter_mut().find(|r| r.id == id) {
            rc.name = request.name;
            rc.host = request.host;
            rc.port = request.port;
            rc.user = request.user;
            rc.database = request.database;
            rc.ssl_mode = request.ssl_mode;
            rc.provider = request.provider;
        }
    })?;
    Ok(store.snapshot())
}

/// Removes a saved remote connection and wipes its keychain entry. Closes any open session.
#[tauri::command]
#[specta::specta]
pub async fn remove_remote_connection(
    store: State<'_, Store>,
    connections: State<'_, Connections>,
    id: String,
) -> Result<AppState, CoreError> {
    store.remote_connection(&id)?;
    connections.close(&remote_connection_id(&id)).await;
    secrets::delete_remote_password(&id)?;
    store.update(|state| state.remote_connections.retain(|r| r.id != id))?;
    Ok(store.snapshot())
}

/// Opens a session for a saved remote connection. Returns the same `OpenedConnection` shape as `open_server`.
#[tauri::command]
#[specta::specta]
pub async fn open_remote_connection(
    store: State<'_, Store>,
    connections: State<'_, Connections>,
    id: String,
) -> Result<super::connections::OpenedConnection, CoreError> {
    let rc = store.remote_connection(&id)?;
    let password = secrets::remote_password(&id)?;
    let config = make_config(&rc, password);

    let driver = connections.driver(DatabaseKind::Postgres)?;
    let started = Instant::now();
    let session: Arc<dyn pc_core::driver::DriverSession> = driver.connect(config.clone()).await?.into();

    let opened = super::connections::OpenedConnection {
        connection_id: remote_connection_id(&id),
        server_version: session.server_version().to_owned(),
        latency_ms: started.elapsed().as_millis().min(u32::MAX as u128) as u32,
        database: config.database.clone(),
    };
    connections.insert(opened.connection_id.clone(), session).await;
    Ok(opened)
}

/// Tests a remote connection form without saving anything.
#[tauri::command]
#[specta::specta]
pub async fn test_remote_connection(
    connections: State<'_, Connections>,
    request: RemoteConnectionRequest,
) -> Result<pc_core::driver::TestResult, CoreError> {
    let config = ConnectionConfig {
        host: request.host,
        port: request.port,
        user: request.user,
        password: request.password,
        database: request.database,
        ssl_mode: to_driver_ssl(request.ssl_mode),
    };
    connections.driver(DatabaseKind::Postgres)?.test_connection(&config).await
}
