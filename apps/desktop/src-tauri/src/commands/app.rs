use pc_core::{CoreError, DatabaseKind};
use serde::Serialize;
use specta::Type;

#[derive(Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct SupportedDatabase {
    pub kind: DatabaseKind,
    pub display_name: String,
    pub default_port: u16,
}

#[derive(Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct AppInfo {
    pub name: String,
    pub version: String,
    pub os: String,
    pub arch: String,
    pub supported_databases: Vec<SupportedDatabase>,
}

/// Basic app and platform info. Also proves the typed UI ↔ Rust bridge works end to end.
#[tauri::command]
#[specta::specta]
pub fn app_info(app: tauri::AppHandle) -> Result<AppInfo, CoreError> {
    let pkg = app.package_info();
    Ok(AppInfo {
        name: pkg.name.clone(),
        version: pkg.version.to_string(),
        os: std::env::consts::OS.to_owned(),
        arch: std::env::consts::ARCH.to_owned(),
        supported_databases: DatabaseKind::ALL
            .iter()
            .map(|&kind| SupportedDatabase {
                kind,
                display_name: kind.display_name().to_owned(),
                default_port: kind.default_port(),
            })
            .collect(),
    })
}

/// Largest file `read_text_file` accepts; the rows are previewed and inserted in one go.
const MAX_IMPORT_BYTES: u64 = 50 * 1024 * 1024;

/// Reads a text file the user picked in an open dialog (CSV imports). Drops a leading UTF-8 BOM,
/// which Excel writes.
#[tauri::command]
#[specta::specta]
pub async fn read_text_file(path: String) -> Result<String, CoreError> {
    let size = tokio::fs::metadata(&path)
        .await
        .map_err(|e| CoreError::io(format!("couldn't read {path}"), e))?
        .len();
    if size > MAX_IMPORT_BYTES {
        return Err(CoreError::InvalidInput(format!(
            "the file is {} MB; files up to {} MB can be imported",
            size / (1024 * 1024),
            MAX_IMPORT_BYTES / (1024 * 1024)
        )));
    }
    let bytes = tokio::fs::read(&path)
        .await
        .map_err(|e| CoreError::io(format!("couldn't read {path}"), e))?;
    let text = String::from_utf8(bytes)
        .map_err(|_| CoreError::InvalidInput("the file isn't UTF-8 text".into()))?;
    Ok(text
        .strip_prefix('\u{feff}')
        .map(str::to_owned)
        .unwrap_or(text))
}

/// Writes text to a file the user picked in a save dialog (data exports).
#[tauri::command]
#[specta::specta]
pub async fn save_text_file(path: String, contents: String) -> Result<(), CoreError> {
    tokio::fs::write(&path, contents)
        .await
        .map_err(|e| CoreError::io(format!("couldn't write {path}"), e))
}
