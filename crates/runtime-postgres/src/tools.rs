//! Backup, restore and copy with PostgreSQL's own tools (`pg_dump`, `pg_restore`, `psql`, `createdb`, `dropdb`).
//! Passwords go through `PGPASSWORD`, never the command line.

use std::path::{Path, PathBuf};
use std::time::Instant;

use pc_core::runtime::{
    BackupContent, BackupFormat, BackupRequest, BackupResult, CancellationToken, CopyRequest,
    CopyResult, RestoreRequest, RestoreResult, ToolConnection,
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
        Err(CoreError::NotFound(format!(
            "{name} was not found in {}",
            bin_dir.display()
        )))
    }
}

fn command(bin_dir: &Path, name: &str, conn: &ToolConnection) -> CoreResult<Command> {
    let mut cmd = process::command(tool(bin_dir, name)?);
    cmd.args([
        "-h",
        &conn.host,
        "-p",
        &conn.port.to_string(),
        "-U",
        &conn.user,
    ])
    .env("PGPASSWORD", &conn.password)
    .env("PGCONNECT_TIMEOUT", "10");
    // Set or cleared explicitly, so a PGSSLMODE in the user's environment never applies by accident
    match conn.ssl_mode {
        Some(mode) => cmd.env("PGSSLMODE", mode),
        None => cmd.env_remove("PGSSLMODE"),
    };
    match &conn.ssl_root_cert {
        Some(cert) => cmd.env("PGSSLROOTCERT", cert),
        None => cmd.env_remove("PGSSLROOTCERT"),
    };
    Ok(cmd)
}

/// `--dbname` takes a connection string when the value contains `=` or starts with a URI prefix, so
/// a database named e.g. `a=b` would be misread. A quoted `dbname='…'` keyword is always taken literally.
fn dbname_arg(database: &str) -> String {
    format!(
        "dbname='{}'",
        database.replace('\\', "\\\\").replace('\'', "\\'")
    )
}

/// `backup.dump` → `backup.dump.partial`, next to the target. Appending (instead of replacing the
/// extension) keeps two backups of different formats with the same stem from sharing a temp file.
fn partial_path(target: &Path) -> PathBuf {
    let mut name = target
        .file_name()
        .map(|n| n.to_os_string())
        .unwrap_or_default();
    name.push(".partial");
    target.with_file_name(name)
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
    let partial = partial_path(&target);

    let mut cmd = command(bin_dir, "pg_dump", conn)?;
    cmd.args([
        "--verbose",
        "--no-password",
        "--dbname",
        &dbname_arg(&request.database),
    ])
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

    log(format!(
        "Backing up {} to {}",
        request.database,
        target.display()
    ));
    let result = process::run_streaming(cmd, log, cancel).await;
    if let Err(e) = result {
        let _ = tokio::fs::remove_file(&partial).await;
        return Err(e);
    }
    tokio::fs::rename(&partial, &target)
        .await
        .map_err(|e| CoreError::io("could not save the backup file", e))?;
    let size = tokio::fs::metadata(&target)
        .await
        .map(|m| m.len())
        .unwrap_or(0);
    log(format!(
        "Backup complete: {:.1} MB",
        size as f64 / 1_048_576.0
    ));

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
    let read = file
        .read(&mut head)
        .await
        .map_err(|e| CoreError::io("could not read the backup file", e))?;
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
        // `--` so a name starting with `-` isn't read as an option
        create.args(["--no-password", "--echo", "--", &request.database]);
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
                &dbname_arg(&request.database),
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
                &dbname_arg(&request.database),
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

/// `532 KB`, `12.4 MB`: small schema-only dumps would otherwise all read "0.0 MB".
fn human_size(bytes: u64) -> String {
    if bytes < 1_048_576 {
        format!("{} KB", bytes.div_ceil(1024))
    } else {
        format!("{:.1} MB", bytes as f64 / 1_048_576.0)
    }
}

/// What `pg_restore` prints last when it carried on past errors, followed by how many.
const ERRORS_IGNORED: &str = "errors ignored on restore:";

fn skipped_count(line: &str) -> Option<u32> {
    let at = line.find(ERRORS_IGNORED)? + ERRORS_IGNORED.len();
    line[at..].trim().parse().ok()
}

/// Copies `source_db` from `source` (usually a cloud server) into a new database on `target`, using
/// the target's own tools: dump to `temp_dir`, create the database, restore. The restore carries on
/// past objects the target can't create (an extension it doesn't have, a cloud-only role…) and
/// reports how many it skipped. On failure or cancel the new database is removed again, and the
/// dump file is always deleted.
#[allow(clippy::too_many_arguments)]
pub async fn copy(
    bin_dir: &Path,
    source: &ToolConnection,
    source_db: &str,
    target: &ToolConnection,
    request: &CopyRequest,
    temp_dir: &Path,
    log: &(dyn Fn(String) + Send + Sync),
    cancel: &CancellationToken,
) -> CoreResult<CopyResult> {
    let started = Instant::now();
    tokio::fs::create_dir_all(temp_dir)
        .await
        .map_err(|e| CoreError::io("could not create a temporary folder", e))?;
    let stamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    let dump = temp_dir.join(format!("copy-{}-{stamp}.dump", std::process::id()));

    let result = copy_via(
        bin_dir, source, source_db, target, request, &dump, log, cancel,
    )
    .await;
    let _ = tokio::fs::remove_file(&dump).await;
    let (size, skipped) = result?;
    Ok(CopyResult {
        database: request.database.clone(),
        size_bytes: size as f64,
        duration_ms: elapsed_ms(started),
        skipped,
    })
}

#[allow(clippy::too_many_arguments)]
async fn copy_via(
    bin_dir: &Path,
    source: &ToolConnection,
    source_db: &str,
    target: &ToolConnection,
    request: &CopyRequest,
    dump: &Path,
    log: &(dyn Fn(String) + Send + Sync),
    cancel: &CancellationToken,
) -> CoreResult<(u64, u32)> {
    let mut cmd = command(bin_dir, "pg_dump", source)?;
    cmd.args([
        "--verbose",
        "--no-password",
        "--format=custom",
        // Cloud roles don't exist locally; everything is owned by the local superuser instead
        "--no-owner",
        "--no-privileges",
        "--dbname",
        &dbname_arg(source_db),
    ])
    .arg("--file")
    .arg(dump);
    if request.schema_only {
        cmd.arg("--schema-only");
    }
    log(format!("Reading {source_db} from {}", source.host));
    process::run_streaming(cmd, log, cancel).await?;
    let size = tokio::fs::metadata(dump)
        .await
        .map(|m| m.len())
        .unwrap_or(0);
    log(format!("Read {}", human_size(size)));

    let mut create = command(bin_dir, "createdb", target)?;
    create.args(["--no-password", "--echo", "--", &request.database]);
    process::run_streaming(create, log, cancel).await?;

    match restore_tolerant(bin_dir, target, &request.database, dump, log, cancel).await {
        Ok(skipped) => Ok((size, skipped)),
        Err(e) => {
            log(format!(
                "Removing {} after the failed copy",
                request.database
            ));
            let mut drop = command(bin_dir, "dropdb", target)?;
            drop.args(["--no-password", "--if-exists", "--", &request.database]);
            // Its own token: the cleanup has to run even when the copy was cancelled
            let _ = process::run_streaming(drop, log, &CancellationToken::new()).await;
            Err(e)
        }
    }
}

/// `pg_restore` without `--exit-on-error`: objects that fail are skipped and counted, the rest restores.
async fn restore_tolerant(
    bin_dir: &Path,
    conn: &ToolConnection,
    database: &str,
    dump: &Path,
    log: &(dyn Fn(String) + Send + Sync),
    cancel: &CancellationToken,
) -> CoreResult<u32> {
    use std::sync::atomic::{AtomicU32, Ordering};

    let mut cmd = command(bin_dir, "pg_restore", conn)?;
    cmd.args([
        "--verbose",
        "--no-password",
        "--no-owner",
        "--no-privileges",
        "--dbname",
        &dbname_arg(database),
    ])
    .arg(dump);
    log(format!("Restoring into {database}"));

    let skipped = AtomicU32::new(0);
    let watch = |line: String| {
        if let Some(n) = skipped_count(&line) {
            skipped.store(n, Ordering::Relaxed);
        }
        log(line);
    };
    match process::run_streaming(cmd, &watch, cancel).await {
        Ok(()) => Ok(0),
        // It exits non-zero after skipping something; only then is that a partial success
        Err(CoreError::ProcessFailed { .. }) if skipped.load(Ordering::Relaxed) > 0 => {
            let n = skipped.load(Ordering::Relaxed);
            log(format!(
                "Copy complete; {n} object(s) couldn't be created locally"
            ));
            Ok(n)
        }
        Err(e) => Err(e),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sizes_read_naturally() {
        assert_eq!(human_size(35_204), "35 KB");
        assert_eq!(human_size(13_002_342), "12.4 MB");
    }

    #[test]
    fn reads_the_skipped_count() {
        assert_eq!(
            skipped_count("pg_restore: warning: errors ignored on restore: 3"),
            Some(3)
        );
        assert_eq!(
            skipped_count("pg_restore: creating TABLE public.users"),
            None
        );
    }

    #[test]
    fn quotes_database_names_as_conninfo() {
        assert_eq!(dbname_arg("shop"), "dbname='shop'");
        assert_eq!(dbname_arg("a=b it's"), r"dbname='a=b it\'s'");
        assert_eq!(dbname_arg(r"back\slash"), r"dbname='back\\slash'");
    }

    #[test]
    fn partial_file_keeps_the_full_name() {
        assert_eq!(
            partial_path(Path::new("dir/db.dump")),
            Path::new("dir/db.dump.partial")
        );
        assert_eq!(partial_path(Path::new("db")), Path::new("db.partial"));
    }

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
