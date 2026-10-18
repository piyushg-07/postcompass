//! PostgreSQL implementation of [`DatabaseDriver`] on top of `tokio-postgres`.
//!
//! A session keeps one client per database: PostgreSQL connections are bound to a single
//! database, so inspecting another database opens (and caches) another connection.

use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};

use async_trait::async_trait;
use pc_core::driver::{
    ConnectionConfig, DatabaseDriver, DatabaseInfo, DriverSession, SchemaInfo, TableInfo, TableKind, TestResult,
};
use pc_core::{CoreError, CoreResult, DatabaseKind};
use tokio::sync::Mutex;
use tokio_postgres::error::SqlState;
use tokio_postgres::{Client, NoTls};

const CONNECT_TIMEOUT: Duration = Duration::from_secs(10);
const APPLICATION_NAME: &str = "PostCompass";

#[derive(Debug, Default, Clone, Copy)]
pub struct PostgresDriver;

#[async_trait]
impl DatabaseDriver for PostgresDriver {
    fn kind(&self) -> DatabaseKind {
        DatabaseKind::Postgres
    }

    async fn test_connection(&self, config: &ConnectionConfig) -> CoreResult<TestResult> {
        let started = Instant::now();
        let client = open(config, &config.database).await?;
        let server_version = server_version(&client).await?;
        Ok(TestResult {
            server_version,
            latency_ms: started.elapsed().as_millis().min(u32::MAX as u128) as u32,
        })
    }

    async fn connect(&self, config: ConnectionConfig) -> CoreResult<Box<dyn DriverSession>> {
        let client = open(&config, &config.database).await?;
        let version = server_version(&client).await?;
        let mut clients = HashMap::new();
        clients.insert(config.database.clone(), Arc::new(client));
        Ok(Box::new(PostgresSession {
            config,
            version,
            clients: Mutex::new(clients),
        }))
    }
}

struct PostgresSession {
    config: ConnectionConfig,
    version: String,
    clients: Mutex<HashMap<String, Arc<Client>>>,
}

impl PostgresSession {
    /// A live client for `database`, reconnecting if the cached one was closed (e.g. server restart).
    async fn client(&self, database: &str) -> CoreResult<Arc<Client>> {
        let mut clients = self.clients.lock().await;
        if let Some(client) = clients.get(database)
            && !client.is_closed()
        {
            return Ok(client.clone());
        }
        let client = Arc::new(open(&self.config, database).await?);
        clients.insert(database.to_owned(), client.clone());
        Ok(client)
    }
}

#[async_trait]
impl DriverSession for PostgresSession {
    fn server_version(&self) -> &str {
        &self.version
    }

    async fn databases(&self) -> CoreResult<Vec<DatabaseInfo>> {
        let client = self.client(&self.config.database).await?;
        let rows = client
            .query(
                "select datname,
                        case when has_database_privilege(datname, 'CONNECT')
                             then pg_database_size(datname)::float8 end,
                        datallowconn
                   from pg_database
                  where not datistemplate
                  order by datname",
                &[],
            )
            .await
            .map_err(map_error)?;
        Ok(rows
            .iter()
            .map(|row| DatabaseInfo {
                name: row.get(0),
                size_bytes: row.get(1),
                allow_connections: row.get(2),
            })
            .collect())
    }

    async fn schemas(&self, database: &str) -> CoreResult<Vec<SchemaInfo>> {
        let client = self.client(database).await?;
        let rows = client
            .query(
                "select n.nspname,
                        pg_get_userbyid(n.nspowner),
                        (select count(*) from pg_class c
                          where c.relnamespace = n.oid and c.relkind in ('r', 'p', 'v', 'm', 'f'))::int4,
                        n.nspname in ('pg_catalog', 'information_schema') as is_system
                   from pg_namespace n
                  where n.nspname not like 'pg\\_toast%' and n.nspname not like 'pg\\_temp\\_%'
                  order by is_system, n.nspname",
                &[],
            )
            .await
            .map_err(map_error)?;
        Ok(rows
            .iter()
            .map(|row| SchemaInfo {
                name: row.get(0),
                owner: row.get(1),
                table_count: row.get::<_, i32>(2).max(0) as u32,
                is_system: row.get(3),
            })
            .collect())
    }

    async fn tables(&self, database: &str, schema: &str) -> CoreResult<Vec<TableInfo>> {
        let client = self.client(database).await?;
        let rows = client
            .query(
                "select c.relname,
                        c.relkind::text,
                        greatest(c.reltuples, 0)::float8,
                        pg_total_relation_size(c.oid)::float8
                   from pg_class c
                   join pg_namespace n on n.oid = c.relnamespace
                  where n.nspname = $1 and c.relkind in ('r', 'p', 'v', 'm', 'f')
                  order by c.relname",
                &[&schema],
            )
            .await
            .map_err(map_error)?;
        Ok(rows
            .iter()
            .map(|row| TableInfo {
                schema: schema.to_owned(),
                name: row.get(0),
                kind: table_kind(row.get(1)),
                row_estimate: row.get(2),
                size_bytes: row.get(3),
            })
            .collect())
    }
}

async fn open(config: &ConnectionConfig, database: &str) -> CoreResult<Client> {
    let mut pg = tokio_postgres::Config::new();
    pg.host(&config.host)
        .port(config.port)
        .user(&config.user)
        .password(&config.password)
        .dbname(database)
        .application_name(APPLICATION_NAME)
        .connect_timeout(CONNECT_TIMEOUT);

    let (client, connection) = tokio::time::timeout(CONNECT_TIMEOUT + Duration::from_secs(2), pg.connect(NoTls))
        .await
        .map_err(|_| CoreError::ConnectionFailed(format!("{}:{} did not respond", config.host, config.port)))?
        .map_err(map_error)?;

    // The connection object drives the socket; it ends when the client is dropped.
    tokio::spawn(async move {
        let _ = connection.await;
    });
    Ok(client)
}

async fn server_version(client: &Client) -> CoreResult<String> {
    let row = client.query_one("show server_version", &[]).await.map_err(map_error)?;
    let full: String = row.get(0);
    // e.g. "16.4 (Debian 16.4-1.pgdg120+1)" → "16.4"
    Ok(full.split_whitespace().next().unwrap_or(&full).to_owned())
}

fn table_kind(relkind: &str) -> TableKind {
    match relkind {
        "p" => TableKind::PartitionedTable,
        "v" => TableKind::View,
        "m" => TableKind::MaterializedView,
        "f" => TableKind::ForeignTable,
        _ => TableKind::Table,
    }
}

/// Turns driver errors into the app's error codes, with the server's own message where there is one.
fn map_error(error: tokio_postgres::Error) -> CoreError {
    if let Some(db) = error.as_db_error() {
        let code = db.code();
        if *code == SqlState::INVALID_PASSWORD || *code == SqlState::INVALID_AUTHORIZATION_SPECIFICATION {
            return CoreError::AuthFailed(db.message().to_owned());
        }
        if *code == SqlState::INVALID_CATALOG_NAME {
            return CoreError::NotFound(db.message().to_owned());
        }
        return CoreError::QueryFailed(db.message().to_owned());
    }
    // No server response: refused, unreachable, closed, timed out
    CoreError::ConnectionFailed(error.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maps_relkinds() {
        assert_eq!(table_kind("r"), TableKind::Table);
        assert_eq!(table_kind("p"), TableKind::PartitionedTable);
        assert_eq!(table_kind("v"), TableKind::View);
        assert_eq!(table_kind("m"), TableKind::MaterializedView);
        assert_eq!(table_kind("f"), TableKind::ForeignTable);
    }

    #[tokio::test]
    async fn unreachable_server_is_a_connection_error() {
        // Bind then drop to get a port that is almost certainly closed.
        let port = std::net::TcpListener::bind("127.0.0.1:0").unwrap().local_addr().unwrap().port();
        let config = ConnectionConfig {
            host: "127.0.0.1".into(),
            port,
            user: "postgres".into(),
            password: "x".into(),
            database: "postgres".into(),
        };
        let err = PostgresDriver.test_connection(&config).await.unwrap_err();
        assert_eq!(err.code(), pc_core::ErrorCode::ConnectionFailed);
    }

    #[test]
    fn debug_output_hides_the_password() {
        let config = ConnectionConfig {
            host: "h".into(),
            port: 1,
            user: "u".into(),
            password: "super-secret".into(),
            database: "d".into(),
        };
        assert!(!format!("{config:?}").contains("super-secret"));
    }
}
