# Security Policy

PostCompass handles database credentials and runs database servers on your machine, so security reports are taken seriously. Thank you for helping keep users safe.

## Supported versions

PostCompass is in early development. Only the **latest release** receives security fixes. Please update to the [latest version](https://github.com/piyushg-07/postcompass/releases/latest) before reporting, and check whether the issue still reproduces on `main` if you can.

| Version | Supported |
|---|---|
| Latest release | ✅ |
| Older releases | ❌ |

## Reporting a vulnerability

**Please do not report security issues in public issues, discussions or pull requests.**

Report privately through GitHub:

1. Go to the [Security tab](https://github.com/piyushg-07/postcompass/security) of the repository.
2. Click **Report a vulnerability** and fill in the form.

If that isn't possible, email **[guptapiyush315@gmail.com](mailto:guptapiyush315@gmail.com)** with "PostCompass security" in the subject.

Please include:

- The PostCompass version, OS and installer type (`.exe`, `.dmg`, `.AppImage`, `.deb`, `.rpm`)
- A description of the issue and its impact
- Steps to reproduce or a proof of concept
- Any suggested fix, if you have one

## What to expect

PostCompass is maintained by one person, so these are best-effort targets:

- **Acknowledgement** within 3 working days.
- **Initial assessment** (confirmed or not, and severity) within 7 days.
- **Fix** in a new release as soon as practical, prioritised by severity. You'll be kept updated along the way.
- **Credit** in the release notes and the advisory, if you'd like it.

Please give us a reasonable chance to release a fix before disclosing publicly. Coordinated disclosure is handled through a GitHub Security Advisory.

## Security model

A short overview of how PostCompass protects your data, so you know what to expect and what counts as a vulnerability.

### Credentials

- Passwords for local servers and remote connections are stored in the **OS keychain**: Windows Credential Manager, macOS Keychain or the Linux Secret Service (via the [`keyring`](https://crates.io/crates/keyring) crate).
- Passwords are **never written to `state.json`** or any other file in the app data folder. That file holds only non-secret settings and connection metadata.

### Managed local servers

- Servers that PostCompass installs listen on **`127.0.0.1` only** (`listen_addresses = '127.0.0.1'`), so they aren't reachable from other machines.
- They're initialized with **`scram-sha-256`** password authentication.
- They run as your user, with no admin rights required.

### PostgreSQL downloads

- PostgreSQL binaries are downloaded over **HTTPS** from [theseus-rs/postgresql-binaries](https://github.com/theseus-rs/postgresql-binaries) GitHub releases.
- Each archive is **verified against its published SHA-256 checksum** before it's extracted. The checksum file comes from the same release, so this protects against corrupted or tampered downloads in transit, not against a compromise of that upstream release itself.

### Remote connections

- Encryption modes: Off, Prefer, Require and Verify certificate (with your provider's CA bundle). Use **Verify certificate** for full protection against man-in-the-middle attacks; Prefer and Require encrypt the connection but don't check the server's identity.

### The app itself

- The webview runs under a **strict Content Security Policy** (`default-src 'self'`; scripts only from the app bundle; network access only to the Tauri IPC bridge).
- The UI has a minimal set of Tauri permissions: core APIs, revealing files in your file manager, and open/save file dialogs.
- Installers are **not yet code-signed**. Only download PostCompass from the official [Releases page](https://github.com/piyushg-07/postcompass/releases).
- **In-app updates** are signed: each update package is verified against a public key built into the app before it's installed, so a tampered download is rejected.

### Privacy

PostCompass **sends no telemetry, analytics or crash reports**. The app makes only these network connections:

- To the **database servers you connect to**.
- To **GitHub** (`github.com/theseus-rs/postgresql-binaries`) when you install a local PostgreSQL version, to download the archive and its checksum.
- To **GitHub** (`github.com/piyushg-07/postcompass/releases`) shortly after launch, to check for a newer PostCompass version, and to download it if you choose to update.

Fonts and all UI assets are bundled with the app; the UI loads nothing from the internet.

## Out of scope

- Attacks that need an already compromised machine or user account (for example, reading the OS keychain as the logged-in user).
- Vulnerabilities in PostgreSQL itself or in your database provider; please report those upstream.
- SmartScreen / Gatekeeper warnings caused by the installers not being code-signed (a known limitation).
