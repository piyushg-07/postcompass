//! Resumable, cancellable HTTPS downloads with progress and SHA-256 verification.

use std::path::Path;
use std::time::{Duration, Instant};

use futures_util::StreamExt;
use pc_core::runtime::{InstallContext, InstallEvent};
use pc_core::{CoreError, CoreResult};
use reqwest::{Client, StatusCode, header};
use sha2::{Digest, Sha256};
use tokio::io::AsyncWriteExt;

pub fn client() -> CoreResult<Client> {
    Client::builder()
        .user_agent(concat!("PostCompass/", env!("CARGO_PKG_VERSION")))
        .connect_timeout(Duration::from_secs(15))
        .read_timeout(Duration::from_secs(60))
        .https_only(true)
        .build()
        .map_err(|e| CoreError::Network(e.to_string()))
}

pub async fn fetch_text(client: &Client, url: &str) -> CoreResult<String> {
    let response = client.get(url).send().await.map_err(network)?;
    let response = response.error_for_status().map_err(network)?;
    response.text().await.map_err(network)
}

/// Downloads `url` to `dest`, resuming from an existing `dest.part` when the server supports it.
pub async fn download(
    client: &Client,
    url: &str,
    dest: &Path,
    ctx: &InstallContext,
) -> CoreResult<()> {
    let part = dest.with_extension("part");
    let mut existing = tokio::fs::metadata(&part)
        .await
        .map(|m| m.len())
        .unwrap_or(0);

    let response = loop {
        let mut request = client.get(url);
        if existing > 0 {
            request = request.header(header::RANGE, format!("bytes={existing}-"));
        }
        let response = tokio::select! {
            _ = ctx.cancel.cancelled() => return Err(CoreError::Cancelled),
            r = request.send() => r.map_err(network)?,
        };
        // The `.part` file is already complete or larger than the archive (e.g. it changed upstream):
        // resuming can never succeed, so start over instead of failing on every attempt
        if existing > 0 && response.status() == StatusCode::RANGE_NOT_SATISFIABLE {
            ctx.log("Previous partial download can't be resumed, starting over");
            tokio::fs::remove_file(&part)
                .await
                .map_err(|e| CoreError::io("could not remove the partial download", e))?;
            existing = 0;
            continue;
        }
        break response;
    };

    let resumed = existing > 0 && response.status() == StatusCode::PARTIAL_CONTENT;
    let response = response.error_for_status().map_err(network)?;
    let mut downloaded = if resumed { existing } else { 0 };
    let total = response.content_length().map(|len| len + downloaded);
    if resumed {
        ctx.log(format!("Resuming download at {:.1} MB", mb(existing)));
    }

    let mut file = tokio::fs::OpenOptions::new()
        .create(true)
        .write(true)
        .append(resumed)
        .truncate(!resumed)
        .open(&part)
        .await
        .map_err(|e| CoreError::io("could not create download file", e))?;

    let mut stream = response.bytes_stream();
    let mut last_report = Instant::now() - Duration::from_secs(1);
    loop {
        let chunk = tokio::select! {
            _ = ctx.cancel.cancelled() => {
                file.flush().await.ok();
                return Err(CoreError::Cancelled); // keep the .part file so the next attempt resumes
            }
            chunk = stream.next() => chunk,
        };
        let Some(chunk) = chunk else { break };
        let chunk = chunk.map_err(network)?;
        file.write_all(&chunk)
            .await
            .map_err(|e| CoreError::io("could not write download", e))?;
        downloaded += chunk.len() as u64;

        if last_report.elapsed() >= Duration::from_millis(100) {
            last_report = Instant::now();
            report(ctx, downloaded, total);
        }
    }
    file.flush()
        .await
        .map_err(|e| CoreError::io("could not write download", e))?;
    drop(file);
    report(ctx, downloaded, total);

    if let Some(total) = total
        && downloaded != total
    {
        return Err(CoreError::Network(format!(
            "download ended early ({:.1} of {:.1} MB)",
            mb(downloaded),
            mb(total)
        )));
    }

    tokio::fs::rename(&part, dest)
        .await
        .map_err(|e| CoreError::io("could not finalize download", e))
}

fn report(ctx: &InstallContext, downloaded: u64, total: Option<u64>) {
    ctx.emit(InstallEvent::Download {
        downloaded: downloaded as f64,
        total: total.map(|t| t as f64),
    });
}

/// SHA-256 of a file as lowercase hex. Runs on a blocking thread.
pub async fn sha256_file(path: &Path) -> CoreResult<String> {
    let path = path.to_path_buf();
    tokio::task::spawn_blocking(move || {
        let mut file =
            std::fs::File::open(&path).map_err(|e| CoreError::io("could not open download", e))?;
        let mut hasher = Sha256::new();
        let mut buffer = vec![0u8; 256 * 1024];
        loop {
            let read = std::io::Read::read(&mut file, &mut buffer)
                .map_err(|e| CoreError::io("could not read download", e))?;
            if read == 0 {
                break;
            }
            hasher.update(&buffer[..read]);
        }
        Ok(hasher
            .finalize()
            .iter()
            .map(|b| format!("{b:02x}"))
            .collect::<String>())
    })
    .await
    .map_err(|e| CoreError::Internal(e.to_string()))?
}

fn network(e: reqwest::Error) -> CoreError {
    CoreError::Network(e.to_string())
}

fn mb(bytes: u64) -> f64 {
    bytes as f64 / 1_048_576.0
}
