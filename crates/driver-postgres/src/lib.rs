//! PostgreSQL implementation of [`DatabaseDriver`] on top of `tokio-postgres`.
//!
//! PostgreSQL connections are bound to one database, so a session keeps connections per database:
//! - a **browse** connection for catalog queries and table pages,
//! - an **editor** connection for the SQL editor, so its session state (`SET`, `BEGIN`, temp tables)
//!   persists between runs and a long query never blocks browsing,
//! - a fresh, short-lived connection for each transaction (row edits, `EXPLAIN ANALYZE`).

mod ddl;
mod edit;
mod execute;
mod introspect;
mod rows;
mod sql;

use std::collections::HashMap;
use std::ops::{Deref, DerefMut};
use std::sync::Arc;
use std::time::{Duration, Instant};

use async_trait::async_trait;
use native_tls::TlsConnector;
use pc_core::driver::{
    ApplyResult, CancellationToken, ConnectionConfig, DatabaseDriver, DatabaseInfo, DriverSession, ExecuteResult,
    ExplainResult, ExtensionInfo, ObjectKind, RowChange, RowsPage, RowsRequest, SchemaGraph, SchemaInfo, SchemaObjects,
    SchemaPolicies,
    SslMode, TableInfo, TableStructure, TestResult,
};
use pc_core::{CoreError, CoreResult, DatabaseKind};
use postgres_native_tls::MakeTlsConnector;
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
        limit_browsing(&client).await;
        let mut clients = HashMap::new();
        clients.insert(Purpose::Browse.key(&config.database), Arc::new(client));
        Ok(Box::new(PostgresSession {
            config,
            version,
            clients: Mutex::new(clients),
            editor_locks: Mutex::new(HashMap::new()),
        }))
    }
}

#[derive(Clone, Copy)]
enum Purpose {
    Browse,
    Editor,
}

impl Purpose {
    fn key(self, database: &str) -> String {
        match self {
            Purpose::Browse => format!("browse:{database}"),
            Purpose::Editor => format!("editor:{database}"),
        }
    }
}

/// Longest a catalog query or table page may run before the server stops it.
const BROWSE_TIMEOUT: &str = "30s";

/// A connection plus the NOTICE / WARNING messages the server sent on it.
pub(crate) struct Conn {
    client: Client,
    notices: Arc<std::sync::Mutex<Vec<String>>>,
}

impl Conn {
    fn take_notices(&self) -> Vec<String> {
        std::mem::take(&mut *self.notices.lock().unwrap_or_else(|e| e.into_inner()))
    }
}

impl Deref for Conn {
    type Target = Client;
    fn deref(&self) -> &Client {
        &self.client
    }
}

impl DerefMut for Conn {
    fn deref_mut(&mut self) -> &mut Client {
        &mut self.client
    }
}

/// Browse connections give up on slow catalog queries instead of hanging the sidebar. Ignored where
/// the server refuses (some poolers).
async fn limit_browsing(client: &Client) {
    let _ = client
        .batch_execute(&format!("SET statement_timeout = '{BROWSE_TIMEOUT}'"))
        .await;
}

struct PostgresSession {
    config: ConnectionConfig,
    version: String,
    clients: Mutex<HashMap<String, Arc<Conn>>>,
    /// One per database: SQL runs on the shared editor connection take turns, so a cancel or a
    /// `SET ROLE` never lands on another tab's query.
    editor_locks: Mutex<HashMap<String, Arc<Mutex<()>>>>,
}

impl PostgresSession {
    /// A live client for `database`, reconnecting if the cached one was closed (e.g. server restart).
    async fn client(&self, database: &str, purpose: Purpose) -> CoreResult<Arc<Conn>> {
        let key = purpose.key(database);
        let mut clients = self.clients.lock().await;
        if let Some(client) = clients.get(&key)
            && !client.is_closed()
        {
            return Ok(client.clone());
        }
        let client = open(&self.config, database).await?;
        if matches!(purpose, Purpose::Browse) {
            limit_browsing(&client).await;
        }
        let client = Arc::new(client);
        clients.insert(key, client.clone());
        Ok(client)
    }

    async fn browse(&self, database: &str) -> CoreResult<Arc<Conn>> {
        self.client(database, Purpose::Browse).await
    }

    async fn editor_lock(&self, database: &str) -> Arc<Mutex<()>> {
        self.editor_locks.lock().await.entry(database.to_owned()).or_default().clone()
    }
}

#[async_trait]
impl DriverSession for PostgresSession {
    fn server_version(&self) -> &str {
        &self.version
    }

    async fn databases(&self) -> CoreResult<Vec<DatabaseInfo>> {
        introspect::databases(&*self.browse(&self.config.database).await?).await
    }

    async fn schemas(&self, database: &str) -> CoreResult<Vec<SchemaInfo>> {
        introspect::schemas(&*self.browse(database).await?).await
    }

    async fn tables(&self, database: &str, schema: &str) -> CoreResult<Vec<TableInfo>> {
        introspect::tables(&*self.browse(database).await?, schema).await
    }

    async fn schema_objects(&self, database: &str, schema: &str) -> CoreResult<SchemaObjects> {
        introspect::schema_objects(&*self.browse(database).await?, schema).await
    }

    async fn table_structure(&self, database: &str, schema: &str, table: &str) -> CoreResult<TableStructure> {
        introspect::structure(&*self.browse(database).await?, schema, table).await
    }

    async fn definition(&self, database: &str, schema: &str, kind: ObjectKind, name: &str) -> CoreResult<String> {
        let client = self.browse(database).await?;
        match kind {
            ObjectKind::Table => Ok(ddl::create_table(&introspect::structure(&client, schema, name).await?)),
            ObjectKind::View => introspect::view_definition(&client, schema, name, false).await,
            ObjectKind::MaterializedView => introspect::view_definition(&client, schema, name, true).await,
            ObjectKind::Function => introspect::function_definition(&client, name).await,
            ObjectKind::Sequence => introspect::sequence_definition(&client, schema, name).await,
        }
    }

    async fn schema_graph(&self, database: &str, schema: &str) -> CoreResult<SchemaGraph> {
        introspect::schema_graph(&*self.browse(database).await?, schema).await
    }

    async fn extensions(&self, database: &str) -> CoreResult<Vec<ExtensionInfo>> {
        introspect::extensions(&*self.browse(database).await?).await
    }

    async fn policies(&self, database: &str, schema: &str) -> CoreResult<SchemaPolicies> {
        introspect::policies(&*self.browse(database).await?, schema).await
    }

    async fn rows(&self, database: &str, schema: &str, table: &str, request: RowsRequest) -> CoreResult<RowsPage> {
        rows::rows(&*self.browse(database).await?, schema, table, request).await
    }

    async fn preview_changes(
        &self,
        database: &str,
        schema: &str,
        table: &str,
        changes: &[RowChange],
    ) -> CoreResult<Vec<String>> {
        let statements = edit::build(&*self.browse(database).await?, schema, table, changes).await?;
        Ok(statements.into_iter().map(|s| s.display).collect())
    }

    async fn apply_changes(
        &self,
        database: &str,
        schema: &str,
        table: &str,
        changes: &[RowChange],
    ) -> CoreResult<ApplyResult> {
        let statements = edit::build(&*self.browse(database).await?, schema, table, changes).await?;
        // A transaction needs exclusive use of a connection, so use a fresh one
        let mut client = open(&self.config, database).await?;
        edit::apply(&mut client, &statements).await
    }

    async fn execute(
        &self,
        database: &str,
        sql: &str,
        max_rows: u32,
        cancel: CancellationToken,
        role: Option<&str>,
    ) -> CoreResult<ExecuteResult> {
        let lock = self.editor_lock(database).await;
        let _turn = lock.lock().await;
        let client = self.client(database, Purpose::Editor).await?;
        let tls = cancel_tls(&self.config)?;
        client.take_notices();

        if let Some(role) = role {
            let set = execute::execute(
                &client,
                &format!("SET ROLE {}", sql::ident(role)),
                0,
                CancellationToken::new(),
                None,
            )
            .await?;
            if set.error.is_some() {
                return Ok(set);
            }
        }
        let mut result = execute::execute(&client, sql, max_rows, cancel, tls).await;
        if role.is_some() {
            // The editor keeps its connection, so the role must go back even after a failure. In an
            // aborted transaction RESET is refused until it's rolled back, which is all it can do.
            if client.batch_execute("RESET ROLE").await.is_err() {
                let _ = client.batch_execute("ROLLBACK; RESET ROLE").await;
            }
        }
        if let Ok(result) = &mut result {
            result.notices = client.take_notices();
        }
        result
    }

    async fn explain(&self, database: &str, sql: &str, analyze: bool) -> CoreResult<ExplainResult> {
        if analyze {
            // Runs inside BEGIN … ROLLBACK, which must not touch the editor's own transaction
            let client = open(&self.config, database).await?;
            execute::explain(&client, sql, true).await
        } else {
            execute::explain(&*self.client(database, Purpose::Editor).await?, sql, false).await
        }
    }
}

/// TLS for a cancel request, made the same way as the connection it cancels.
fn cancel_tls(config: &ConnectionConfig) -> CoreResult<Option<MakeTlsConnector>> {
    Ok(match config.ssl_mode {
        SslMode::Disable => None,
        SslMode::Prefer | SslMode::Require => Some(MakeTlsConnector::new(unverified_tls()?)),
        SslMode::VerifyFull => Some(MakeTlsConnector::new(verified_tls(config.ca_cert.as_deref())?)),
    })
}

async fn open(config: &ConnectionConfig, database: &str) -> CoreResult<Conn> {
    use tokio_postgres::config::SslMode as PgSslMode;

    let mut pg = tokio_postgres::Config::new();
    pg.host(&config.host)
        .port(config.port)
        .user(&config.user)
        .password(&config.password)
        .dbname(database)
        .application_name(APPLICATION_NAME)
        .connect_timeout(CONNECT_TIMEOUT);

    // tokio-postgres negotiates like libpq: with `Prefer` it only goes unencrypted when the server
    // says it doesn't support TLS — a failed login is never retried in plain text.
    let tls = match config.ssl_mode {
        SslMode::Disable => {
            pg.ssl_mode(PgSslMode::Disable);
            return finish(config, pg.connect(NoTls)).await;
        }
        SslMode::Prefer => {
            pg.ssl_mode(PgSslMode::Prefer);
            unverified_tls()?
        }
        // libpq's `require`: encrypted, certificate not checked
        SslMode::Require => {
            pg.ssl_mode(PgSslMode::Require);
            unverified_tls()?
        }
        SslMode::VerifyFull => {
            pg.ssl_mode(PgSslMode::Require);
            verified_tls(config.ca_cert.as_deref())?
        }
    };
    finish(config, pg.connect(MakeTlsConnector::new(tls))).await
}

/// Waits for the connection (with a hard timeout) and drives it in the background, keeping the
/// NOTICE / WARNING messages it receives.
async fn finish<S, T>(
    config: &ConnectionConfig,
    connecting: impl std::future::Future<
        Output = Result<(Client, tokio_postgres::Connection<S, T>), tokio_postgres::Error>,
    >,
) -> CoreResult<Conn>
where
    S: tokio::io::AsyncRead + tokio::io::AsyncWrite + Unpin + Send + 'static,
    T: tokio::io::AsyncRead + tokio::io::AsyncWrite + Unpin + Send + 'static,
{
    let (client, connection) = tokio::time::timeout(CONNECT_TIMEOUT + Duration::from_secs(2), connecting)
        .await
        .map_err(|_| CoreError::ConnectionFailed(format!("{}:{} did not respond", config.host, config.port)))?
        .map_err(map_error)?;
    let notices = Arc::new(std::sync::Mutex::new(Vec::new()));
    let sink = notices.clone();
    let mut connection = connection;
    tokio::spawn(async move {
        use futures_util::StreamExt;
        let mut messages = futures_util::stream::poll_fn(move |cx| connection.poll_message(cx));
        while let Some(Ok(message)) = messages.next().await {
            if let tokio_postgres::AsyncMessage::Notice(notice) = message {
                let mut list = sink.lock().unwrap_or_else(|e| e.into_inner());
                // Keep the most recent ones if a loop raises thousands
                if list.len() >= 500 {
                    list.remove(0);
                }
                list.push(format!("{}: {}", notice.severity(), notice.message()));
            }
        }
    });
    Ok(Conn { client, notices })
}

fn unverified_tls() -> CoreResult<TlsConnector> {
    TlsConnector::builder()
        .danger_accept_invalid_certs(true)
        .danger_accept_invalid_hostnames(true)
        .build()
        .map_err(|e| CoreError::ConnectionFailed(format!("TLS setup failed: {e}")))
}

/// Checks the certificate chain and host name, trusting `ca_cert` (a PEM file) as well.
fn verified_tls(ca_cert: Option<&str>) -> CoreResult<TlsConnector> {
    let mut builder = TlsConnector::builder();
    if let Some(path) = ca_cert.filter(|p| !p.trim().is_empty()) {
        let pem = std::fs::read(path)
            .map_err(|e| CoreError::InvalidInput(format!("couldn't read the CA certificate {path}: {e}")))?;
        // Provider bundles (e.g. AWS's global-bundle.pem) hold many certificates
        let certs = native_tls::Certificate::stack_from_pem(&pem)
            .map_err(|e| CoreError::InvalidInput(format!("{path} is not a PEM certificate: {e}")))?;
        if certs.is_empty() {
            return Err(CoreError::InvalidInput(format!("{path} contains no certificates")));
        }
        for cert in certs {
            builder.add_root_certificate(cert);
        }
    }
    builder
        .build()
        .map_err(|e| CoreError::ConnectionFailed(format!("TLS setup failed: {e}")))
}

async fn server_version(client: &Client) -> CoreResult<String> {
    let row = client.query_one("show server_version", &[]).await.map_err(map_error)?;
    let full: String = row.get(0);
    // e.g. "16.4 (Debian 16.4-1.pgdg120+1)" → "16.4"
    Ok(full.split_whitespace().next().unwrap_or(&full).to_owned())
}

/// Turns driver errors into the app's error codes, with the server's own message where there is one.
pub(crate) fn map_error(error: tokio_postgres::Error) -> CoreError {
    if let Some(db) = error.as_db_error() {
        let code = db.code();
        if *code == SqlState::INVALID_PASSWORD || *code == SqlState::INVALID_AUTHORIZATION_SPECIFICATION {
            return CoreError::AuthFailed(db.message().to_owned());
        }
        if *code == SqlState::INVALID_CATALOG_NAME {
            return CoreError::NotFound(db.message().to_owned());
        }
        let mut message = db.message().to_owned();
        if let Some(detail) = db.detail() {
            message.push_str(&format!(" ({detail})"));
        }
        if let Some(hint) = db.hint() {
            message.push_str(&format!(" Hint: {hint}"));
        }
        return CoreError::QueryFailed(message);
    }
    // No server response: refused, unreachable, closed, timed out
    CoreError::ConnectionFailed(error.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

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
            ssl_mode: Default::default(),
            ca_cert: None,
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
            ssl_mode: Default::default(),
            ca_cert: None,
        };
        assert!(!format!("{config:?}").contains("super-secret"));
    }
}
