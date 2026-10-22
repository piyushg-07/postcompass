//! The `DatabaseDriver` interface: connect to a database server, inspect it, query and edit it.
//! One implementation per database (`driver-postgres`, later `driver-mysql` …).
//!
//! Cell values cross this boundary as text (`Option<String>`, `None` = SQL NULL). Every database can
//! render any value as text, the UI can display and edit it without per-type code, and writes cast
//! the text back to the column's real type on the server.

use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use specta::Type;
pub use tokio_util::sync::CancellationToken;

use crate::{CoreResult, DatabaseKind};

pub type Cell = Option<String>;

/* ── Connecting ───────────────────────────────────────────────────────── */

/// SSL/TLS mode for a connection (maps to PostgreSQL libpq sslmode values).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "snake_case")]
pub enum SslMode {
    /// Never use TLS.
    Disable,
    /// Try TLS; fall back to plain if the server does not support it.
    Prefer,
    /// Require TLS; reject if not offered.
    Require,
    /// Require TLS and verify the server certificate chain.
    VerifyFull,
}

impl Default for SslMode {
    fn default() -> Self {
        SslMode::Prefer
    }
}

/// Where and how to connect. Lives only in memory; passwords are never persisted here.
#[derive(Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionConfig {
    pub host: String,
    pub port: u16,
    pub user: String,
    pub password: String,
    /// Database to connect to first.
    pub database: String,
    #[serde(default)]
    pub ssl_mode: SslMode,
    /// PEM file of the provider's CA certificate, trusted on top of the system store
    /// (needed for `VerifyFull` with AWS RDS, Supabase, Azure…).
    #[serde(default)]
    pub ca_cert: Option<String>,
}

impl std::fmt::Debug for ConnectionConfig {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("ConnectionConfig")
            .field("host", &self.host)
            .field("port", &self.port)
            .field("user", &self.user)
            .field("password", &"<redacted>")
            .field("database", &self.database)
            .field("ssl_mode", &self.ssl_mode)
            .field("ca_cert", &self.ca_cert)
            .finish()
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct TestResult {
    /// e.g. `18.6`
    pub server_version: String,
    /// Time to connect and run a trivial query.
    pub latency_ms: u32,
}

/* ── Browsing ─────────────────────────────────────────────────────────── */

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct DatabaseInfo {
    pub name: String,
    /// `None` when the user may not connect to this database.
    pub size_bytes: Option<f64>,
    pub allow_connections: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct SchemaInfo {
    pub name: String,
    pub owner: String,
    pub table_count: u32,
    /// Built-in schemas such as `pg_catalog` and `information_schema`.
    pub is_system: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "snake_case")]
pub enum TableKind {
    Table,
    PartitionedTable,
    View,
    MaterializedView,
    ForeignTable,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct TableInfo {
    pub schema: String,
    pub name: String,
    pub kind: TableKind,
    /// Planner estimate; cheap to read, may be stale for tables that were never analyzed.
    pub row_estimate: f64,
    /// Total size including indexes and TOAST.
    pub size_bytes: f64,
    pub comment: Option<String>,
}

/* ── Structure ────────────────────────────────────────────────────────── */

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ColumnInfo {
    pub name: String,
    /// Full type as the database prints it, e.g. `character varying(255)`.
    pub data_type: String,
    pub nullable: bool,
    pub default: Option<String>,
    pub is_primary_key: bool,
    /// `always` / `by_default` for identity columns.
    pub identity: Option<String>,
    /// Expression of a generated column.
    pub generated: Option<String>,
    pub comment: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ForeignKeyInfo {
    pub name: String,
    pub columns: Vec<String>,
    pub referenced_schema: String,
    pub referenced_table: String,
    pub referenced_columns: Vec<String>,
    pub on_update: String,
    pub on_delete: String,
    pub definition: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct IndexInfo {
    pub name: String,
    pub columns: Vec<String>,
    pub is_unique: bool,
    pub is_primary: bool,
    /// e.g. `btree`, `gin`
    pub method: String,
    pub size_bytes: f64,
    pub definition: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "snake_case")]
pub enum ConstraintKind {
    Check,
    Unique,
    Exclusion,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ConstraintInfo {
    pub name: String,
    pub kind: ConstraintKind,
    pub definition: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct TriggerInfo {
    pub name: String,
    pub enabled: bool,
    pub definition: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct TableStructure {
    pub schema: String,
    pub name: String,
    pub kind: TableKind,
    pub comment: Option<String>,
    /// Row Level Security is switched on.
    pub rls_enabled: bool,
    /// A view runs with the querying user's permissions (`security_invoker`), not its owner's.
    pub security_invoker: bool,
    pub columns: Vec<ColumnInfo>,
    pub primary_key: Vec<String>,
    pub foreign_keys: Vec<ForeignKeyInfo>,
    pub indexes: Vec<IndexInfo>,
    pub constraints: Vec<ConstraintInfo>,
    pub triggers: Vec<TriggerInfo>,
}

/* ── Other schema objects ─────────────────────────────────────────────── */

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct FunctionInfo {
    /// Stable identifier for fetching the definition (overloads share a name).
    pub id: String,
    pub name: String,
    pub arguments: String,
    pub returns: String,
    pub language: String,
    /// `function`, `procedure`, `aggregate` or `window`
    pub kind: String,
    /// The code between the `$$` quotes.
    pub body: String,
    /// `volatile`, `stable` or `immutable`
    pub volatility: String,
    pub security_definer: bool,
    /// The input arguments, or `None` when they use OUT, VARIADIC or defaults
    /// (too much for the simple form; edit the SQL instead).
    pub args: Option<Vec<FunctionArg>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct FunctionArg {
    /// Empty for an unnamed argument.
    pub name: String,
    pub data_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct SequenceInfo {
    pub name: String,
    pub data_type: String,
    pub last_value: Option<String>,
    pub increment: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct EnumInfo {
    pub name: String,
    pub values: Vec<String>,
}

/// A trigger anywhere in a schema, with the table it fires on.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct SchemaTriggerInfo {
    pub name: String,
    pub table: String,
    pub enabled: bool,
    /// The function the trigger runs, e.g. `public.set_updated_at`
    pub function: String,
    pub definition: String,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct SchemaObjects {
    pub functions: Vec<FunctionInfo>,
    pub sequences: Vec<SequenceInfo>,
    pub enums: Vec<EnumInfo>,
    pub triggers: Vec<SchemaTriggerInfo>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "snake_case")]
pub enum ObjectKind {
    Table,
    View,
    MaterializedView,
    Function,
    Sequence,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ExtensionInfo {
    pub name: String,
    pub default_version: Option<String>,
    pub installed_version: Option<String>,
    pub comment: Option<String>,
}

/* ── ER diagram ───────────────────────────────────────────────────────── */

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct GraphColumn {
    pub name: String,
    pub data_type: String,
    pub nullable: bool,
    pub is_primary_key: bool,
    pub is_foreign_key: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct GraphTable {
    pub name: String,
    pub kind: TableKind,
    pub columns: Vec<GraphColumn>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct GraphRelation {
    pub name: String,
    pub from_table: String,
    pub from_columns: Vec<String>,
    pub to_schema: String,
    pub to_table: String,
    pub to_columns: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct SchemaGraph {
    pub tables: Vec<GraphTable>,
    pub relations: Vec<GraphRelation>,
}

/* ── Reading rows ─────────────────────────────────────────────────────── */

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

/* ── Running SQL ──────────────────────────────────────────────────────── */

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(tag = "type", rename_all = "snake_case", rename_all_fields = "camelCase")]
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
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ExplainResult {
    /// The plan as returned by `EXPLAIN (FORMAT JSON)`.
    pub plan_json: String,
    pub analyzed: bool,
}

/* ── Editing rows ─────────────────────────────────────────────────────── */

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ColumnValue {
    pub column: String,
    pub value: Cell,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum RowChange {
    Insert { values: Vec<ColumnValue> },
    Update { key: Vec<ColumnValue>, values: Vec<ColumnValue> },
    Delete { key: Vec<ColumnValue> },
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ApplyResult {
    pub inserted: u32,
    pub updated: u32,
    pub deleted: u32,
}

/* ── The interface ────────────────────────────────────────────────────── */

#[async_trait]
pub trait DatabaseDriver: Send + Sync {
    fn kind(&self) -> DatabaseKind;

    /// Connects, runs a trivial query and disconnects.
    async fn test_connection(&self, config: &ConnectionConfig) -> CoreResult<TestResult>;

    /// Opens a session that can inspect the server. Fails if the credentials are rejected.
    async fn connect(&self, config: ConnectionConfig) -> CoreResult<Box<dyn DriverSession>>;
}

/// A live connection to one server. Implementations connect to other databases on that server on demand.
#[async_trait]
pub trait DriverSession: Send + Sync {
    fn server_version(&self) -> &str;

    // Browsing
    async fn databases(&self) -> CoreResult<Vec<DatabaseInfo>>;
    async fn schemas(&self, database: &str) -> CoreResult<Vec<SchemaInfo>>;
    async fn tables(&self, database: &str, schema: &str) -> CoreResult<Vec<TableInfo>>;
    async fn schema_objects(&self, database: &str, schema: &str) -> CoreResult<SchemaObjects>;
    async fn table_structure(&self, database: &str, schema: &str, table: &str) -> CoreResult<TableStructure>;
    /// SQL that recreates the object. `name` is the function id for functions.
    async fn definition(&self, database: &str, schema: &str, kind: ObjectKind, name: &str) -> CoreResult<String>;
    async fn schema_graph(&self, database: &str, schema: &str) -> CoreResult<SchemaGraph>;
    async fn extensions(&self, database: &str) -> CoreResult<Vec<ExtensionInfo>>;

    // Data
    async fn rows(&self, database: &str, schema: &str, table: &str, request: RowsRequest) -> CoreResult<RowsPage>;
    /// SQL statements `apply_changes` would run, with values inlined for display.
    async fn preview_changes(
        &self,
        database: &str,
        schema: &str,
        table: &str,
        changes: &[RowChange],
    ) -> CoreResult<Vec<String>>;
    /// Applies all changes in one transaction; nothing is applied if any change fails.
    async fn apply_changes(
        &self,
        database: &str,
        schema: &str,
        table: &str,
        changes: &[RowChange],
    ) -> CoreResult<ApplyResult>;

    // SQL
    /// Runs one or more statements. SQL errors are returned in the result, not as `Err`.
    async fn execute(
        &self,
        database: &str,
        sql: &str,
        max_rows: u32,
        cancel: CancellationToken,
    ) -> CoreResult<ExecuteResult>;
    /// `analyze` really runs the statement inside a transaction that is rolled back.
    async fn explain(&self, database: &str, sql: &str, analyze: bool) -> CoreResult<ExplainResult>;
}
