//! A live session on one server, keeping connections per database (see the crate docs).

use std::collections::HashMap;
use std::sync::Arc;

use async_trait::async_trait;
use pc_core::CoreResult;
use pc_core::driver::{
    ApplyResult, CancellationToken, ConnectionConfig, DatabaseInfo, DriverSession, ExecuteResult,
    ExplainResult, ExtensionInfo, ObjectKind, RowChange, RowsPage, RowsRequest, SchemaGraph,
    SchemaInfo, SchemaObjects, SchemaPolicies, TableInfo, TableStructure,
};
use postgres_native_tls::MakeTlsConnector;
use tokio::sync::Mutex;

use crate::connect::{Conn, open};
use crate::{ddl, edit, execute, introspect, rows, sql};

/// Longest a catalog query or table page may run before the server stops it.
const BROWSE_TIMEOUT: &str = "30s";

#[derive(Clone, Copy, PartialEq, Eq, Hash)]
pub(crate) enum Purpose {
    Browse,
    Editor,
}

/// One cached connection. Its own lock means connecting to one database (up to the connect
/// timeout) never holds up requests for another.
type Slot = Arc<Mutex<Option<Arc<Conn>>>>;

pub(crate) struct PostgresSession {
    config: ConnectionConfig,
    /// Built once, so the CA file is read once and cancel requests match the connection's TLS.
    tls: Option<MakeTlsConnector>,
    version: String,
    clients: Mutex<HashMap<(Purpose, String), Slot>>,
    /// One per database: SQL runs (and plain EXPLAINs) on the shared editor connection take turns,
    /// so a cancel or a `SET ROLE` never lands on another tab's query.
    editor_locks: Mutex<HashMap<String, Arc<Mutex<()>>>>,
}

/// Browse connections give up on slow catalog queries instead of hanging the sidebar. Ignored where
/// the server refuses (some poolers).
pub(crate) async fn limit_browsing(client: &Conn) {
    let _ = client
        .batch_execute(&format!("SET statement_timeout = '{BROWSE_TIMEOUT}'"))
        .await;
}

impl PostgresSession {
    /// A session whose browse connection to `config.database` is already open.
    pub(crate) fn new(
        config: ConnectionConfig,
        tls: Option<MakeTlsConnector>,
        version: String,
        browse: Conn,
    ) -> Self {
        let mut clients = HashMap::new();
        clients.insert(
            (Purpose::Browse, config.database.clone()),
            Arc::new(Mutex::new(Some(Arc::new(browse)))),
        );
        Self {
            config,
            tls,
            version,
            clients: Mutex::new(clients),
            editor_locks: Mutex::new(HashMap::new()),
        }
    }

    /// A fresh connection to `database`, for work that needs a connection of its own (transactions).
    async fn open(&self, database: &str) -> CoreResult<Conn> {
        open(&self.config, database, self.tls.as_ref()).await
    }

    /// A live client for `database`, reconnecting if the cached one was closed (e.g. server restart).
    async fn client(&self, database: &str, purpose: Purpose) -> CoreResult<Arc<Conn>> {
        let slot = self
            .clients
            .lock()
            .await
            .entry((purpose, database.to_owned()))
            .or_default()
            .clone();
        let mut slot = slot.lock().await;
        if let Some(client) = slot.as_ref()
            && !client.is_closed()
        {
            return Ok(client.clone());
        }
        let client = self.open(database).await?;
        if purpose == Purpose::Browse {
            limit_browsing(&client).await;
        }
        let client = Arc::new(client);
        *slot = Some(client.clone());
        Ok(client)
    }

    async fn browse(&self, database: &str) -> CoreResult<Arc<Conn>> {
        self.client(database, Purpose::Browse).await
    }

    async fn editor_lock(&self, database: &str) -> Arc<Mutex<()>> {
        self.editor_locks
            .lock()
            .await
            .entry(database.to_owned())
            .or_default()
            .clone()
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

    async fn table_structure(
        &self,
        database: &str,
        schema: &str,
        table: &str,
    ) -> CoreResult<TableStructure> {
        introspect::structure(&*self.browse(database).await?, schema, table).await
    }

    async fn definition(
        &self,
        database: &str,
        schema: &str,
        kind: ObjectKind,
        name: &str,
    ) -> CoreResult<String> {
        let client = self.browse(database).await?;
        match kind {
            ObjectKind::Table => Ok(ddl::create_table(
                &introspect::structure(&client, schema, name).await?,
            )),
            ObjectKind::View => introspect::view_definition(&client, schema, name, false).await,
            ObjectKind::MaterializedView => {
                introspect::view_definition(&client, schema, name, true).await
            }
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

    async fn rows(
        &self,
        database: &str,
        schema: &str,
        table: &str,
        request: RowsRequest,
    ) -> CoreResult<RowsPage> {
        rows::rows(&*self.browse(database).await?, schema, table, request).await
    }

    async fn preview_changes(
        &self,
        database: &str,
        schema: &str,
        table: &str,
        changes: &[RowChange],
    ) -> CoreResult<Vec<String>> {
        let statements =
            edit::build(&*self.browse(database).await?, schema, table, changes).await?;
        Ok(statements.into_iter().map(|s| s.display).collect())
    }

    async fn apply_changes(
        &self,
        database: &str,
        schema: &str,
        table: &str,
        changes: &[RowChange],
    ) -> CoreResult<ApplyResult> {
        let statements =
            edit::build(&*self.browse(database).await?, schema, table, changes).await?;
        // A transaction needs exclusive use of a connection, so use a fresh one
        let mut client = self.open(database).await?;
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
        let mut result = execute::execute(&client, sql, max_rows, cancel, self.tls.clone()).await;
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
            let client = self.open(database).await?;
            execute::explain(&client, sql, true).await
        } else {
            // Takes the editor's turn, so it never runs under another tab's `SET ROLE` or queues
            // behind (and gets cancelled with) a query in flight
            let lock = self.editor_lock(database).await;
            let _turn = lock.lock().await;
            execute::explain(&*self.client(database, Purpose::Editor).await?, sql, false).await
        }
    }
}
