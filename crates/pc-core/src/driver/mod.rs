//! The `DatabaseDriver` interface: connect to a database server, inspect it, query and edit it.
//! One implementation per database (`driver-postgres`, later `driver-mysql` …).
//!
//! Cell values cross this boundary as text (`Option<String>`, `None` = SQL NULL). Every database can
//! render any value as text, the UI can display and edit it without per-type code, and writes cast
//! the text back to the column's real type on the server.

mod catalog;
mod connection;
mod data;
mod graph;
mod objects;
mod sql;

use async_trait::async_trait;
pub use tokio_util::sync::CancellationToken;

pub use catalog::*;
pub use connection::*;
pub use data::*;
pub use graph::*;
pub use objects::*;
pub use sql::*;

use crate::{CoreResult, DatabaseKind};

/// One cell value as text; `None` is SQL NULL.
pub type Cell = Option<String>;

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
    async fn table_structure(
        &self,
        database: &str,
        schema: &str,
        table: &str,
    ) -> CoreResult<TableStructure>;
    /// SQL that recreates the object. `name` is the function id for functions.
    async fn definition(
        &self,
        database: &str,
        schema: &str,
        kind: ObjectKind,
        name: &str,
    ) -> CoreResult<String>;
    async fn schema_graph(&self, database: &str, schema: &str) -> CoreResult<SchemaGraph>;
    async fn extensions(&self, database: &str) -> CoreResult<Vec<ExtensionInfo>>;
    async fn policies(&self, database: &str, schema: &str) -> CoreResult<SchemaPolicies>;

    // Data
    async fn rows(
        &self,
        database: &str,
        schema: &str,
        table: &str,
        request: RowsRequest,
    ) -> CoreResult<RowsPage>;
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
    /// Runs one or more statements, as `role` when given. SQL errors are returned in the result,
    /// not as `Err`. Runs on one database never overlap, so a cancel only stops its own run.
    async fn execute(
        &self,
        database: &str,
        sql: &str,
        max_rows: u32,
        cancel: CancellationToken,
        role: Option<&str>,
    ) -> CoreResult<ExecuteResult>;
    /// `analyze` really runs the statement inside a transaction that is rolled back.
    async fn explain(&self, database: &str, sql: &str, analyze: bool) -> CoreResult<ExplainResult>;
}
