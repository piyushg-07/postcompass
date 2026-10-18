//! Start, stop and check a PostCompass-managed PostgreSQL server with `pg_ctl`.

use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::time::Duration;

use pc_core::runtime::{ManagedServer, ServerStatus};
use pc_core::{CoreError, CoreResult};

use crate::detect;
use crate::platform::exe;
use crate::process;

fn tool(server: &ManagedServer, name: &str) -> PathBuf {
    Path::new(&server.bin_dir).join(exe(name))
}

pub async fn status(server: &ManagedServer) -> ServerStatus {
    if !Path::new(&server.data_dir).join("PG_VERSION").is_file() || !tool(server, "pg_ctl").is_file() {
        return ServerStatus::Error;
    }
    let mut cmd = process::command(tool(server, "pg_ctl"));
    cmd.arg("status").arg("-D").arg(&server.data_dir);
    match process::output(cmd, Duration::from_secs(10)).await {
        // pg_ctl status: 0 = running, 3 = not running, 4 = no accessible data directory
        Ok(out) => match out.status.code() {
            Some(0) => ServerStatus::Running,
            Some(3) => ServerStatus::Stopped,
            _ => ServerStatus::Error,
        },
        Err(_) => ServerStatus::Error,
    }
}

pub async fn start(server: &ManagedServer) -> CoreResult<()> {
    match status(server).await {
        ServerStatus::Running => return Ok(()),
        ServerStatus::Error => {
            return Err(CoreError::NotFound(format!(
                "server files are missing in {}",
                server.data_dir
            )));
        }
        ServerStatus::Stopped => {}
    }
    if !detect::port_is_free(server.port) {
        return Err(CoreError::PortInUse(server.port));
    }

    let mut cmd = process::command(tool(server, "pg_ctl"));
    cmd.arg("start")
        .arg("-D")
        .arg(&server.data_dir)
        .arg("-l")
        .arg(&server.log_file)
        .args(["-w", "-t", "60"])
        // The server inherits pg_ctl's handles; piping them would keep this call waiting
        // until the server exits (seen on Windows). Errors go to the log file instead.
        .stdout(Stdio::null())
        .stderr(Stdio::null());

    let result = async {
        let mut child = cmd.spawn().map_err(|e| CoreError::ProcessFailed {
            program: "pg_ctl".into(),
            message: e.to_string(),
        })?;
        let status = tokio::time::timeout(Duration::from_secs(75), child.wait())
            .await
            .map_err(|_| CoreError::ProcessFailed {
                program: "pg_ctl".into(),
                message: "server did not start within 60 seconds".into(),
            })?
            .map_err(|e| CoreError::ProcessFailed {
                program: "pg_ctl".into(),
                message: e.to_string(),
            })?;
        if status.success() {
            Ok(())
        } else {
            Err(CoreError::ProcessFailed {
                program: "pg_ctl".into(),
                message: "server failed to start".into(),
            })
        }
    }
    .await;

    result.map_err(|e| match e {
        CoreError::ProcessFailed { program, message } => {
            let log = process::tail_file(Path::new(&server.log_file), 6);
            CoreError::ProcessFailed {
                program,
                message: if log.is_empty() { message } else { format!("{message}\n{log}") },
            }
        }
        other => other,
    })
}

pub async fn stop(server: &ManagedServer) -> CoreResult<()> {
    stop_with_mode(server, "fast").await
}

/// Used during rollback: does not wait for clients to disconnect.
pub async fn stop_immediately(server: &ManagedServer) -> CoreResult<()> {
    stop_with_mode(server, "immediate").await
}

async fn stop_with_mode(server: &ManagedServer, mode: &str) -> CoreResult<()> {
    if status(server).await != ServerStatus::Running {
        return Ok(());
    }
    let mut cmd = process::command(tool(server, "pg_ctl"));
    cmd.arg("stop")
        .arg("-D")
        .arg(&server.data_dir)
        .args(["-m", mode, "-w", "-t", "30"]);
    process::run(cmd, Duration::from_secs(40)).await.map(|_| ())
}

/// Connects with `psql` and returns `SELECT version()`. Proves the server accepts the password.
pub async fn query_version(server: &ManagedServer, password: &str) -> CoreResult<String> {
    let mut cmd = process::command(tool(server, "psql"));
    cmd.args(["-h", &server.host, "-p", &server.port.to_string(), "-U", &server.superuser])
        .args(["-d", "postgres", "-w", "-tAc", "select version()"])
        .env("PGPASSWORD", password)
        .env("PGCONNECT_TIMEOUT", "10");
    process::run(cmd, Duration::from_secs(20)).await
}

pub async fn uninstall(server: &ManagedServer, keep_data: bool) -> CoreResult<()> {
    stop(server).await?;
    if keep_data {
        return Ok(());
    }
    // Give Windows a moment to release file handles held by the stopped server
    tokio::time::sleep(Duration::from_millis(300)).await;
    let data_dir = Path::new(&server.data_dir);
    if data_dir.exists() {
        tokio::fs::remove_dir_all(data_dir)
            .await
            .map_err(|e| CoreError::io("could not delete the data folder", e))?;
    }
    if let Some(server_dir) = Path::new(&server.log_file).parent()
        && server_dir.exists()
    {
        tokio::fs::remove_dir_all(server_dir)
            .await
            .map_err(|e| CoreError::io("could not delete the server folder", e))?;
    }
    Ok(())
}
