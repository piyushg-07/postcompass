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
    let mut config = ConnectionConfig {
        host: server.host.clone(),
        port: server.port,
        user: server.superuser.clone(),
        password: secrets::server_password(&server.id)?,
        database: "postgres".into(),
        ssl_mode: Default::default(), // local managed servers: prefer (try TLS, fall back)
        ca_cert: None,
    };
    let driver = connections.driver(server.kind)?;

    let started = Instant::now();
    let session: Arc<dyn DriverSession> = match driver.connect(config.clone()).await {
        // The "postgres" database can be renamed or dropped; find another one through template1
        Err(CoreError::NotFound(_)) => {
            config.database = "template1".into();
            let probe = driver.connect(config.clone()).await?;
            let first_usable = probe
                .databases()
                .await?
                .into_iter()
                .find(|d| d.allow_connections)
                .map(|d| d.name);
            if let Some(name) = first_usable {
                config.database = name;
            }
            driver.connect(config.clone()).await?.into()
        }
        other => other?.into(),
    };
    let opened = OpenedConnection {
        connection_id: server_connection_id(&id),
        server_version: session.server_version().to_owned(),
        latency_ms: started.elapsed().as_millis().min(u32::MAX as u128) as u32,
        database: config.database.clone(),
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
