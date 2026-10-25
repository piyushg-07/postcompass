//! Server passwords in the OS keychain: Windows Credential Manager, macOS Keychain, Linux Secret Service.

use pc_core::{CoreError, CoreResult};

const SERVICE: &str = "com.postcompass.desktop";

fn entry(server_id: &str) -> CoreResult<keyring::Entry> {
    keyring::Entry::new(SERVICE, &format!("server:{server_id}")).map_err(secrets_error)
}

fn remote_entry(remote_id: &str) -> CoreResult<keyring::Entry> {
    keyring::Entry::new(SERVICE, &format!("remote:{remote_id}")).map_err(secrets_error)
}

pub fn set_server_password(server_id: &str, password: &str) -> CoreResult<()> {
    entry(server_id)?
        .set_password(password)
        .map_err(secrets_error)
}

pub fn server_password(server_id: &str) -> CoreResult<String> {
    entry(server_id)?.get_password().map_err(|e| match e {
        keyring::Error::NoEntry => CoreError::NotFound("no saved password for this server".into()),
        other => secrets_error(other),
    })
}

pub fn delete_server_password(server_id: &str) -> CoreResult<()> {
    match entry(server_id)?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(secrets_error(e)),
    }
}

// Remote connections

pub fn set_remote_password(remote_id: &str, password: &str) -> CoreResult<()> {
    remote_entry(remote_id)?
        .set_password(password)
        .map_err(secrets_error)
}

pub fn remote_password(remote_id: &str) -> CoreResult<String> {
    remote_entry(remote_id)?
        .get_password()
        .map_err(|e| match e {
            keyring::Error::NoEntry => {
                CoreError::NotFound("no saved password for this connection".into())
            }
            other => secrets_error(other),
        })
}

pub fn delete_remote_password(remote_id: &str) -> CoreResult<()> {
    match remote_entry(remote_id)?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(secrets_error(e)),
    }
}

/// Runs a keychain call off the async runtime: Secret Service (Linux) and the macOS Keychain can
/// block for as long as an unlock prompt is open.
pub async fn blocking<T: Send + 'static>(
    call: impl FnOnce() -> CoreResult<T> + Send + 'static,
) -> CoreResult<T> {
    tokio::task::spawn_blocking(call)
        .await
        .map_err(|e| CoreError::Secrets(format!("keychain access failed: {e}")))?
}

fn secrets_error(e: keyring::Error) -> CoreError {
    CoreError::Secrets(e.to_string())
}
