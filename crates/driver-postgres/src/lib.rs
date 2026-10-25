//! PostgreSQL implementation of [`DatabaseDriver`] on top of `tokio-postgres`.
//!
//! PostgreSQL connections are bound to one database, so a session keeps connections per database:
//! - a **browse** connection for catalog queries and table pages,
//! - an **editor** connection for the SQL editor, so its session state (`SET`, `BEGIN`, temp tables)
//!   persists between runs and a long query never blocks browsing,
//! - a fresh, short-lived connection for each transaction (row edits, `EXPLAIN ANALYZE`).

mod connect;
mod ddl;
mod edit;
mod execute;
mod introspect;
mod rows;
mod session;
mod sql;

use std::time::Instant;

use async_trait::async_trait;
use pc_core::driver::{ConnectionConfig, DatabaseDriver, DriverSession, TestResult};
use pc_core::{CoreResult, DatabaseKind};

pub(crate) use connect::map_error;
use connect::{open, server_version, tls_for};
use session::{PostgresSession, limit_browsing};

#[derive(Debug, Default, Clone, Copy)]
pub struct PostgresDriver;

#[async_trait]
impl DatabaseDriver for PostgresDriver {
    fn kind(&self) -> DatabaseKind {
        DatabaseKind::Postgres
    }

    async fn test_connection(&self, config: &ConnectionConfig) -> CoreResult<TestResult> {
        let started = Instant::now();
        let tls = tls_for(config)?;
        let client = open(config, &config.database, tls.as_ref()).await?;
        let server_version = server_version(&client).await?;
        Ok(TestResult {
            server_version,
            latency_ms: started.elapsed().as_millis().min(u32::MAX as u128) as u32,
        })
    }

    async fn connect(&self, config: ConnectionConfig) -> CoreResult<Box<dyn DriverSession>> {
        let tls = tls_for(&config)?;
        let client = open(&config, &config.database, tls.as_ref()).await?;
        let version = server_version(&client).await?;
        limit_browsing(&client).await;
        Ok(Box::new(PostgresSession::new(config, tls, version, client)))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn unreachable_server_is_a_connection_error() {
        // Bind then drop to get a port that is almost certainly closed.
        let port = std::net::TcpListener::bind("127.0.0.1:0")
            .unwrap()
            .local_addr()
            .unwrap()
            .port();
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
