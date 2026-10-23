//! Backup and restore with PostgreSQL's own tools (`pg_dump`, `pg_restore`, `psql`, `createdb`).
//! Passwords go through `PGPASSWORD`, never the command line.

use std::path::{Path, PathBuf};
use std::time::Instant;

use pc_core::runtime::{
    BackupContent, BackupFormat, BackupRequest, BackupResult, CancellationToken, RestoreRequest, RestoreResult,
    ToolConnection,
};
use pc_core::{CoreError, CoreResult};
use tokio::process::Command;

use crate::platform::exe;
use crate::process;

/// Custom-format archives start with this magic string.
const CUSTOM_MAGIC: &[u8] = b"PGDMP";

fn tool(bin_dir: &Path, name: &str) -> CoreResult<PathBuf> {
    let path = bin_dir.join(exe(name));
    if path.is_file() {
        Ok(path)
    } else {
        Err(CoreError::NotFound(format!("{name} was not found in {}", bin_dir.display())))
    }
}

fn command(bin_dir: &Path, name: &str, conn: &ToolConnection) -> CoreResult<Command> {
    let mut cmd = process::command(tool(bin_dir, name)?);
    cmd.args(["-h", &conn.host, "-p", &conn.port.to_string(), "-U", &conn.user])
        .env("PGPASSWORD", &conn.password)
        .env("PGCONNECT_TIMEOUT", "10");
    Ok(cmd)
}

fn elapsed_ms(started: Instant) -> u32 {
    started.elapsed().as_millis().min(u32::MAX as u128) as u32
}

pub async fn backup(
    bin_dir: &Path,
    conn: &ToolConnection,
    request: &BackupRequest,
    log: &(dyn Fn(String) + Send + Sync),
    cancel: &CancellationToken,
) -> CoreResult<BackupResult> {
    let started = Instant::now();
    let target = PathBuf::from(&request.path);
    // Write to a temporary file so a failed or cancelled backup never leaves a half-written file
    let partial = target.with_extension("partial");

    let mut cmd = command(bin_dir, "pg_dump", conn)?;
    cmd.args(["--verbose", "--no-password", "--dbname", &request.database])
        .arg("--file")
        .arg(&partial);
    cmd.arg(match request.format {
        BackupFormat::Custom => "--format=custom",
        BackupFormat::Plain => "--format=plain",
    });
    match request.content {
        BackupContent::All => {}
        BackupContent::SchemaOnly => {
            cmd.arg("--schema-only");
        }
        BackupContent::DataOnly => {
            cmd.arg("--data-only");
        }
    }
    if request.no_owner {
        cmd.args(["--no-owner", "--no-privileges"]);
    }

    log(format!("Backing up {} to {}", request.database, target.display()));
    let result = process::run_streaming(cmd, log, cancel).await;
    if let Err(e) = result {
        let _ = tokio::fs::remove_file(&partial).await;
        return Err(e);
    }
    tokio::fs::rename(&partial, &target)
        .await
        .map_err(|e| CoreError::io("could not save the backup file", e))?;
    let size = tokio::fs::metadata(&target).await.map(|m| m.len()).unwrap_or(0);
    log(format!("Backup complete: {:.1} MB", size as f64 / 1_048_576.0));

    Ok(BackupResult {
        path: target.to_string_lossy().into_owned(),
        size_bytes: size as f64,
        duration_ms: elapsed_ms(started),
    })
}

/// Reads the first bytes of a backup to tell custom archives from plain SQL.
pub async fn detect_format(path: &Path) -> CoreResult<BackupFormat> {
    use tokio::io::AsyncReadExt;
    let mut file = tokio::fs::File::open(path)
        .await
        .map_err(|e| CoreError::io("could not open the backup file", e))?;
    let mut head = [0u8; 5];
    let read = file.read(&mut head).await.map_err(|e| CoreError::io("could not read the backup file", e))?;
    Ok(if read == CUSTOM_MAGIC.len() && head == CUSTOM_MAGIC {
        BackupFormat::Custom
    } else {
        BackupFormat::Plain
    })
}

pub async fn restore(
    bin_dir: &Path,
    conn: &ToolConnection,
    request: &RestoreRequest,
    log: &(dyn Fn(String) + Send + Sync),
    cancel: &CancellationToken,
) -> CoreResult<RestoreResult> {
    let started = Instant::now();
    let path = PathBuf::from(&request.path);
    let format = detect_format(&path).await?;
    log(format!(
        "Restoring {} ({}) into {}",
        path.display(),
        match format {
            BackupFormat::Custom => "compressed archive",
            BackupFormat::Plain => "SQL script",
        },
        request.database
    ));

    if request.create_database {
        // createdb falls back to template1 when the "postgres" database doesn't exist
        let mut create = command(bin_dir, "createdb", conn)?;
        create.args(["--no-password", "--echo", &request.database]);
        process::run_streaming(create, log, cancel).await?;
    }

    let cmd = match format {
        BackupFormat::Custom => {
            let mut cmd = command(bin_dir, "pg_restore", conn)?;
            cmd.args([
                "--verbose",
                "--no-password",
                "--exit-on-error",
                // All or nothing: a failed restore leaves the database as it was
                "--single-transaction",
                "--dbname",
                &request.database,
            ]);
            if request.clean {
                cmd.args(["--clean", "--if-exists"]);
            }
            if request.no_owner {
                cmd.args(["--no-owner", "--no-privileges"]);
            }
            cmd.arg(&path);
            cmd
        }
        BackupFormat::Plain => {
            let mut cmd = command(bin_dir, "psql", conn)?;
            cmd.args([
                "--no-password",
                "--echo-errors",
                "--set",
                "ON_ERROR_STOP=1",
                "--single-transaction",
                "--quiet",
                "--dbname",
                &request.database,
                "--file",
            ])
            .arg(&path);
            cmd
        }
    };
    process::run_streaming(cmd, log, cancel).await?;
    log("Restore complete".into());

    Ok(RestoreResult {
        format,
        duration_ms: elapsed_ms(started),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn detects_backup_formats() {
        let dir = std::env::temp_dir().join(format!("postcompass-format-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let custom = dir.join("a.dump");
        let plain = dir.join("b.sql");
        std::fs::write(&custom, b"PGDMP\x01\x0e\x00").unwrap();
        std::fs::write(&plain, b"-- PostgreSQL database dump").unwrap();
        assert_eq!(detect_format(&custom).await.unwrap(), BackupFormat::Custom);
        assert_eq!(detect_format(&plain).await.unwrap(), BackupFormat::Plain);
        let _ = std::fs::remove_dir_all(dir);
    }
}
