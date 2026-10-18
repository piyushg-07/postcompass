//! Driver registry and open sessions. The only place a new database's driver gets wired in.

use std::collections::HashMap;
use std::sync::Arc;

use driver_postgres::PostgresDriver;
use pc_core::driver::{CancellationToken, DatabaseDriver, DriverSession};
use pc_core::{CoreError, CoreResult, DatabaseKind};
use tokio::sync::RwLock;

pub struct Connections {
    drivers: HashMap<DatabaseKind, Arc<dyn DatabaseDriver>>,
    sessions: RwLock<HashMap<String, Arc<dyn DriverSession>>>,
    /// Cancellation tokens of running SQL editor queries, by run id.
    runs: RwLock<HashMap<String, CancellationToken>>,
}

impl Connections {
    pub fn new() -> Self {
        let mut drivers: HashMap<DatabaseKind, Arc<dyn DatabaseDriver>> = HashMap::new();
        drivers.insert(DatabaseKind::Postgres, Arc::new(PostgresDriver));
        // Later: drivers.insert(DatabaseKind::MySql, Arc::new(MySqlDriver));
        Self {
            drivers,
            sessions: RwLock::new(HashMap::new()),
            runs: RwLock::new(HashMap::new()),
        }
    }

    pub fn driver(&self, kind: DatabaseKind) -> CoreResult<Arc<dyn DatabaseDriver>> {
        self.drivers
            .get(&kind)
            .cloned()
            .ok_or_else(|| CoreError::Unsupported(format!("{} is not supported yet", kind.display_name())))
    }

    pub async fn insert(&self, id: String, session: Arc<dyn DriverSession>) {
        self.sessions.write().await.insert(id, session);
    }

    pub async fn get(&self, id: &str) -> CoreResult<Arc<dyn DriverSession>> {
        self.sessions
            .read()
            .await
            .get(id)
            .cloned()
            .ok_or_else(|| CoreError::NotFound("this connection was closed, open it again".into()))
    }

    pub async fn begin_run(&self, run_id: &str) -> CancellationToken {
        let token = CancellationToken::new();
        self.runs.write().await.insert(run_id.to_owned(), token.clone());
        token
    }

    pub async fn end_run(&self, run_id: &str) {
        self.runs.write().await.remove(run_id);
    }

    pub async fn cancel_run(&self, run_id: &str) {
        if let Some(token) = self.runs.read().await.get(run_id) {
            token.cancel();
        }
    }

    /// Drops the session; its connections close once in-flight requests finish.
    pub async fn close(&self, id: &str) {
        self.sessions.write().await.remove(id);
    }
}

/// Session id for a PostCompass-managed server.
pub fn server_connection_id(server_id: &str) -> String {
    format!("server:{server_id}")
}
