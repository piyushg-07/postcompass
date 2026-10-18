//! The `LocalRuntime` interface: detect, install and manage a database server on this machine.
//! One implementation per database (`runtime-postgres`, later `runtime-mysql` …).

use std::path::PathBuf;
use std::sync::Arc;

use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use specta::Type;
pub use tokio_util::sync::CancellationToken;

use crate::{CoreResult, DatabaseKind};

/* ── Detection ────────────────────────────────────────────────────────── */

/// Where a detected installation came from.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "snake_case")]
pub enum InstallSource {
    /// Installed on the system (official installer, package manager, PATH).
    System,
    Homebrew,
    PostgresApp,
    Docker,
    /// Installed and managed by PostCompass.
    Managed,
}

/// An installation found on disk (binaries), possibly registered as an OS service.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct DetectedInstall {
    pub version: Option<String>,
    pub bin_dir: String,
    pub data_dir: Option<String>,
    pub source: InstallSource,
    pub service_name: Option<String>,
    /// `Some(true)` when an OS service for this install is running; `None` when unknown.
    pub service_running: Option<bool>,
}

/// A server accepting connections on this machine, found by probing local ports.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ListeningServer {
    pub host: String,
    pub port: u16,
    pub source: Option<InstallSource>,
    /// e.g. the Docker container name.
    pub label: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct DetectionReport {
    pub installs: Vec<DetectedInstall>,
    pub servers: Vec<ListeningServer>,
    /// Checks that could not run (e.g. Docker not installed). Informational only.
    pub notes: Vec<String>,
    pub duration_ms: u32,
}

/* ── Versions & installs ──────────────────────────────────────────────── */

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeVersion {
    /// Full version, e.g. `18.6.0`.
    pub version: String,
    /// Major version, e.g. `18`.
    pub major: u32,
    pub recommended: bool,
    /// Download size in MB for this platform, when known.
    pub download_mb: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct InstallRequest {
    pub version: String,
    pub port: u16,
    /// Display name, e.g. "Local PostgreSQL 18".
    pub name: String,
    /// Superuser password. Only kept in memory and in the OS keychain.
    pub password: String,
    /// Custom data directory; defaults to the app data folder.
    pub data_dir: Option<String>,
    pub auto_start: bool,
}

/// A server installed and managed by PostCompass. Persisted in the app state (never contains secrets).
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ManagedServer {
    pub id: String,
    pub kind: DatabaseKind,
    pub name: String,
    pub version: String,
    pub host: String,
    pub port: u16,
    pub superuser: String,
    pub bin_dir: String,
    pub data_dir: String,
    pub log_file: String,
    pub auto_start: bool,
    /// Unix time in milliseconds.
    pub created_at: f64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "snake_case")]
pub enum ServerStatus {
    Running,
    Stopped,
    /// Files are missing or the status check failed.
    Error,
}

/* ── Install progress ─────────────────────────────────────────────────── */

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "snake_case")]
pub enum InstallStep {
    CheckSystem,
    Download,
    Verify,
    Extract,
    Initialize,
    Start,
    Connect,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "snake_case")]
pub enum StepState {
    Active,
    Done,
    Skipped,
    Failed,
}

/// Streamed to the UI while an install runs.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum InstallEvent {
    Step {
        step: InstallStep,
        state: StepState,
        detail: Option<String>,
    },
    Download {
        downloaded: f64,
        total: Option<f64>,
    },
    Log {
        line: String,
    },
}

/// Receives install events. The desktop app forwards them to the UI over a Tauri channel.
pub type ProgressSink = Arc<dyn Fn(InstallEvent) + Send + Sync>;

pub struct InstallContext {
    pub progress: ProgressSink,
    pub cancel: CancellationToken,
    /// Root folder this runtime may write to (binaries, downloads, server data).
    pub root_dir: PathBuf,
}

impl InstallContext {
    pub fn emit(&self, event: InstallEvent) {
        (self.progress)(event);
    }

    pub fn step(&self, step: InstallStep, state: StepState, detail: Option<String>) {
        self.emit(InstallEvent::Step { step, state, detail });
    }

    pub fn log(&self, line: impl Into<String>) {
        self.emit(InstallEvent::Log { line: line.into() });
    }
}

/* ── Backup & restore ─────────────────────────────────────────────────── */

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "snake_case")]
pub enum BackupFormat {
    /// Compressed archive (`pg_dump -Fc`); restores with `pg_restore`, can restore selectively.
    Custom,
    /// Plain SQL script (`pg_dump -Fp`); readable, restores with `psql`.
    Plain,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "snake_case")]
pub enum BackupContent {
    All,
    SchemaOnly,
    DataOnly,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct BackupRequest {
    pub database: String,
    /// File to write, chosen by the user.
    pub path: String,
    pub format: BackupFormat,
    pub content: BackupContent,
    /// Leave out ownership and privileges, so the backup restores cleanly under another user.
    pub no_owner: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct BackupResult {
    pub path: String,
    pub size_bytes: f64,
    pub duration_ms: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct RestoreRequest {
    /// Target database. Created first when `create_database` is set.
    pub database: String,
    pub path: String,
    pub create_database: bool,
    /// Drop existing objects before recreating them (custom-format backups only).
    pub clean: bool,
    pub no_owner: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct RestoreResult {
    pub format: BackupFormat,
    pub duration_ms: u32,
}

/// How command-line tools reach the server.
#[derive(Clone)]
pub struct ToolConnection {
    pub host: String,
    pub port: u16,
    pub user: String,
    pub password: String,
}

/* ── The interface ────────────────────────────────────────────────────── */

#[async_trait]
pub trait LocalRuntime: Send + Sync {
    fn kind(&self) -> DatabaseKind;

    /// Versions this runtime can install on the current platform, newest first.
    fn available_versions(&self) -> Vec<RuntimeVersion>;

    /// Read-only scan for existing installs and running servers. Never needs admin rights.
    /// `managed_root` is where PostCompass keeps its own installs, so they can be labelled.
    async fn detect(&self, managed_root: Option<PathBuf>) -> DetectionReport;

    /// Installs, initializes and starts a new server. Cleans up after itself on failure or cancel.
    async fn install(&self, request: InstallRequest, ctx: InstallContext) -> CoreResult<ManagedServer>;

    async fn start(&self, server: &ManagedServer) -> CoreResult<()>;
    async fn stop(&self, server: &ManagedServer) -> CoreResult<()>;
    async fn status(&self, server: &ManagedServer) -> ServerStatus;

    /// Stops the server and deletes its data unless `keep_data` is set. Shared binaries are kept.
    async fn uninstall(&self, server: &ManagedServer, keep_data: bool) -> CoreResult<()>;
}
