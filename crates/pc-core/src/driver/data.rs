//! Reading table pages and editing rows.

use serde::{Deserialize, Serialize};
use specta::Type;

use super::{Cell, ColumnInfo};

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct SortSpec {
    pub column: String,
    pub descending: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "snake_case")]
pub enum FilterOp {
    Equals,
    NotEquals,
    Contains,
    StartsWith,
    GreaterThan,
    GreaterOrEqual,
    LessThan,
    LessOrEqual,
    IsNull,
    IsNotNull,
    /// SQL `LIKE` with the user's own `%` / `_` wildcards.
    Like,
    /// Case-insensitive `ILIKE`.
    ILike,
    /// One of a comma-separated list of values.
    InList,
    IsTrue,
    IsFalse,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct FilterSpec {
    pub column: String,
    pub op: FilterOp,
    /// Ignored for `is_null` / `is_not_null`.
    pub value: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct RowsRequest {
    pub offset: u32,
    pub limit: u32,
    pub sort: Vec<SortSpec>,
    pub filters: Vec<FilterSpec>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct RowsPage {
    pub columns: Vec<ColumnInfo>,
    pub rows: Vec<Vec<Cell>>,
    /// Columns that identify a row for editing. Empty means the table is read-only here.
    pub key_columns: Vec<String>,
    pub has_more: bool,
    pub total: Option<f64>,
    /// `total` came from planner statistics instead of `count(*)` (large tables).
    pub total_is_estimate: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ColumnValue {
    pub column: String,
    pub value: Cell,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum RowChange {
    Insert {
        values: Vec<ColumnValue>,
    },
    Update {
        key: Vec<ColumnValue>,
        values: Vec<ColumnValue>,
    },
    Delete {
        key: Vec<ColumnValue>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ApplyResult {
    pub inserted: u32,
    pub updated: u32,
    pub deleted: u32,
}
