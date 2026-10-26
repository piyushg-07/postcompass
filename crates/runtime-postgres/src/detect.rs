//! Read-only detection of existing PostgreSQL installs and running servers.
//!
//! Every check is time-boxed and runs concurrently; a failing check becomes a note, never an error.

use std::collections::{BTreeMap, HashSet};
use std::path::{Path, PathBuf};
use std::time::{Duration, Instant};

use pc_core::runtime::{DetectedInstall, DetectionReport, InstallSource, ListeningServer};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;

use crate::platform::exe;
use crate::process;

/// Ports probed for a listening server.
const PROBE_PORTS: std::ops::RangeInclusive<u16> = 5432..=5442;
const CMD_TIMEOUT: Duration = Duration::from_secs(4);

pub async fn detect(managed_root: Option<PathBuf>) -> DetectionReport {
    let started = Instant::now();
    let mut notes = Vec::new();

    let (mut installs, servers, services, docker) = tokio::join!(
        find_installs(managed_root.as_deref()),
        probe_ports(),
        list_services(),
        list_docker()
    );

    // Attach OS service info to installs, adding service-only installs we did not find on disk
    match services {
        Ok(services) => merge_services(&mut installs, services),
        Err(note) => notes.push(note),
    }

    // Label listening servers that come from Docker
    let mut servers: BTreeMap<u16, ListeningServer> =
        servers.into_iter().map(|s| (s.port, s)).collect();
    match docker {
        Ok(containers) => {
            for (port, name) in containers {
                let entry = servers.entry(port).or_insert_with(|| ListeningServer {
                    host: "127.0.0.1".into(),
                    port,
                    source: None,
                    label: None,
                });
                entry.source = Some(InstallSource::Docker);
                entry.label = Some(name);
            }
        }
        Err(note) => notes.push(note),
    }

    DetectionReport {
        installs,
        servers: servers.into_values().collect(),
        notes,
        duration_ms: started.elapsed().as_millis().min(u32::MAX as u128) as u32,
    }
}

/* ── Installs on disk ─────────────────────────────────────────────────── */

async fn find_installs(managed_root: Option<&Path>) -> Vec<DetectedInstall> {
    // Directory scans and canonicalize are blocking file system calls
    let dirs = tokio::task::spawn_blocking(existing_bin_dirs)
        .await
        .unwrap_or_default();

    let tasks = dirs.into_iter().map(|dir| async move {
        let version = postgres_version(&dir).await;
        (dir, version)
    });
    let results = futures_util::future::join_all(tasks).await;

    let mut installs: Vec<DetectedInstall> = results
        .into_iter()
        .map(|(dir, version)| DetectedInstall {
            version,
            source: classify(&dir, managed_root),
            bin_dir: dir.to_string_lossy().into_owned(),
            data_dir: None,
            service_name: None,
            service_running: None,
        })
        .collect();
    installs.sort_by_cached_key(|i| std::cmp::Reverse(version_key(i.version.as_deref())));
    installs
}

/// Candidate folders that hold a `postgres` binary, each install once.
fn existing_bin_dirs() -> Vec<PathBuf> {
    let mut seen = HashSet::new();
    candidate_bin_dirs()
        .into_iter()
        .filter(|dir| dir.join(exe("postgres")).is_file() && seen.insert(normalize(dir)))
        .collect()
}

/// Sort key comparing versions numerically, so `16.10` > `16.9` > `9.6`; unknown versions sort last.
fn version_key(version: Option<&str>) -> Option<Vec<u32>> {
    version.map(|v| {
        v.split('.')
            .map(|part| {
                let digits: String = part.chars().take_while(char::is_ascii_digit).collect();
                digits.parse().unwrap_or(0)
            })
            .collect()
    })
}

/// PATH entries plus the usual install locations for each OS.
fn candidate_bin_dirs() -> Vec<PathBuf> {
    let mut dirs: Vec<PathBuf> = std::env::var_os("PATH")
        .map(|path| std::env::split_paths(&path).collect())
        .unwrap_or_default();

    if cfg!(windows) {
        for var in ["ProgramFiles", "ProgramFiles(x86)", "ProgramW6432"] {
            if let Some(root) = std::env::var_os(var) {
                dirs.extend(expand(&Path::new(&root).join("PostgreSQL"), "", "bin"));
            }
        }
        if let Some(home) = std::env::var_os("USERPROFILE") {
            dirs.push(Path::new(&home).join(r"scoop\apps\postgresql\current\bin"));
        }
    } else if cfg!(target_os = "macos") {
        dirs.extend(expand(
            Path::new("/Applications/Postgres.app/Contents/Versions"),
            "",
            "bin",
        ));
        for prefix in ["/opt/homebrew/opt", "/usr/local/opt"] {
            dirs.extend(expand(Path::new(prefix), "postgresql", "bin"));
        }
        dirs.extend(expand(Path::new("/Library/PostgreSQL"), "", "bin"));
    } else {
        dirs.extend(expand(Path::new("/usr/lib/postgresql"), "", "bin"));
        dirs.extend(expand(Path::new("/usr"), "pgsql-", "bin"));
        dirs.push(PathBuf::from("/usr/local/pgsql/bin"));
    }
    dirs
}

/// `expand("/usr/lib/postgresql", "", "bin")` → every `/usr/lib/postgresql/*/bin`.
fn expand(parent: &Path, prefix: &str, suffix: &str) -> Vec<PathBuf> {
    let Ok(entries) = std::fs::read_dir(parent) else {
        return Vec::new();
    };
    entries
        .flatten()
        .filter(|e| e.file_name().to_string_lossy().starts_with(prefix))
        .map(|e| e.path().join(suffix))
        .collect()
}

fn normalize(path: &Path) -> String {
    let canonical = std::fs::canonicalize(path).unwrap_or_else(|_| path.to_path_buf());
    let text = canonical
        .to_string_lossy()
        .trim_end_matches(['/', '\\'])
        .to_owned();
    if cfg!(windows) {
        text.to_lowercase()
    } else {
        text
    }
}

fn classify(dir: &Path, managed_root: Option<&Path>) -> InstallSource {
    // Compared as paths, so `runtimes2` doesn't count as inside `runtimes`
    if managed_root.is_some_and(|root| Path::new(&normalize(dir)).starts_with(normalize(root))) {
        return InstallSource::Managed;
    }
    let text = dir.to_string_lossy();
    if text.contains("Postgres.app") {
        InstallSource::PostgresApp
    } else if text.contains("homebrew")
        || text.contains("Cellar")
        || text.starts_with("/usr/local/opt")
    {
        InstallSource::Homebrew
    } else {
        InstallSource::System
    }
}

/// `postgres (PostgreSQL) 16.4` → `16.4`.
async fn postgres_version(bin_dir: &Path) -> Option<String> {
    let mut cmd = process::command(bin_dir.join(exe("postgres")));
    cmd.arg("--version");
    let out = process::run(cmd, CMD_TIMEOUT).await.ok()?;
    parse_version(&out)
}

pub(crate) fn parse_version(output: &str) -> Option<String> {
    output
        .split_whitespace()
        .find(|t| t.chars().next().is_some_and(|c| c.is_ascii_digit()))
        .map(|t| {
            t.trim_end_matches(|c: char| !c.is_ascii_alphanumeric())
                .to_owned()
        })
}

/* ── Listening servers ────────────────────────────────────────────────── */

async fn probe_ports() -> Vec<ListeningServer> {
    let probes =
        PROBE_PORTS.map(|port| async move { is_postgres("127.0.0.1", port).await.then_some(port) });
    futures_util::future::join_all(probes)
        .await
        .into_iter()
        .flatten()
        .map(|port| ListeningServer {
            host: "127.0.0.1".into(),
            port,
            source: None,
            label: None,
        })
        .collect()
}

/// Sends a PostgreSQL `SSLRequest`. Any PostgreSQL server answers with a single `S` or `N`,
/// so this identifies a server without credentials and without logging anything on its side.
pub async fn is_postgres(host: &str, port: u16) -> bool {
    const SSL_REQUEST: [u8; 8] = [0, 0, 0, 8, 0x04, 0xD2, 0x16, 0x2F];
    let attempt = async {
        let mut stream = TcpStream::connect((host, port)).await.ok()?;
        stream.write_all(&SSL_REQUEST).await.ok()?;
        let mut reply = [0u8; 1];
        stream.read_exact(&mut reply).await.ok()?;
        Some(matches!(reply[0], b'S' | b'N'))
    };
    tokio::time::timeout(Duration::from_millis(800), attempt)
        .await
        .ok()
        .flatten()
        .unwrap_or(false)
}

/// True when nothing is listening on `127.0.0.1:port`.
pub fn port_is_free(port: u16) -> bool {
    std::net::TcpListener::bind(("127.0.0.1", port)).is_ok()
}

/// First free port starting at `start`.
pub fn first_free_port(start: u16) -> Option<u16> {
    (start..start.saturating_add(100)).find(|&p| port_is_free(p))
}

/* ── OS services ──────────────────────────────────────────────────────── */

struct ServiceInfo {
    name: String,
    running: bool,
    bin_dir: Option<String>,
    data_dir: Option<String>,
}

async fn list_services() -> Result<Vec<ServiceInfo>, String> {
    if cfg!(windows) {
        windows_services().await
    } else if cfg!(target_os = "macos") {
        brew_services().await
    } else {
        systemd_services().await
    }
}

async fn windows_services() -> Result<Vec<ServiceInfo>, String> {
    let mut cmd = process::command("powershell");
    cmd.args([
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        "Get-CimInstance Win32_Service -Filter \"Name LIKE 'postgresql%'\" | Select-Object Name,State,PathName | ConvertTo-Json -Compress",
    ]);
    let out = process::run(cmd, Duration::from_secs(8))
        .await
        .map_err(|e| format!("Could not list Windows services: {e}"))?;
    if out.is_empty() {
        return Ok(Vec::new());
    }
    let value: serde_json::Value =
        serde_json::from_str(&out).map_err(|e| format!("Unexpected service list: {e}"))?;
    let items = match value {
        serde_json::Value::Array(items) => items,
        single => vec![single],
    };
    Ok(items
        .iter()
        .map(|item| {
            let path = item["PathName"].as_str().unwrap_or_default();
            ServiceInfo {
                name: item["Name"].as_str().unwrap_or_default().to_owned(),
                running: item["State"].as_str() == Some("Running"),
                bin_dir: service_exe_dir(path),
                data_dir: service_data_dir(path),
            }
        })
        .collect())
}

/// `"C:\…\bin\pg_ctl.exe" runservice -N "x" -D "C:\…\data" -w` → `C:\…\bin`
fn service_exe_dir(path_name: &str) -> Option<String> {
    let exe_path = if let Some(rest) = path_name.strip_prefix('"') {
        rest.split('"').next()?
    } else {
        path_name.split(".exe").next()?
    };
    Path::new(exe_path)
        .parent()
        .map(|p| p.to_string_lossy().into_owned())
}

/// Extracts the value after `-D`, quoted or not.
fn service_data_dir(path_name: &str) -> Option<String> {
    let rest = path_name.split(" -D ").nth(1)?.trim_start();
    let value = if let Some(quoted) = rest.strip_prefix('"') {
        quoted.split('"').next()?
    } else {
        rest.split_whitespace().next()?
    };
    Some(value.to_owned())
}

async fn brew_services() -> Result<Vec<ServiceInfo>, String> {
    let mut cmd = process::command("brew");
    cmd.args(["services", "list", "--json"]);
    let out = process::run(cmd, CMD_TIMEOUT)
        .await
        .map_err(|_| "Homebrew not found, skipped Homebrew services".to_owned())?;
    let items: Vec<serde_json::Value> = serde_json::from_str(&out).unwrap_or_default();
    Ok(items
        .iter()
        .filter_map(|item| {
            let name = item["name"].as_str()?;
            name.starts_with("postgresql").then(|| ServiceInfo {
                name: name.to_owned(),
                running: item["status"].as_str() == Some("started"),
                bin_dir: None,
                data_dir: None,
            })
        })
        .collect())
}

async fn systemd_services() -> Result<Vec<ServiceInfo>, String> {
    let mut cmd = process::command("systemctl");
    cmd.args([
        "list-units",
        "--type=service",
        "--all",
        "--no-legend",
        "--plain",
        "postgresql*",
    ]);
    let out = process::run(cmd, CMD_TIMEOUT)
        .await
        .map_err(|_| "systemd not available, skipped services".to_owned())?;
    Ok(out
        .lines()
        .filter_map(|line| {
            let mut cols = line.split_whitespace();
            let name = cols.next()?.trim_end_matches(".service").to_owned();
            let _load = cols.next();
            let active = cols.next()?;
            Some(ServiceInfo {
                name,
                running: active == "active",
                bin_dir: None,
                data_dir: None,
            })
        })
        .collect())
}

fn merge_services(installs: &mut Vec<DetectedInstall>, services: Vec<ServiceInfo>) {
    for service in services {
        let by_dir = service.bin_dir.as_deref().and_then(|dir| {
            let key = normalize(Path::new(dir));
            installs
                .iter_mut()
                .find(|i| normalize(Path::new(&i.bin_dir)) == key)
        });
        // Without a path (brew/systemd), match on the major version in the service name
        let target = match by_dir {
            Some(install) => Some(install),
            None if service.bin_dir.is_none() => installs.iter_mut().find(|i| {
                i.service_name.is_none()
                    && i.version
                        .as_deref()
                        .and_then(|v| v.split('.').next())
                        .is_some_and(|major| service.name.contains(major))
            }),
            None => None,
        };

        match target {
            Some(install) => {
                install.service_name = Some(service.name);
                install.service_running = Some(service.running);
                if install.data_dir.is_none() {
                    install.data_dir = service.data_dir;
                }
            }
            None => {
                if let Some(bin_dir) = service.bin_dir {
                    installs.push(DetectedInstall {
                        version: None,
                        bin_dir,
                        data_dir: service.data_dir,
                        source: InstallSource::System,
                        service_name: Some(service.name),
                        service_running: Some(service.running),
                    });
                }
            }
        }
    }
}

/* ── Docker ───────────────────────────────────────────────────────────── */

/// Host ports of running containers whose image looks like PostgreSQL, with container names.
async fn list_docker() -> Result<Vec<(u16, String)>, String> {
    let mut cmd = process::command("docker");
    cmd.args(["ps", "--format", "{{.Names}}\t{{.Image}}\t{{.Ports}}"]);
    let out = process::run(cmd, CMD_TIMEOUT)
        .await
        .map_err(|_| "Docker not running or not installed, skipped containers".to_owned())?;
    Ok(out
        .lines()
        .filter_map(|line| {
            let mut cols = line.split('\t');
            let (name, image, ports) =
                (cols.next()?, cols.next()?, cols.next().unwrap_or_default());
            let image = image.to_lowercase();
            let looks_like_pg = ["postgres", "postgis", "timescale", "supabase/postgres"]
                .iter()
                .any(|needle| image.contains(needle));
            looks_like_pg.then(|| {
                docker_host_ports(ports)
                    .into_iter()
                    .map(|p| (p, name.to_owned()))
                    .collect::<Vec<_>>()
            })
        })
        .flatten()
        .collect())
}

/// `0.0.0.0:5433->5432/tcp, :::5433->5432/tcp` → `[5433]`
fn docker_host_ports(ports: &str) -> Vec<u16> {
    let mut found: Vec<u16> = ports
        .split(',')
        .filter_map(|mapping| {
            let (host, container) = mapping.trim().split_once("->")?;
            container.starts_with("5432/").then_some(())?;
            host.rsplit(':').next()?.parse().ok()
        })
        .collect();
    found.sort_unstable();
    found.dedup();
    found
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_postgres_version_output() {
        assert_eq!(
            parse_version("postgres (PostgreSQL) 16.4").as_deref(),
            Some("16.4")
        );
        assert_eq!(
            parse_version("postgres (PostgreSQL) 18.6").as_deref(),
            Some("18.6")
        );
        assert_eq!(
            parse_version("postgres (PostgreSQL) 17beta1").as_deref(),
            Some("17beta1")
        );
        assert_eq!(parse_version("garbage"), None);
    }

    #[test]
    fn sorts_versions_numerically() {
        let mut versions = vec![
            Some("9.6"),
            None,
            Some("16.9"),
            Some("16.10"),
            Some("17beta1"),
        ];
        versions.sort_by_cached_key(|v| std::cmp::Reverse(version_key(*v)));
        assert_eq!(
            versions,
            vec![
                Some("17beta1"),
                Some("16.10"),
                Some("16.9"),
                Some("9.6"),
                None
            ]
        );
    }

    #[test]
    fn managed_root_is_matched_by_path() {
        let root = std::env::temp_dir().join("pc-runtimes");
        assert_eq!(
            classify(&root.join("binaries/18/bin"), Some(&root)),
            InstallSource::Managed
        );
        assert_ne!(
            classify(&std::env::temp_dir().join("pc-runtimes2/bin"), Some(&root)),
            InstallSource::Managed
        );
    }

    #[test]
    fn parses_windows_service_path() {
        let path = r#""C:\Program Files\PostgreSQL\16\bin\pg_ctl.exe" runservice -N "postgresql-x64-16" -D "C:\Program Files\PostgreSQL\16\data" -w"#;
        assert_eq!(
            service_exe_dir(path).as_deref(),
            Some(r"C:\Program Files\PostgreSQL\16\bin")
        );
        assert_eq!(
            service_data_dir(path).as_deref(),
            Some(r"C:\Program Files\PostgreSQL\16\data")
        );
    }

    #[test]
    fn parses_docker_ports() {
        assert_eq!(
            docker_host_ports("0.0.0.0:5433->5432/tcp, :::5433->5432/tcp"),
            vec![5433]
        );
        assert_eq!(docker_host_ports("0.0.0.0:8080->80/tcp"), Vec::<u16>::new());
        assert_eq!(docker_host_ports(""), Vec::<u16>::new());
    }

    #[test]
    fn classifies_sources() {
        assert_eq!(
            classify(Path::new("/opt/homebrew/opt/postgresql@16/bin"), None),
            InstallSource::Homebrew
        );
        assert_eq!(
            classify(
                Path::new("/Applications/Postgres.app/Contents/Versions/16/bin"),
                None
            ),
            InstallSource::PostgresApp
        );
        assert_eq!(
            classify(Path::new("/usr/lib/postgresql/16/bin"), None),
            InstallSource::System
        );
    }

    #[tokio::test]
    async fn closed_port_is_not_postgres() {
        // Bind then drop to get a port that is almost certainly closed.
        let port = std::net::TcpListener::bind("127.0.0.1:0")
            .unwrap()
            .local_addr()
            .unwrap()
            .port();
        assert!(!is_postgres("127.0.0.1", port).await);
    }

    #[tokio::test]
    async fn detection_completes_quickly() {
        let report = detect(None).await;
        assert!(
            report.duration_ms < 15_000,
            "detection took {}ms",
            report.duration_ms
        );
    }
}
