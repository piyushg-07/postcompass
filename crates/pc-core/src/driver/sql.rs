//! Running SQL from the editor and explaining it.

use serde::{Deserialize, Serialize};
use specta::Type;

use super::Cell;

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(
    tag = "type",
    rename_all = "snake_case",
    rename_all_fields = "camelCase"
)]
pub enum StatementResult {
    Rows {
        columns: Vec<String>,
        rows: Vec<Vec<Cell>>,
        /// Row cap reached; more rows exist.
        truncated: bool,
        row_count: f64,
    },
    Command {
        rows_affected: f64,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct SqlError {
    pub message: String,
    pub detail: Option<String>,
    pub hint: Option<String>,
    /// 1-based character offset in the submitted SQL.
    pub position: Option<u32>,
    /// SQLSTATE, e.g. `42P01`.
    pub code: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ExecuteResult {
    /// Results of the statements that completed, in order.
    pub statements: Vec<StatementResult>,
    /// Set when a statement failed; later statements did not run.
    pub error: Option<SqlError>,
    pub cancelled: bool,
    pub duration_ms: u32,
    /// NOTICE / WARNING / RAISE messages the server sent while the statements ran.
    pub notices: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ExplainResult {
    /// The plan as returned by `EXPLAIN (FORMAT JSON)`.
    pub plan_json: String,
    pub analyzed: bool,
}
