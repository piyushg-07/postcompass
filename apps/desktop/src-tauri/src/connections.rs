//! Driver registry and open sessions. The only place a new database's driver gets wired in.

use std::collections::HashMap;
use std::sync::Arc;

use driver_postgres::PostgresDriver;
use pc_core::driver::{DatabaseDriver, DriverSession};
use pc_core::{CoreError, CoreResult, DatabaseKind};
use tokio::sync::RwLock;

pub struct Connections {
    drivers: HashMap<DatabaseKind, Arc<dyn DatabaseDriver>>,
    sessions: RwLock<HashMap<String, Arc<dyn DriverSession>>>,
}

impl Connections {
    pub fn new() -> Self {
        let mut drivers: HashMap<DatabaseKind, Arc<dyn DatabaseDriver>> = HashMap::new();
        drivers.insert(DatabaseKind::Postgres, Arc::new(PostgresDriver));
        // Later: drivers.insert(DatabaseKind::MySql, Arc::new(MySqlDriver));
        Self {
            drivers,
            sessions: RwLock::new(HashMap::new()),
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

    /// Drops the session; its connections close once in-flight requests finish.
    pub async fn close(&self, id: &str) {
        self.sessions.write().await.remove(id);
    }
}

/// Session id for a PostCompass-managed server.
pub fn server_connection_id(server_id: &str) -> String {
    format!("server:{server_id}")
}
