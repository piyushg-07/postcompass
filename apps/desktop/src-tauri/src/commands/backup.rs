//! Backup and restore for PostCompass-managed servers, using that server's own `pg_dump` / `pg_restore`,
//! and copying a saved cloud connection's database onto one of those servers.

use std::path::Path;

use pc_core::driver::ConnectionConfig;
use pc_core::runtime::{
    BackupRequest, BackupResult, CopyRequest, CopyResult, RestoreRequest, RestoreResult,
    ToolConnection,
};
use pc_core::{CoreError, DatabaseKind};
use runtime_postgres::tools;
use tauri::ipc::Channel;
use tauri::{AppHandle, Manager, State};

use crate::connections::Connections;
use crate::secrets;
use crate::state::{RemoteConnection, SslMode, Store};

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
        // Local servers listen on 127.0.0.1; libpq's default is fine
        ssl_mode: None,
        ssl_root_cert: None,
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

/// The major version in "18.6", "16.4 (Ubuntu 16.4-1)" or "18.6.0"; 0 when there is none.
fn major(version: &str) -> u32 {
    version
        .chars()
        .take_while(char::is_ascii_digit)
        .collect::<String>()
        .parse()
        .unwrap_or(0)
}

/// The saved TLS setting as libpq's `sslmode` and `sslrootcert`, for tools of version `tools_major`.
fn tools_tls(
    rc: &RemoteConnection,
    tools_major: u32,
) -> Result<(&'static str, Option<String>), CoreError> {
    Ok(match rc.ssl_mode {
        SslMode::Disable => ("disable", None),
        SslMode::Prefer => ("prefer", None),
        SslMode::Require => ("require", None),
        SslMode::VerifyFull => match &rc.ca_cert {
            Some(ca) => ("verify-full", Some(ca.clone())),
            // `sslrootcert=system` (the OS trust store) arrived with PostgreSQL 16's libpq
            None if tools_major >= 16 => ("verify-full", Some("system".to_owned())),
            None => {
                return Err(CoreError::InvalidInput(
                    "This connection verifies the server certificate. Copy into a local server                      with PostgreSQL 16 or newer, or add the provider's CA certificate to the connection."
                        .into(),
                ));
            }
        },
    })
}

/// Copies a saved cloud connection's database into a new database on a local server. The cloud
/// database is only read. Progress lines stream over `on_log`; `job_id` lets `cancel_job` stop it.
#[tauri::command]
#[specta::specta]
#[allow(clippy::too_many_arguments)]
pub async fn copy_to_local(
    app: AppHandle,
    store: State<'_, Store>,
    connections: State<'_, Connections>,
    remote_id: String,
    server_id: String,
    request: CopyRequest,
    job_id: String,
    on_log: Channel<String>,
) -> Result<CopyResult, CoreError> {
    if request.source_database.trim().is_empty() {
        return Err(CoreError::InvalidInput("Pick a database to copy".into()));
    }
    if request.database.trim().is_empty() {
        return Err(CoreError::InvalidInput("Name the new database".into()));
    }
    let rc = store.remote_connection(&remote_id)?;
    let local = store.server(&server_id)?;
    let (target, bin_dir) = tool_connection(&store, &server_id).await?;
    let key = remote_id.clone();
    let password = secrets::blocking(move || secrets::remote_password(&key)).await?;
    let temp_dir = app
        .path()
        .app_local_data_dir()
        .map_err(|e| CoreError::Internal(format!("could not find the app data folder: {e}")))?
        .join("tmp");

    let run = connections.begin_run(&job_id).await;
    let log = move |line: String| {
        let _ = on_log.send(line);
    };
    let result = async {
        // pg_dump can only read servers of its own major version or older
        log(format!("Connecting to {}", rc.host));
        let config = ConnectionConfig {
            host: rc.host.clone(),
            port: rc.port,
            user: rc.user.clone(),
            password: password.clone(),
            database: rc.database.clone(),
            ssl_mode: rc.ssl_mode,
            ca_cert: rc.ca_cert.clone(),
        };
        let remote_version = connections
            .driver(DatabaseKind::Postgres)?
            .test_connection(&config)
            .await?
            .server_version;
        let (remote_major, local_major) = (major(&remote_version), major(&local.version));
        if remote_major > local_major {
            return Err(CoreError::InvalidInput(format!(
                "{} runs PostgreSQL {remote_major}, which is newer than {} (PostgreSQL {local_major}).                  Copy into a local server with PostgreSQL {remote_major} or newer.",
                rc.name, local.name
            )));
        }
        log(format!("{} runs PostgreSQL {remote_version}", rc.name));

        let (ssl_mode, ssl_root_cert) = tools_tls(&rc, local_major)?;
        let source = ToolConnection {
            host: rc.host.clone(),
            port: rc.port,
            user: rc.user.clone(),
            password,
            ssl_mode: Some(ssl_mode),
            ssl_root_cert,
        };
        tools::copy(
            Path::new(&bin_dir),
            &source,
            &request.source_database,
            &target,
            &request,
            &temp_dir,
            &log,
            &run.token,
        )
        .await
    }
    .await;
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

#[cfg(test)]
mod tests {
    use super::major;

    #[test]
    fn reads_major_versions() {
        assert_eq!(major("18.6"), 18);
        assert_eq!(major("16.4 (Ubuntu 16.4-1.pgdg22.04+1)"), 16);
        assert_eq!(major("15.19.0"), 15);
        assert_eq!(major("devel"), 0);
    }
}
