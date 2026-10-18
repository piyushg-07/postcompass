//! Installs a PostgreSQL server into PostCompass's own folder. No admin rights, no system changes.
//!
//! Layout under the runtime root:
//!   downloads/<archive>.tar.gz     cached download (kept for reinstalls)
//!   binaries/<version>/bin/…       extracted binaries, shared by servers of the same version
//!   servers/<id>/data              data directory (unless a custom one is chosen)
//!   servers/<id>/postgres.log      server log

use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use pc_core::runtime::{InstallContext, InstallRequest, InstallStep, ManagedServer, StepState};
use pc_core::{CoreError, CoreResult, DatabaseKind};

use crate::platform::{self, exe};
use crate::{detect, download, process, server, versions};

/// Marker written after a successful extract, so a half-extracted folder is never reused.
const COMPLETE_MARKER: &str = ".postcompass-complete";
const MIN_FREE_MB: u64 = 1024;
const SUPERUSER: &str = "postgres";

pub fn binaries_dir(root: &Path, version: &str) -> PathBuf {
    root.join("binaries").join(version)
}

pub async fn install(request: InstallRequest, ctx: InstallContext) -> CoreResult<ManagedServer> {
    validate(&request)?;

    let id = new_server_id();
    let server_dir = ctx.root_dir.join("servers").join(&id);
    let custom_data = request.data_dir.as_ref().map(PathBuf::from);
    let data_dir = custom_data.clone().unwrap_or_else(|| server_dir.join("data"));

    let mut cleanup = Cleanup {
        server_dir: server_dir.clone(),
        data_dir: data_dir.clone(),
        remove_data: true,
        started: None,
    };

    let result = run_steps(&request, &ctx, &id, &server_dir, &data_dir, &mut cleanup).await;
    if result.is_err() {
        cleanup.rollback(&ctx).await;
    }
    result
}

fn validate(request: &InstallRequest) -> CoreResult<()> {
    if !versions::is_known(&request.version) {
        return Err(CoreError::InvalidInput(format!("unsupported version {}", request.version)));
    }
    if request.port < 1024 {
        return Err(CoreError::InvalidInput("choose a port of 1024 or higher".into()));
    }
    if request.password.len() < 8 {
        return Err(CoreError::InvalidInput("password must be at least 8 characters".into()));
    }
    if request.name.trim().is_empty() {
        return Err(CoreError::InvalidInput("server name is required".into()));
    }
    Ok(())
}

async fn run_steps(
    request: &InstallRequest,
    ctx: &InstallContext,
    id: &str,
    server_dir: &Path,
    data_dir: &Path,
    cleanup: &mut Cleanup,
) -> CoreResult<ManagedServer> {
    let triple = platform::target_triple()
        .ok_or_else(|| CoreError::Unsupported("PostgreSQL install is not supported on this platform yet".into()))?;

    // 1. Check system
    ctx.step(InstallStep::CheckSystem, StepState::Active, None);
    let result = check_system(request, ctx, data_dir).await;
    if let Err(e) = &result {
        // The data folder was not created by us; never delete it during rollback
        if matches!(e, CoreError::InvalidInput(_)) {
            cleanup.remove_data = false;
        }
    }
    finish(ctx, InstallStep::CheckSystem, result, |_| None)?;

    // 2–4. Download, verify, extract (skipped when these binaries are already installed)
    let bin_root = binaries_dir(&ctx.root_dir, &request.version);
    if bin_root.join(COMPLETE_MARKER).is_file() {
        for step in [InstallStep::Download, InstallStep::Verify, InstallStep::Extract] {
            ctx.step(step, StepState::Skipped, Some("Already installed".into()));
        }
        ctx.log(format!("Using existing PostgreSQL {} binaries", request.version));
    } else {
        fetch_binaries(request, ctx, triple, &bin_root).await?;
    }
    let bin_dir = bin_root.join("bin");

    // 5. Initialize the data directory
    ctx.step(InstallStep::Initialize, StepState::Active, None);
    let result = initialize(request, ctx, &bin_dir, server_dir, data_dir).await;
    finish(ctx, InstallStep::Initialize, result, |_| None)?;

    let managed = ManagedServer {
        id: id.to_owned(),
        kind: DatabaseKind::Postgres,
        name: request.name.trim().to_owned(),
        version: request.version.clone(),
        host: "127.0.0.1".into(),
        port: request.port,
        superuser: SUPERUSER.into(),
        bin_dir: bin_dir.to_string_lossy().into_owned(),
        data_dir: data_dir.to_string_lossy().into_owned(),
        log_file: server_dir.join("postgres.log").to_string_lossy().into_owned(),
        auto_start: request.auto_start,
        created_at: now_ms(),
    };

    // 6. Start
    ctx.step(InstallStep::Start, StepState::Active, Some(format!("Port {}", request.port)));
    cleanup.started = Some(managed.clone());
    let result = server::start(&managed).await;
    finish(ctx, InstallStep::Start, result, |_| Some(format!("Listening on 127.0.0.1:{}", request.port)))?;

    // 7. Connect
    ctx.step(InstallStep::Connect, StepState::Active, None);
    let result = server::query_version(&managed, &request.password).await;
    let version = finish(ctx, InstallStep::Connect, result, |_| Some("Connected as postgres".into()))?;
    ctx.log(version);

    Ok(managed)
}

/// Marks a step done (with an optional detail derived from the value) or failed, and passes the result through.
fn finish<T>(
    ctx: &InstallContext,
    step: InstallStep,
    result: CoreResult<T>,
    detail: impl FnOnce(&T) -> Option<String>,
) -> CoreResult<T> {
    match &result {
        Ok(value) => ctx.step(step, StepState::Done, detail(value)),
        Err(CoreError::Cancelled) => ctx.step(step, StepState::Failed, Some("Cancelled".into())),
        Err(e) => {
            ctx.step(step, StepState::Failed, Some(e.to_string()));
            ctx.log(format!("Error: {e}"));
        }
    }
    result
}

async fn check_system(request: &InstallRequest, ctx: &InstallContext, data_dir: &Path) -> CoreResult<()> {
    tokio::fs::create_dir_all(&ctx.root_dir)
        .await
        .map_err(|e| CoreError::io("could not create the app data folder", e))?;

    let available_mb = fs4::available_space(&ctx.root_dir).map(|b| b / 1_048_576).unwrap_or(u64::MAX);
    ctx.log(format!("Free disk space: {available_mb} MB"));
    if available_mb < MIN_FREE_MB {
        return Err(CoreError::InsufficientDiskSpace {
            needed_mb: MIN_FREE_MB,
            available_mb,
        });
    }

    if !detect::port_is_free(request.port) {
        return Err(CoreError::PortInUse(request.port));
    }
    ctx.log(format!("Port {} is free", request.port));

    if data_dir.exists() && std::fs::read_dir(data_dir).map(|mut d| d.next().is_some()).unwrap_or(true) {
        return Err(CoreError::InvalidInput(format!(
            "the data folder {} is not empty",
            data_dir.display()
        )));
    }
    Ok(())
}

async fn fetch_binaries(request: &InstallRequest, ctx: &InstallContext, triple: &str, bin_root: &Path) -> CoreResult<()> {
    let client = download::client()?;
    let downloads = ctx.root_dir.join("downloads");
    tokio::fs::create_dir_all(&downloads)
        .await
        .map_err(|e| CoreError::io("could not create the downloads folder", e))?;
    let archive = downloads.join(versions::archive_name(&request.version, triple));

    // Download
    ctx.step(InstallStep::Download, StepState::Active, None);
    let result = async {
        let url = versions::archive_url(&request.version, triple);
        let expected = versions::parse_checksum(&download::fetch_text(&client, &versions::checksum_url(&request.version, triple)).await?)
            .ok_or_else(|| CoreError::Network("checksum file had no SHA-256 hash".into()))?;
        if archive.is_file() {
            ctx.log("Found a previous download, re-verifying it");
        } else {
            ctx.log(format!("Downloading {url}"));
            download::download(&client, &url, &archive, ctx).await?;
        }
        Ok::<_, CoreError>(expected)
    }
    .await;
    let expected = finish(ctx, InstallStep::Download, result, |_| None)?;

    // Verify
    ctx.step(InstallStep::Verify, StepState::Active, None);
    let result = async {
        let actual = download::sha256_file(&archive).await?;
        if actual != expected {
            let _ = tokio::fs::remove_file(&archive).await;
            return Err(CoreError::ChecksumMismatch { expected, actual });
        }
        ctx.log(format!("SHA-256 verified: {actual}"));
        Ok(())
    }
    .await;
    finish(ctx, InstallStep::Verify, result, |_| Some("SHA-256 matches".into()))?;

    // Extract
    ctx.step(InstallStep::Extract, StepState::Active, None);
    let result = extract(&archive, bin_root).await;
    finish(ctx, InstallStep::Extract, result, |_| None)?;
    Ok(())
}

/// Extracts into a temporary folder, then moves the archive's top folder into place.
async fn extract(archive: &Path, bin_root: &Path) -> CoreResult<()> {
    let archive = archive.to_path_buf();
    let bin_root = bin_root.to_path_buf();
    tokio::task::spawn_blocking(move || {
        let parent = bin_root.parent().ok_or_else(|| CoreError::Internal("invalid binaries folder".into()))?;
        std::fs::create_dir_all(parent).map_err(|e| CoreError::io("could not create the binaries folder", e))?;
        let staging = parent.join(format!(".extract-{}", new_server_id()));
        let _ = std::fs::remove_dir_all(&bin_root);

        let result = (|| {
            let file = std::fs::File::open(&archive).map_err(|e| CoreError::io("could not open the archive", e))?;
            tar::Archive::new(flate2::read::GzDecoder::new(file))
                .unpack(&staging)
                .map_err(|e| CoreError::io("could not extract the archive", e))?;

            // The archive contains a single top-level folder, e.g. postgresql-18.6.0-<triple>/
            let top = std::fs::read_dir(&staging)
                .map_err(|e| CoreError::io("could not read the extracted files", e))?
                .flatten()
                .find(|e| e.path().is_dir())
                .ok_or_else(|| CoreError::Internal("archive was empty".into()))?
                .path();
            if !top.join("bin").join(exe("pg_ctl")).is_file() {
                return Err(CoreError::Internal("archive is missing pg_ctl".into()));
            }
            std::fs::rename(&top, &bin_root).map_err(|e| CoreError::io("could not move the binaries into place", e))?;
            std::fs::write(bin_root.join(COMPLETE_MARKER), b"").map_err(|e| CoreError::io("could not finalize the binaries", e))?;
            Ok(())
        })();

        let _ = std::fs::remove_dir_all(&staging);
        result
    })
    .await
    .map_err(|e| CoreError::Internal(e.to_string()))?
}

async fn initialize(
    request: &InstallRequest,
    ctx: &InstallContext,
    bin_dir: &Path,
    server_dir: &Path,
    data_dir: &Path,
) -> CoreResult<()> {
    tokio::fs::create_dir_all(server_dir)
        .await
        .map_err(|e| CoreError::io("could not create the server folder", e))?;

    // initdb reads the password from a file so it never appears in a process list
    let pwfile = server_dir.join(".pwfile");
    write_private(&pwfile, request.password.as_bytes())?;
    let result = async {
        let mut cmd = process::command(bin_dir.join(exe("initdb")));
        cmd.arg("-D")
            .arg(data_dir)
            .args(["-U", SUPERUSER, "-A", "scram-sha-256", "-E", "UTF8", "--no-locale"])
            .arg(format!("--pwfile={}", pwfile.display()));
        process::run_logged(cmd, ctx).await
    }
    .await;
    let _ = std::fs::remove_file(&pwfile);
    result?;

    // Bind to localhost only, on the chosen port
    let conf = data_dir.join("postgresql.conf");
    let mut text = std::fs::read_to_string(&conf).map_err(|e| CoreError::io("could not read postgresql.conf", e))?;
    text.push_str(&format!(
        "\n# Added by PostCompass\nport = {}\nlisten_addresses = '127.0.0.1'\n",
        request.port
    ));
    std::fs::write(&conf, text).map_err(|e| CoreError::io("could not update postgresql.conf", e))?;
    ctx.log(format!("Configured to listen on 127.0.0.1:{}", request.port));
    Ok(())
}

fn write_private(path: &Path, contents: &[u8]) -> CoreResult<()> {
    std::fs::write(path, contents).map_err(|e| CoreError::io("could not write a temporary file", e))?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(path, std::fs::Permissions::from_mode(0o600))
            .map_err(|e| CoreError::io("could not secure a temporary file", e))?;
    }
    Ok(())
}

/// Undoes a failed or cancelled install. Downloads and extracted binaries are kept for next time.
struct Cleanup {
    server_dir: PathBuf,
    data_dir: PathBuf,
    remove_data: bool,
    started: Option<ManagedServer>,
}

impl Cleanup {
    async fn rollback(self, ctx: &InstallContext) {
        ctx.log("Rolling back…");
        if let Some(server) = &self.started {
            let _ = server::stop_immediately(server).await;
        }
        // Give Windows a moment to release file handles held by the stopped server
        tokio::time::sleep(Duration::from_millis(300)).await;
        if self.remove_data && !self.data_dir.starts_with(&self.server_dir) {
            let _ = tokio::fs::remove_dir_all(&self.data_dir).await;
        }
        let _ = tokio::fs::remove_dir_all(&self.server_dir).await;
        ctx.log("Rolled back. Nothing was left behind except the cached download.");
    }
}

fn now_ms() -> f64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_millis() as f64).unwrap_or(0.0)
}

/// Short, sortable, unique-enough id for local servers, e.g. `pg-lx3k9a2b-4f1c`.
fn new_server_id() -> String {
    let nanos = SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_nanos()).unwrap_or(0);
    format!("pg-{:x}-{:04x}", nanos / 1_000_000, (nanos % 65_536) as u16)
}
