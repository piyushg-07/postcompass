//! Running PostgreSQL tools as child processes.

use std::collections::VecDeque;
use std::ffi::OsStr;
use std::io::{Read, Seek, SeekFrom};
use std::path::Path;
use std::process::{Output, Stdio};
use std::time::Duration;

use pc_core::runtime::{CancellationToken, InstallContext};
use pc_core::{CoreError, CoreResult};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;

/// Output lines kept for the error message when a streamed command fails.
const LAST_LINES: usize = 8;
/// How much of a log file `tail_file` reads; server logs grow without bound.
const TAIL_BYTES: u64 = 64 * 1024;

/// A command that never opens a console window on Windows and is killed if dropped.
pub fn command(program: impl AsRef<OsStr>) -> Command {
    let mut cmd = Command::new(program);
    cmd.kill_on_drop(true).stdin(Stdio::null());
    #[cfg(windows)]
    {
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    cmd
}

fn program_name(cmd: &Command) -> String {
    Path::new(cmd.as_std().get_program())
        .file_stem()
        .map(|s| s.to_string_lossy().into_owned())
        .unwrap_or_else(|| "process".to_owned())
}

/// Runs to completion with a timeout and captures output. Does not check the exit code.
pub async fn output(mut cmd: Command, timeout: Duration) -> CoreResult<Output> {
    let name = program_name(&cmd);
    cmd.stdout(Stdio::piped()).stderr(Stdio::piped());
    let child = cmd.spawn().map_err(|e| CoreError::ProcessFailed {
        program: name.clone(),
        message: e.to_string(),
    })?;
    match tokio::time::timeout(timeout, child.wait_with_output()).await {
        Ok(result) => result.map_err(|e| CoreError::ProcessFailed {
            program: name,
            message: e.to_string(),
        }),
        Err(_) => Err(CoreError::ProcessFailed {
            program: name,
            message: format!("timed out after {}s", timeout.as_secs()),
        }),
    }
}

/// Runs to completion and returns trimmed stdout, or an error with stderr when it exits non-zero.
pub async fn run(cmd: Command, timeout: Duration) -> CoreResult<String> {
    let name = program_name(&cmd);
    let out = output(cmd, timeout).await?;
    if out.status.success() {
        Ok(String::from_utf8_lossy(&out.stdout).trim().to_owned())
    } else {
        Err(CoreError::ProcessFailed {
            program: name,
            message: first_meaningful(&out),
        })
    }
}

/// Runs to completion, forwarding every output line to the install log. Honors cancellation.
pub async fn run_logged(cmd: Command, ctx: &InstallContext) -> CoreResult<()> {
    run_streaming(cmd, &|line| ctx.log(line), &ctx.cancel).await
}

/// Runs to completion, passing every stdout/stderr line to `log`. Kills the process on cancel.
pub async fn run_streaming(
    mut cmd: Command,
    log: &(dyn Fn(String) + Send + Sync),
    cancel: &CancellationToken,
) -> CoreResult<()> {
    let name = program_name(&cmd);
    cmd.stdout(Stdio::piped()).stderr(Stdio::piped());
    let mut child = cmd.spawn().map_err(|e| CoreError::ProcessFailed {
        program: name.clone(),
        message: e.to_string(),
    })?;

    // Merge stdout and stderr into one stream of lines
    let (tx, mut lines) = tokio::sync::mpsc::unbounded_channel::<String>();
    if let Some(stream) = child.stdout.take() {
        tokio::spawn(forward_lines(stream, tx.clone()));
    }
    if let Some(stream) = child.stderr.take() {
        tokio::spawn(forward_lines(stream, tx.clone()));
    }
    drop(tx);

    let mut last_lines: VecDeque<String> = VecDeque::with_capacity(LAST_LINES);
    loop {
        tokio::select! {
            _ = cancel.cancelled() => {
                let _ = child.kill().await;
                return Err(CoreError::Cancelled);
            }
            line = lines.recv() => match line {
                Some(line) => {
                    log(line.clone());
                    if last_lines.len() == LAST_LINES {
                        last_lines.pop_front();
                    }
                    last_lines.push_back(line);
                }
                None => break,
            },
        }
    }

    let status = child.wait().await.map_err(|e| CoreError::ProcessFailed {
        program: name.clone(),
        message: e.to_string(),
    })?;
    if status.success() {
        Ok(())
    } else {
        Err(CoreError::ProcessFailed {
            program: name,
            message: if last_lines.is_empty() {
                format!("exited with {status}")
            } else {
                Vec::from(last_lines).join("\n")
            },
        })
    }
}

async fn forward_lines(
    stream: impl tokio::io::AsyncRead + Unpin,
    tx: tokio::sync::mpsc::UnboundedSender<String>,
) {
    let mut reader = BufReader::new(stream).lines();
    while let Ok(Some(line)) = reader.next_line().await {
        if tx.send(line).is_err() {
            break;
        }
    }
}

fn first_meaningful(out: &Output) -> String {
    let stderr = String::from_utf8_lossy(&out.stderr);
    let stdout = String::from_utf8_lossy(&out.stdout);
    let text = if stderr.trim().is_empty() {
        stdout
    } else {
        stderr
    };
    let text = text.trim();
    if text.is_empty() {
        format!("exited with {}", out.status)
    } else {
        text.to_owned()
    }
}

/// Last `n` lines of a text file, for surfacing server logs in error messages. Reads only the end
/// of the file, which can be large after a server has run for a long time.
pub fn tail_file(path: &Path, n: usize) -> String {
    let read_end = || -> std::io::Result<String> {
        let mut file = std::fs::File::open(path)?;
        let len = file.metadata()?.len();
        file.seek(SeekFrom::Start(len.saturating_sub(TAIL_BYTES)))?;
        let mut bytes = Vec::new();
        file.read_to_end(&mut bytes)?;
        Ok(String::from_utf8_lossy(&bytes).into_owned())
    };
    read_end()
        .map(|text| {
            let lines: Vec<&str> = text.lines().collect();
            lines[lines.len().saturating_sub(n)..].join("\n")
        })
        .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tails_the_end_of_a_file() {
        let path =
            std::env::temp_dir().join(format!("postcompass-tail-{}.log", std::process::id()));
        let text: String = (1..=10_000).map(|i| format!("line {i}\n")).collect();
        std::fs::write(&path, text).unwrap();
        assert_eq!(tail_file(&path, 2), "line 9999\nline 10000");
        let _ = std::fs::remove_file(&path);
        assert_eq!(tail_file(&path, 2), "");
    }
}
