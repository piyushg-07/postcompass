//! Reading table pages, editing rows, and running SQL.

use pc_core::CoreError;
use pc_core::driver::{ApplyResult, ExecuteResult, ExplainResult, RowChange, RowsPage, RowsRequest};
use tauri::State;

use crate::connections::Connections;

/// Rows kept per result set in the SQL editor. More rows are counted but not sent to the UI.
const MAX_RESULT_ROWS: u32 = 5000;

#[tauri::command]
#[specta::specta]
pub async fn table_rows(
    connections: State<'_, Connections>,
    connection_id: String,
    database: String,
    schema: String,
    table: String,
    request: RowsRequest,
) -> Result<RowsPage, CoreError> {
    connections
        .get(&connection_id)
        .await?
        .rows(&database, &schema, &table, request)
        .await
}

/// The SQL that `apply_changes` would run, for review before saving.
#[tauri::command]
#[specta::specta]
pub async fn preview_changes(
    connections: State<'_, Connections>,
    connection_id: String,
    database: String,
    schema: String,
    table: String,
    changes: Vec<RowChange>,
) -> Result<Vec<String>, CoreError> {
    connections
        .get(&connection_id)
        .await?
        .preview_changes(&database, &schema, &table, &changes)
        .await
}

/// Saves row changes in one transaction: all or nothing.
#[tauri::command]
#[specta::specta]
pub async fn apply_changes(
    connections: State<'_, Connections>,
    connection_id: String,
    database: String,
    schema: String,
    table: String,
    changes: Vec<RowChange>,
) -> Result<ApplyResult, CoreError> {
    connections
        .get(&connection_id)
        .await?
        .apply_changes(&database, &schema, &table, &changes)
        .await
}

/// Runs SQL from the editor. `run_id` lets `cancel_sql` stop it.
#[tauri::command]
#[specta::specta]
pub async fn execute_sql(
    connections: State<'_, Connections>,
    connection_id: String,
    database: String,
    sql: String,
    run_id: String,
) -> Result<ExecuteResult, CoreError> {
    let session = connections.get(&connection_id).await?;
    let cancel = connections.begin_run(&run_id).await;
    let result = session.execute(&database, &sql, MAX_RESULT_ROWS, cancel).await;
    connections.end_run(&run_id).await;
    result
}

#[tauri::command]
#[specta::specta]
pub async fn cancel_sql(connections: State<'_, Connections>, run_id: String) -> Result<(), CoreError> {
    connections.cancel_run(&run_id).await;
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn explain_sql(
    connections: State<'_, Connections>,
    connection_id: String,
    database: String,
    sql: String,
    analyze: bool,
) -> Result<ExplainResult, CoreError> {
    connections.get(&connection_id).await?.explain(&database, &sql, analyze).await
}
