//! Backup and restore for PostCompass-managed servers, using that server's own `pg_dump` / `pg_restore`.

use std::path::Path;

use pc_core::CoreError;
use pc_core::runtime::{
    BackupRequest, BackupResult, RestoreRequest, RestoreResult, ToolConnection,
};
use runtime_postgres::tools;
use tauri::State;
use tauri::ipc::Channel;

use crate::connections::Connections;
use crate::secrets;
use crate::state::Store;

async fn tool_connection(
    store: &Store,
    server_id: &str,
) -> Result<(ToolConnection, String), CoreError> {
    let server = store.server(server_id)?;
    let id = server.id.clone();
    let conn = ToolConnection {
        host: server.host,
        port: server.port,
        user: server.superuser,
        password: secrets::blocking(move || secrets::server_password(&id)).await?,
    };
    Ok((conn, server.bin_dir))
}

/// Writes a backup of `request.database`. Progress lines stream over `on_log`; `job_id` lets `cancel_job` stop it.
#[tauri::command]
#[specta::specta]
pub async fn backup_database(
    store: State<'_, Store>,
    connections: State<'_, Connections>,
    server_id: String,
    request: BackupRequest,
    job_id: String,
    on_log: Channel<String>,
) -> Result<BackupResult, CoreError> {
    let (conn, bin_dir) = tool_connection(&store, &server_id).await?;
    let run = connections.begin_run(&job_id).await;
    let log = move |line: String| {
        let _ = on_log.send(line);
    };
    let result = tools::backup(Path::new(&bin_dir), &conn, &request, &log, &run.token).await;
    run.finish().await;
    result
}

/// Restores a backup file (either format, detected automatically) in one transaction.
#[tauri::command]
#[specta::specta]
pub async fn restore_database(
    store: State<'_, Store>,
    connections: State<'_, Connections>,
    server_id: String,
    request: RestoreRequest,
    job_id: String,
    on_log: Channel<String>,
) -> Result<RestoreResult, CoreError> {
    let (conn, bin_dir) = tool_connection(&store, &server_id).await?;
    let run = connections.begin_run(&job_id).await;
    let log = move |line: String| {
        let _ = on_log.send(line);
    };
    let result = tools::restore(Path::new(&bin_dir), &conn, &request, &log, &run.token).await;
    run.finish().await;
    result
}

#[tauri::command]
#[specta::specta]
pub async fn cancel_job(
    connections: State<'_, Connections>,
    job_id: String,
) -> Result<(), CoreError> {
    connections.cancel_run(&job_id).await;
    Ok(())
}
