//! Connecting to servers and inspecting them (databases, schemas, tables).

use std::sync::Arc;
use std::time::Instant;

use pc_core::driver::{ConnectionConfig, DatabaseInfo, DriverSession, SchemaInfo, TableInfo, TestResult};
use pc_core::{CoreError, DatabaseKind};
use serde::Serialize;
use specta::Type;
use tauri::State;

use crate::connections::{Connections, server_connection_id};
use crate::secrets;
use crate::state::Store;

#[derive(Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct OpenedConnection {
    pub connection_id: String,
    pub server_version: String,
    pub latency_ms: u32,
    /// Database the session connected to first.
    pub database: String,
}

/// Connects to a PostCompass-managed server using the password from the OS keychain. No form needed.
#[tauri::command]
#[specta::specta]
pub async fn open_server(
    connections: State<'_, Connections>,
    store: State<'_, Store>,
    id: String,
) -> Result<OpenedConnection, CoreError> {
    let server = store.server(&id)?;
    let config = ConnectionConfig {
        host: server.host.clone(),
        port: server.port,
        user: server.superuser.clone(),
        password: secrets::server_password(&server.id)?,
        database: "postgres".into(),
    };

    let started = Instant::now();
    let session: Arc<dyn DriverSession> = connections.driver(server.kind)?.connect(config).await?.into();
    let opened = OpenedConnection {
        connection_id: server_connection_id(&id),
        server_version: session.server_version().to_owned(),
        latency_ms: started.elapsed().as_millis().min(u32::MAX as u128) as u32,
        database: "postgres".into(),
    };
    connections.insert(opened.connection_id.clone(), session).await;
    Ok(opened)
}

/// Checks connection details without saving anything.
#[tauri::command]
#[specta::specta]
pub async fn test_connection(
    connections: State<'_, Connections>,
    kind: DatabaseKind,
    config: ConnectionConfig,
) -> Result<TestResult, CoreError> {
    connections.driver(kind)?.test_connection(&config).await
}

#[tauri::command]
#[specta::specta]
pub async fn close_connection(connections: State<'_, Connections>, connection_id: String) -> Result<(), CoreError> {
    connections.close(&connection_id).await;
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn list_databases(
    connections: State<'_, Connections>,
    connection_id: String,
) -> Result<Vec<DatabaseInfo>, CoreError> {
    connections.get(&connection_id).await?.databases().await
}

#[tauri::command]
#[specta::specta]
pub async fn list_schemas(
    connections: State<'_, Connections>,
    connection_id: String,
    database: String,
) -> Result<Vec<SchemaInfo>, CoreError> {
    connections.get(&connection_id).await?.schemas(&database).await
}

#[tauri::command]
#[specta::specta]
pub async fn list_tables(
    connections: State<'_, Connections>,
    connection_id: String,
    database: String,
    schema: String,
) -> Result<Vec<TableInfo>, CoreError> {
    connections.get(&connection_id).await?.tables(&database, &schema).await
}
