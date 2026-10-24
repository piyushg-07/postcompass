//! The registry of local runtimes. The only place a new database's runtime gets wired in.

use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use pc_core::runtime::{CancellationToken, LocalRuntime};
use pc_core::{CoreError, CoreResult, DatabaseKind};
use runtime_postgres::PostgresRuntime;

pub struct Runtimes {
    runtimes: HashMap<DatabaseKind, Arc<dyn LocalRuntime>>,
    /// Folder holding binaries, downloads and server data for all runtimes.
    root: PathBuf,
    /// Cancellation token of the install in progress, if any. One install at a time.
    active_install: Mutex<Option<CancellationToken>>,
}

impl Runtimes {
    pub fn new(root: PathBuf) -> Self {
        let mut runtimes: HashMap<DatabaseKind, Arc<dyn LocalRuntime>> = HashMap::new();
        runtimes.insert(DatabaseKind::Postgres, Arc::new(PostgresRuntime));
        // Later: runtimes.insert(DatabaseKind::MySql, Arc::new(MySqlRuntime));
        Self {
            runtimes,
            root,
            active_install: Mutex::new(None),
        }
    }

    pub fn get(&self, kind: DatabaseKind) -> CoreResult<Arc<dyn LocalRuntime>> {
        self.runtimes
            .get(&kind)
            .cloned()
            .ok_or_else(|| CoreError::Unsupported(format!("{} cannot be installed locally yet", kind.display_name())))
    }

    pub fn root_for(&self, kind: DatabaseKind) -> PathBuf {
        self.root.join(format!("{kind:?}").to_lowercase())
    }

    /// Registers a new install. Fails if one is already running.
    pub fn begin_install(&self) -> CoreResult<CancellationToken> {
        let mut active = self.active_install.lock().expect("install lock poisoned");
        if active.is_some() {
            return Err(CoreError::InvalidInput("another install is already running".into()));
        }
        let token = CancellationToken::new();
        *active = Some(token.clone());
        Ok(token)
    }

    pub fn end_install(&self) {
        *self.active_install.lock().expect("install lock poisoned") = None;
    }

    pub fn cancel_install(&self) {
        if let Some(token) = self.active_install.lock().expect("install lock poisoned").as_ref() {
            token.cancel();
        }
    }
}
