//! Reading table pages, editing rows, and running SQL.

use pc_core::CoreError;
use pc_core::driver::{
    ApplyResult, CancellationToken, ExecuteResult, ExplainResult, RowChange, RowsPage, RowsRequest,
};
use tauri::State;

use crate::connections::Connections;

/// Rows kept per result set in the SQL editor by default. More rows are counted but not sent to
/// the UI.
const MAX_RESULT_ROWS: u32 = 5000;
/// Ceiling for "No limit", so a huge result can't exhaust memory.
const HARD_MAX_ROWS: u32 = 100_000;

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

/// Runs SQL from the editor. `run_id` lets `cancel_sql` stop it. `max_rows` caps the rows kept
/// per result (default 5000); `role` runs it as another role (`SET ROLE`), reset afterwards.
#[tauri::command]
#[specta::specta]
pub async fn execute_sql(
    connections: State<'_, Connections>,
    connection_id: String,
    database: String,
    sql: String,
    run_id: String,
    max_rows: Option<u32>,
    role: Option<String>,
) -> Result<ExecuteResult, CoreError> {
    let session = connections.get(&connection_id).await?;
    let max_rows = max_rows.unwrap_or(MAX_RESULT_ROWS).clamp(1, HARD_MAX_ROWS);
    let role = role.filter(|r| !r.is_empty());
    if let Some(role) = &role {
        let quoted = format!("\"{}\"", role.replace('"', "\"\""));
        let set = session
            .execute(&database, &format!("SET ROLE {quoted}"), 0, CancellationToken::new())
            .await?;
        if set.error.is_some() {
            return Ok(set);
        }
    }
    let cancel = connections.begin_run(&run_id).await;
    let result = session.execute(&database, &sql, max_rows, cancel).await;
    connections.end_run(&run_id).await;
    if role.is_some() {
        // The editor keeps its connection, so put the role back even if the query failed
        let _ = session.execute(&database, "RESET ROLE", 0, CancellationToken::new()).await;
    }
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
