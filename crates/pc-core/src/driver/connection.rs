//! Where and how to connect.

use serde::{Deserialize, Serialize};
use specta::Type;

/// SSL/TLS mode for a connection (maps to PostgreSQL libpq sslmode values).
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "snake_case")]
pub enum SslMode {
    /// Never use TLS.
    Disable,
    /// Try TLS; fall back to plain if the server does not support it.
    #[default]
    Prefer,
    /// Require TLS; reject if not offered.
    Require,
    /// Require TLS and verify the server certificate chain.
    VerifyFull,
}

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
    #[serde(default)]
    pub ssl_mode: SslMode,
    /// PEM file of the provider's CA certificate, trusted on top of the system store
    /// (needed for `VerifyFull` with AWS RDS, Supabase, Azure…).
    #[serde(default)]
    pub ca_cert: Option<String>,
}

impl std::fmt::Debug for ConnectionConfig {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("ConnectionConfig")
            .field("host", &self.host)
            .field("port", &self.port)
            .field("user", &self.user)
            .field("password", &"<redacted>")
            .field("database", &self.database)
            .field("ssl_mode", &self.ssl_mode)
            .field("ca_cert", &self.ca_cert)
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
