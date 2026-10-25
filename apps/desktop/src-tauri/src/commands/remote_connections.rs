//! Commands for user-managed remote PostgreSQL connections (AWS RDS, GCP Cloud SQL, Azure, Cloudflare Hyperdrive, etc.).
//!
//! Passwords are stored in the OS keychain under the key `remote:<id>` and are never written to
//! `state.json`. The UI receives `RemoteConnection` without any password field.

use std::sync::Arc;
use std::time::Instant;

use pc_core::driver::ConnectionConfig;
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

fn make_config(rc: &RemoteConnection, password: String) -> ConnectionConfig {
    ConnectionConfig {
        host: rc.host.clone(),
        port: rc.port,
        user: rc.user.clone(),
        password,
        database: rc.database.clone(),
        ssl_mode: rc.ssl_mode,
        ca_cert: rc.ca_cert.clone(),
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
    /// PEM file with the provider's CA certificate (optional).
    #[serde(default)]
    pub ca_cert: Option<String>,
    pub provider: String,
}

fn clean_path(path: Option<String>) -> Option<String> {
    path.map(|p| p.trim().to_owned()).filter(|p| !p.is_empty())
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
        ca_cert: clean_path(request.ca_cert),
        provider: request.provider,
        created_at: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as f64,
    };
    secrets::set_remote_password(&id, &request.password)?;
    if let Err(e) = store.update(|state| state.remote_connections.push(rc)) {
        // Don't leave a keychain entry behind for a connection that was never saved
        let _ = secrets::delete_remote_password(&id);
        return Err(e);
    }
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
            rc.ca_cert = clean_path(request.ca_cert);
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
    store.update(|state| state.remote_connections.retain(|r| r.id != id))?;
    // Best effort, after the removal: a locked keyring mustn't make the connection impossible to remove
    let key = id.clone();
    if let Err(e) = secrets::blocking(move || secrets::delete_remote_password(&key)).await {
        eprintln!("could not delete the saved password of connection {id}: {e}");
    }
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
    let key = id.clone();
    let password = secrets::blocking(move || secrets::remote_password(&key)).await?;
    let config = make_config(&rc, password);

    let driver = connections.driver(DatabaseKind::Postgres)?;
    let started = Instant::now();
    let session: Arc<dyn pc_core::driver::DriverSession> =
        driver.connect(config.clone()).await?.into();

    let opened = super::connections::OpenedConnection {
        connection_id: remote_connection_id(&id),
        server_version: session.server_version().to_owned(),
        latency_ms: started.elapsed().as_millis().min(u32::MAX as u128) as u32,
        database: config.database.clone(),
    };
    connections
        .insert(opened.connection_id.clone(), session)
        .await;
    Ok(opened)
}

/// Tests a remote connection form without saving anything. When editing (`existing_id`) and the
/// password field is left empty, the saved password from the keychain is used.
#[tauri::command]
#[specta::specta]
pub async fn test_remote_connection(
    connections: State<'_, Connections>,
    request: RemoteConnectionRequest,
    existing_id: Option<String>,
) -> Result<pc_core::driver::TestResult, CoreError> {
    let password = match existing_id {
        Some(id) if request.password.is_empty() => {
            secrets::blocking(move || secrets::remote_password(&id)).await?
        }
        _ => request.password,
    };
    let config = ConnectionConfig {
        host: request.host,
        port: request.port,
        user: request.user,
        password,
        database: request.database,
        ssl_mode: request.ssl_mode,
        ca_cert: clean_path(request.ca_cert),
    };
    connections
        .driver(DatabaseKind::Postgres)?
        .test_connection(&config)
        .await
}
