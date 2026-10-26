//! The version manifest: which PostgreSQL releases PostCompass installs.
//!
//! Binaries come from https://github.com/theseus-rs/postgresql-binaries (MIT/Apache-2.0),
//! which publishes portable builds with a SHA-256 file for every archive.
//! Update this list to ship newer minor releases.

use pc_core::runtime::RuntimeVersion;

use crate::platform;

/// Newest release of each supported major, newest first. The first entry is recommended.
const RELEASES: &[&str] = &["18.6.0", "17.11.0", "16.15.0", "15.19.0", "14.24.0"];

const BASE_URL: &str = "https://github.com/theseus-rs/postgresql-binaries/releases/download";

pub fn available() -> Vec<RuntimeVersion> {
    if platform::target_triple().is_none() {
        return Vec::new();
    }
    RELEASES
        .iter()
        .enumerate()
        .map(|(index, version)| RuntimeVersion {
            version: (*version).to_owned(),
            major: major_of(version),
            recommended: index == 0,
            download_mb: Some(platform::approx_download_mb()),
            installed: false,
        })
        .collect()
}

pub fn is_known(version: &str) -> bool {
    RELEASES.contains(&version)
}

pub fn major_of(version: &str) -> u32 {
    version
        .split('.')
        .next()
        .and_then(|m| m.parse().ok())
        .unwrap_or(0)
}

/// Archive file name for this platform, e.g. `postgresql-18.6.0-x86_64-pc-windows-msvc.tar.gz`.
pub fn archive_name(version: &str, triple: &str) -> String {
    format!("postgresql-{version}-{triple}.tar.gz")
}

pub fn archive_url(version: &str, triple: &str) -> String {
    format!("{BASE_URL}/{version}/{}", archive_name(version, triple))
}

pub fn checksum_url(version: &str, triple: &str) -> String {
    format!("{}.sha256", archive_url(version, triple))
}

/// Extracts the hash from a `.sha256` file. Handles both `sha256sum` output and the
/// Windows `CertUtil` format, where the hash is on its own line.
pub fn parse_checksum(text: &str) -> Option<String> {
    text.split(|c: char| c.is_whitespace() || c == ':')
        .find(|token| token.len() == 64 && token.chars().all(|c| c.is_ascii_hexdigit()))
        .map(str::to_ascii_lowercase)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_certutil_format() {
        let text = "SHA256 hash of postgresql-18.6.0-x86_64-pc-windows-msvc.tar.gz:\n\
                    7da44c2dbcda3b49688ea08ce8cf99cfe677adf565f53a9145bf9002c74db7d5\n\
                    CertUtil: -hashfile command completed successfully.";
        assert_eq!(
            parse_checksum(text).as_deref(),
            Some("7da44c2dbcda3b49688ea08ce8cf99cfe677adf565f53a9145bf9002c74db7d5")
        );
    }

    #[test]
    fn parses_sha256sum_format() {
        let text = "ABCDEF0123456789abcdef0123456789abcdef0123456789abcdef0123456789  file.tar.gz";
        assert_eq!(
            parse_checksum(text).as_deref(),
            Some("abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789")
        );
    }

    #[test]
    fn rejects_text_without_hash() {
        assert_eq!(parse_checksum("not found"), None);
    }

    #[test]
    fn first_release_is_recommended() {
        let versions = available();
        assert!(versions[0].recommended);
        assert!(versions.iter().skip(1).all(|v| !v.recommended));
        assert_eq!(versions[0].major, 18);
    }

    #[test]
    fn builds_download_urls() {
        assert_eq!(
            archive_url("18.6.0", "x86_64-unknown-linux-gnu"),
            "https://github.com/theseus-rs/postgresql-binaries/releases/download/18.6.0/postgresql-18.6.0-x86_64-unknown-linux-gnu.tar.gz"
        );
    }
}
