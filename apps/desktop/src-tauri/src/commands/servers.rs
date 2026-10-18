//! Local servers: detect, install, start/stop, uninstall. Dispatches to the runtime for each database kind.

use std::sync::Arc;

use pc_core::runtime::{
    DetectionReport, InstallContext, InstallEvent, InstallRequest, ManagedServer, RuntimeVersion, ServerStatus,
};
use pc_core::{CoreError, DatabaseKind};
use serde::Serialize;
use specta::Type;
use tauri::State;
use tauri::ipc::Channel;

use crate::connections::{Connections, server_connection_id};
use crate::runtimes::Runtimes;
use crate::secrets;
use crate::state::Store;

/// Versions that can be installed locally, newest first.
#[tauri::command]
#[specta::specta]
pub fn runtime_versions(runtimes: State<'_, Runtimes>, kind: DatabaseKind) -> Result<Vec<RuntimeVersion>, CoreError> {
    Ok(runtimes.get(kind)?.available_versions())
}

/// Scans this machine for existing installs and running servers. Read-only.
#[tauri::command]
#[specta::specta]
pub async fn detect_local(runtimes: State<'_, Runtimes>, kind: DatabaseKind) -> Result<DetectionReport, CoreError> {
    let runtime = runtimes.get(kind)?;
    Ok(runtime.detect(Some(runtimes.root_for(kind))).await)
}

/// First free port at or above the database's default port.
#[tauri::command]
#[specta::specta]
pub fn suggest_port(kind: DatabaseKind) -> Result<u16, CoreError> {
    runtime_postgres::first_free_port(kind.default_port())
        .ok_or_else(|| CoreError::PortInUse(kind.default_port()))
}

#[tauri::command]
#[specta::specta]
pub fn is_port_free(port: u16) -> bool {
    runtime_postgres::port_is_free(port)
}

/// Installs and starts a new server, streaming progress over `on_event`.
/// On success the server is saved and its password stored in the OS keychain.
#[tauri::command]
#[specta::specta]
pub async fn install_server(
    runtimes: State<'_, Runtimes>,
    store: State<'_, Store>,
    kind: DatabaseKind,
    request: InstallRequest,
    on_event: Channel<InstallEvent>,
) -> Result<ManagedServer, CoreError> {
    let runtime = runtimes.get(kind)?;
    let cancel = runtimes.begin_install()?;
    let password = request.password.clone();
    let ctx = InstallContext {
        progress: Arc::new(move |event| {
            let _ = on_event.send(event);
        }),
        cancel,
        root_dir: runtimes.root_for(kind),
    };

    let result = runtime.install(request, ctx).await;
    runtimes.end_install();
    let server = result?;

    // Persist; if that fails, don't leave an orphaned running server behind
    let saved = secrets::set_server_password(&server.id, &password)
        .and_then(|_| store.update(|state| state.servers.push(server.clone())));
    if let Err(e) = saved {
        let _ = runtime.uninstall(&server, false).await;
        let _ = secrets::delete_server_password(&server.id);
        return Err(e);
    }
    Ok(server)
}

#[tauri::command]
#[specta::specta]
pub fn cancel_install(runtimes: State<'_, Runtimes>) {
    runtimes.cancel_install();
}

#[derive(Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ServerStatusEntry {
    pub id: String,
    pub status: ServerStatus,
}

/// Live status of every managed server.
#[tauri::command]
#[specta::specta]
pub async fn server_statuses(
    runtimes: State<'_, Runtimes>,
    store: State<'_, Store>,
) -> Result<Vec<ServerStatusEntry>, CoreError> {
    let servers = store.snapshot().servers;
    let checks = servers.iter().map(|server| {
        let runtime = runtimes.get(server.kind);
        async move {
            let status = match runtime {
                Ok(runtime) => runtime.status(server).await,
                Err(_) => ServerStatus::Error,
            };
            ServerStatusEntry {
                id: server.id.clone(),
                status,
            }
        }
    });
    Ok(futures_util::future::join_all(checks).await)
}

#[tauri::command]
#[specta::specta]
pub async fn start_server(
    runtimes: State<'_, Runtimes>,
    store: State<'_, Store>,
    id: String,
) -> Result<ServerStatus, CoreError> {
    let server = store.server(&id)?;
    let runtime = runtimes.get(server.kind)?;
    runtime.start(&server).await?;
    Ok(runtime.status(&server).await)
}

#[tauri::command]
#[specta::specta]
pub async fn stop_server(
    runtimes: State<'_, Runtimes>,
    store: State<'_, Store>,
    connections: State<'_, Connections>,
    id: String,
) -> Result<ServerStatus, CoreError> {
    let server = store.server(&id)?;
    connections.close(&server_connection_id(&id)).await;
    let runtime = runtimes.get(server.kind)?;
    runtime.stop(&server).await?;
    Ok(runtime.status(&server).await)
}

/// Reveals a server's password. Only called on an explicit user action ("Show" / "Copy").
#[tauri::command]
#[specta::specta]
pub fn server_password(store: State<'_, Store>, id: String) -> Result<String, CoreError> {
    store.server(&id)?;
    secrets::server_password(&id)
}

/// Stops the server, removes it from PostCompass and deletes its data unless `keep_data` is set.
#[tauri::command]
#[specta::specta]
pub async fn uninstall_server(
    runtimes: State<'_, Runtimes>,
    store: State<'_, Store>,
    connections: State<'_, Connections>,
    id: String,
    keep_data: bool,
) -> Result<(), CoreError> {
    let server = store.server(&id)?;
    connections.close(&server_connection_id(&id)).await;
    runtimes.get(server.kind)?.uninstall(&server, keep_data).await?;
    secrets::delete_server_password(&id)?;
    store.update(|state| state.servers.retain(|s| s.id != id))?;
    Ok(())
}
