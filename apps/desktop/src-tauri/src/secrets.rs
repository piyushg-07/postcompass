//! Server passwords in the OS keychain: Windows Credential Manager, macOS Keychain, Linux Secret Service.

use pc_core::{CoreError, CoreResult};

const SERVICE: &str = "com.postcompass.desktop";

fn entry(server_id: &str) -> CoreResult<keyring::Entry> {
    keyring::Entry::new(SERVICE, &format!("server:{server_id}")).map_err(secrets_error)
}

pub fn set_server_password(server_id: &str, password: &str) -> CoreResult<()> {
    entry(server_id)?.set_password(password).map_err(secrets_error)
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

fn secrets_error(e: keyring::Error) -> CoreError {
    CoreError::Secrets(e.to_string())
}
