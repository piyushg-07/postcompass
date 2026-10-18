//! Inspecting a connected server beyond the basic tree: structure, other objects, definitions, ER graph.

use pc_core::CoreError;
use pc_core::driver::{ExtensionInfo, ObjectKind, SchemaGraph, SchemaObjects, TableStructure};
use tauri::State;

use crate::connections::Connections;

#[tauri::command]
#[specta::specta]
pub async fn schema_objects(
    connections: State<'_, Connections>,
    connection_id: String,
    database: String,
    schema: String,
) -> Result<SchemaObjects, CoreError> {
    connections.get(&connection_id).await?.schema_objects(&database, &schema).await
}

#[tauri::command]
#[specta::specta]
pub async fn table_structure(
    connections: State<'_, Connections>,
    connection_id: String,
    database: String,
    schema: String,
    table: String,
) -> Result<TableStructure, CoreError> {
    connections
        .get(&connection_id)
        .await?
        .table_structure(&database, &schema, &table)
        .await
}

/// SQL that recreates a table, view, function or sequence. `name` is the function id for functions.
#[tauri::command]
#[specta::specta]
pub async fn object_definition(
    connections: State<'_, Connections>,
    connection_id: String,
    database: String,
    schema: String,
    kind: ObjectKind,
    name: String,
) -> Result<String, CoreError> {
    connections
        .get(&connection_id)
        .await?
        .definition(&database, &schema, kind, &name)
        .await
}

#[tauri::command]
#[specta::specta]
pub async fn schema_graph(
    connections: State<'_, Connections>,
    connection_id: String,
    database: String,
    schema: String,
) -> Result<SchemaGraph, CoreError> {
    connections.get(&connection_id).await?.schema_graph(&database, &schema).await
}

#[tauri::command]
#[specta::specta]
pub async fn list_extensions(
    connections: State<'_, Connections>,
    connection_id: String,
    database: String,
) -> Result<Vec<ExtensionInfo>, CoreError> {
    connections.get(&connection_id).await?.extensions(&database).await
}
