//! Opening connections: TLS setup, the connect timeout, notice collection and error mapping.

use std::collections::VecDeque;
use std::ops::{Deref, DerefMut};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use native_tls::TlsConnector;
use pc_core::driver::{ConnectionConfig, SslMode};
use pc_core::{CoreError, CoreResult};
use postgres_native_tls::MakeTlsConnector;
use tokio_postgres::error::SqlState;
use tokio_postgres::{Client, NoTls};

const CONNECT_TIMEOUT: Duration = Duration::from_secs(10);
const APPLICATION_NAME: &str = "PostCompass";
/// Most NOTICE / WARNING messages kept per connection; a loop that raises thousands keeps the latest.
const MAX_NOTICES: usize = 500;

/// A connection plus the NOTICE / WARNING messages the server sent on it.
pub(crate) struct Conn {
    client: Client,
    notices: Arc<Mutex<VecDeque<String>>>,
}

impl Conn {
    pub(crate) fn take_notices(&self) -> Vec<String> {
        std::mem::take(&mut *self.notices.lock().unwrap_or_else(|e| e.into_inner())).into()
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

/// The TLS connector for `config`, or `None` for `SslMode::Disable`. Built once per session and
/// reused for every connection and cancel request, so the CA file is read only once.
pub(crate) fn tls_for(config: &ConnectionConfig) -> CoreResult<Option<MakeTlsConnector>> {
    Ok(match config.ssl_mode {
        SslMode::Disable => None,
        // libpq's `prefer` / `require`: encrypted, certificate not checked
        SslMode::Prefer | SslMode::Require => Some(MakeTlsConnector::new(unverified_tls()?)),
        SslMode::VerifyFull => Some(MakeTlsConnector::new(verified_tls(
            config.ca_cert.as_deref(),
        )?)),
    })
}

/// Connects to `database` on the server described by `config`, using the connector from [`tls_for`].
pub(crate) async fn open(
    config: &ConnectionConfig,
    database: &str,
    tls: Option<&MakeTlsConnector>,
) -> CoreResult<Conn> {
    use tokio_postgres::config::SslMode as PgSslMode;

    let mut pg = tokio_postgres::Config::new();
    pg.host(&config.host)
        .port(config.port)
        .user(&config.user)
        .password(&config.password)
        .dbname(database)
        .application_name(APPLICATION_NAME)
        .connect_timeout(CONNECT_TIMEOUT)
        // tokio-postgres negotiates like libpq: with `Prefer` it only goes unencrypted when the server
        // says it doesn't support TLS — a failed login is never retried in plain text.
        .ssl_mode(match config.ssl_mode {
            SslMode::Disable => PgSslMode::Disable,
            SslMode::Prefer => PgSslMode::Prefer,
            // Verification is the connector's job; the protocol just has to insist on TLS
            SslMode::Require | SslMode::VerifyFull => PgSslMode::Require,
        });

    match tls {
        Some(tls) if config.ssl_mode != SslMode::Disable => {
            finish(config, pg.connect(tls.clone())).await
        }
        _ => finish(config, pg.connect(NoTls)).await,
    }
}

/// Waits for the connection (with a hard timeout) and drives it in the background, keeping the
/// NOTICE / WARNING messages it receives.
async fn finish<S, T>(
    config: &ConnectionConfig,
    connecting: impl Future<
        Output = Result<(Client, tokio_postgres::Connection<S, T>), tokio_postgres::Error>,
    >,
) -> CoreResult<Conn>
where
    S: tokio::io::AsyncRead + tokio::io::AsyncWrite + Unpin + Send + 'static,
    T: tokio::io::AsyncRead + tokio::io::AsyncWrite + Unpin + Send + 'static,
{
    let (client, mut connection) =
        tokio::time::timeout(CONNECT_TIMEOUT + Duration::from_secs(2), connecting)
            .await
            .map_err(|_| {
                CoreError::ConnectionFailed(format!(
                    "{}:{} did not respond",
                    config.host, config.port
                ))
            })?
            .map_err(map_error)?;
    let notices = Arc::new(Mutex::new(VecDeque::new()));
    let sink = notices.clone();
    tokio::spawn(async move {
        use futures_util::StreamExt;
        let mut messages = futures_util::stream::poll_fn(move |cx| connection.poll_message(cx));
        while let Some(Ok(message)) = messages.next().await {
            if let tokio_postgres::AsyncMessage::Notice(notice) = message {
                let mut list = sink.lock().unwrap_or_else(|e| e.into_inner());
                if list.len() >= MAX_NOTICES {
                    list.pop_front();
                }
                list.push_back(format!("{}: {}", notice.severity(), notice.message()));
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
    if let Some(path) = ca_cert.map(str::trim).filter(|p| !p.is_empty()) {
        let pem = std::fs::read(path).map_err(|e| {
            CoreError::InvalidInput(format!("couldn't read the CA certificate {path}: {e}"))
        })?;
        // Provider bundles (e.g. AWS's global-bundle.pem) hold many certificates
        let certs = native_tls::Certificate::stack_from_pem(&pem).map_err(|e| {
            CoreError::InvalidInput(format!("{path} is not a PEM certificate: {e}"))
        })?;
        if certs.is_empty() {
            return Err(CoreError::InvalidInput(format!(
                "{path} contains no certificates"
            )));
        }
        for cert in certs {
            builder.add_root_certificate(cert);
        }
    }
    builder
        .build()
        .map_err(|e| CoreError::ConnectionFailed(format!("TLS setup failed: {e}")))
}

/// The server's version number, e.g. `16.4`.
pub(crate) async fn server_version(client: &Client) -> CoreResult<String> {
    let row = client
        .query_one("show server_version", &[])
        .await
        .map_err(map_error)?;
    let full: String = row.try_get(0).map_err(decode_error)?;
    // e.g. "16.4 (Debian 16.4-1.pgdg120+1)" → "16.4"
    Ok(full.split_whitespace().next().unwrap_or(&full).to_owned())
}

/// A catalog value that couldn't be read as expected (e.g. NULL where the app expects a value).
pub(crate) fn decode_error(error: tokio_postgres::Error) -> CoreError {
    CoreError::Internal(format!("unexpected value from the server: {error}"))
}

/// Turns driver errors into the app's error codes, with the server's own message where there is one.
pub(crate) fn map_error(error: tokio_postgres::Error) -> CoreError {
    if let Some(db) = error.as_db_error() {
        let code = db.code();
        if *code == SqlState::INVALID_PASSWORD
            || *code == SqlState::INVALID_AUTHORIZATION_SPECIFICATION
        {
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
    if error.is_closed() {
        return CoreError::ConnectionFailed("the connection to the server was closed".into());
    }
    // No server response: refused, unreachable, timed out
    CoreError::ConnectionFailed(error.to_string())
}
