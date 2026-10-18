//! The `DatabaseDriver` interface: connect to a database server and inspect it.
//! One implementation per database (`driver-postgres`, later `driver-mysql` …).

use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use specta::Type;

use crate::{CoreResult, DatabaseKind};

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
}

impl std::fmt::Debug for ConnectionConfig {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("ConnectionConfig")
            .field("host", &self.host)
            .field("port", &self.port)
            .field("user", &self.user)
            .field("password", &"<redacted>")
            .field("database", &self.database)
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
}

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
    async fn databases(&self) -> CoreResult<Vec<DatabaseInfo>>;
    async fn schemas(&self, database: &str) -> CoreResult<Vec<SchemaInfo>>;
    async fn tables(&self, database: &str, schema: &str) -> CoreResult<Vec<TableInfo>>;
}
