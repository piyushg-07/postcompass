//! Platform specifics: which prebuilt binaries to download and how executables are named.

/// Rust target triple used by the prebuilt PostgreSQL binaries for this machine, if supported.
pub fn target_triple() -> Option<&'static str> {
    match (std::env::consts::OS, std::env::consts::ARCH) {
        ("windows", "x86_64") => Some("x86_64-pc-windows-msvc"),
        ("macos", "aarch64") => Some("aarch64-apple-darwin"),
        ("macos", "x86_64") => Some("x86_64-apple-darwin"),
        ("linux", "x86_64") if cfg!(target_env = "gnu") => Some("x86_64-unknown-linux-gnu"),
        ("linux", "aarch64") if cfg!(target_env = "gnu") => Some("aarch64-unknown-linux-gnu"),
        _ => None,
    }
}

/// Approximate download size for this platform (the Windows build bundles more tooling).
pub fn approx_download_mb() -> u32 {
    if cfg!(windows) { 54 } else { 13 }
}

/// `postgres` → `postgres.exe` on Windows.
pub fn exe(name: &str) -> String {
    if cfg!(windows) {
        format!("{name}.exe")
    } else {
        name.to_owned()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn current_platform_is_supported() {
        // CI and dev machines are all on supported platforms.
        assert!(target_triple().is_some());
    }

    #[test]
    fn exe_suffix_matches_platform() {
        assert_eq!(exe("psql").ends_with(".exe"), cfg!(windows));
    }
}
