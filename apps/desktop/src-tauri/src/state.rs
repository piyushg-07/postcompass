//! App state persisted as JSON in the app config folder: onboarding profile, managed servers, settings.
//! Never contains secrets; passwords live in the OS keychain (see `secrets.rs`).

use std::path::PathBuf;
use std::sync::RwLock;

use pc_core::runtime::ManagedServer;
use pc_core::{CoreError, CoreResult};
use serde::{Deserialize, Serialize};
use specta::Type;

const STATE_VERSION: u32 = 1;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "snake_case")]
pub enum Role {
    Developer,
    Analyst,
    Dba,
    Student,
    Other,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "snake_case")]
pub enum Experience {
    New,
    Some,
    Expert,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "snake_case")]
pub enum UseCase {
    LocalDev,
    Remote,
    Both,
    Learning,
}

/// Answers from onboarding. Present once onboarding is complete.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct Profile {
    pub name: Option<String>,
    pub role: Role,
    pub experience: Experience,
    pub use_case: UseCase,
    /// Anonymous usage stats. Off unless the user opts in.
    pub telemetry: bool,
    pub completed_at: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    /// Stop PostCompass-managed servers when the app quits.
    pub stop_servers_on_quit: bool,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            stop_servers_on_quit: true,
        }
    }
}

/// Everything the UI needs to render; sent whole on load.
#[derive(Debug, Clone, Default, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct AppState {
    pub profile: Option<Profile>,
    pub servers: Vec<ManagedServer>,
    pub settings: Settings,
}

/// On-disk format: the state plus a version number for future migrations.
#[derive(Serialize)]
struct Persisted<'a> {
    version: u32,
    #[serde(flatten)]
    state: &'a AppState,
}

/// Lenient reader for the on-disk format: missing fields (e.g. from an older version) get defaults.
/// Kept separate from `AppState` because `#[serde(default)]` would make the UI types optional.
#[derive(Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
struct Stored {
    profile: Option<Profile>,
    servers: Vec<ManagedServer>,
    settings: StoredSettings,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", default)]
struct StoredSettings {
    stop_servers_on_quit: bool,
}

impl Default for StoredSettings {
    fn default() -> Self {
        Self {
            stop_servers_on_quit: Settings::default().stop_servers_on_quit,
        }
    }
}

impl From<Stored> for AppState {
    fn from(stored: Stored) -> Self {
        Self {
            profile: stored.profile,
            servers: stored.servers,
            settings: Settings {
                stop_servers_on_quit: stored.settings.stop_servers_on_quit,
            },
        }
    }
}

pub struct Store {
    path: PathBuf,
    state: RwLock<AppState>,
}

impl Store {
    /// Loads state from disk. A corrupt file is kept as `state.json.corrupt` and replaced with defaults.
    pub fn load(path: PathBuf) -> Self {
        let state = match std::fs::read_to_string(&path) {
            Ok(text) => serde_json::from_str::<Stored>(&text).map(AppState::from).unwrap_or_else(|e| {
                eprintln!("state file is invalid ({e}), starting fresh");
                let _ = std::fs::rename(&path, path.with_extension("json.corrupt"));
                AppState::default()
            }),
            Err(_) => AppState::default(),
        };
        Self {
            path,
            state: RwLock::new(state),
        }
    }

    pub fn snapshot(&self) -> AppState {
        self.state.read().expect("state lock poisoned").clone()
    }

    /// Applies a change and writes it to disk atomically (temp file + rename).
    pub fn update<T>(&self, change: impl FnOnce(&mut AppState) -> T) -> CoreResult<T> {
        let mut state = self.state.write().expect("state lock poisoned");
        let mut next = state.clone();
        let result = change(&mut next);
        self.write(&next)?;
        *state = next;
        Ok(result)
    }

    pub fn server(&self, id: &str) -> CoreResult<ManagedServer> {
        self.snapshot()
            .servers
            .into_iter()
            .find(|s| s.id == id)
            .ok_or_else(|| CoreError::NotFound(format!("server {id}")))
    }

    fn write(&self, state: &AppState) -> CoreResult<()> {
        if let Some(dir) = self.path.parent() {
            std::fs::create_dir_all(dir).map_err(|e| CoreError::io("could not create the config folder", e))?;
        }
        let persisted = Persisted {
            version: STATE_VERSION,
            state,
        };
        let json = serde_json::to_vec_pretty(&persisted).map_err(|e| CoreError::Internal(e.to_string()))?;
        let tmp = self.path.with_extension("json.tmp");
        std::fs::write(&tmp, json).map_err(|e| CoreError::io("could not save settings", e))?;
        std::fs::rename(&tmp, &self.path).map_err(|e| CoreError::io("could not save settings", e))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_path(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("postcompass-test-{name}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        dir.join("state.json")
    }

    #[test]
    fn missing_file_gives_defaults() {
        let store = Store::load(temp_path("missing"));
        let state = store.snapshot();
        assert!(state.profile.is_none());
        assert!(state.servers.is_empty());
        assert!(state.settings.stop_servers_on_quit);
    }

    #[test]
    fn older_file_without_settings_still_loads() {
        let path = temp_path("older");
        std::fs::create_dir_all(path.parent().unwrap()).unwrap();
        std::fs::write(&path, r#"{ "version": 1, "servers": [] }"#).unwrap();
        let state = Store::load(path).snapshot();
        assert!(state.settings.stop_servers_on_quit);
    }

    #[test]
    fn corrupt_file_is_set_aside() {
        let path = temp_path("corrupt");
        std::fs::create_dir_all(path.parent().unwrap()).unwrap();
        std::fs::write(&path, "{ not json").unwrap();
        let store = Store::load(path.clone());
        assert!(store.snapshot().profile.is_none());
        assert!(path.with_extension("json.corrupt").exists());
    }

    #[test]
    fn updates_round_trip_through_disk() {
        let path = temp_path("roundtrip");
        let store = Store::load(path.clone());
        store
            .update(|s| s.settings.stop_servers_on_quit = false)
            .unwrap();
        let reloaded = Store::load(path);
        assert!(!reloaded.snapshot().settings.stop_servers_on_quit);
    }
}
