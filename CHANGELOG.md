# Changelog

All notable changes to PostCompass are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Contributor docs: `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, issue forms and a pull request template.

### Removed

- Unused `apps/docs` starter site.

## [0.1.0] - 2026-10-23

The first public release of PostCompass, a fast, modern desktop app for PostgreSQL on Windows, macOS and Linux.

### Added

#### Local databases

- One-click install of PostgreSQL 18, with SHA-256 verified binaries and no admin rights needed.
- Start, stop and remove managed servers; detect existing PostgreSQL installs.
- Create, rename and drop databases and schemas.
- Backup and restore with bundled `pg_dump` / `pg_restore`.

#### Cloud connections

- Connect to AWS RDS / Aurora, Google Cloud SQL, Azure, Supabase, Neon, Cloudflare Hyperdrive, Railway, Render or any PostgreSQL server.
- Encryption modes: Off, Prefer, Require and Verify certificate (with a CA bundle).
- Test a connection before saving; passwords stored in the OS keychain.
- Keep several connections open in the sidebar at once.

#### Table editor

- Supabase-style data grid with inline editing that saves instantly, including setting cells to `NULL`.
- Filter bar, multi-column sort and pagination.
- Insert and edit rows in a side panel and follow foreign keys to the linked record.
- Freeze, hide and reorder columns; column statistics from the column header.
- Paste rows from a spreadsheet and import rows from a CSV file.
- Copy or export selected rows as CSV, JSON or SQL.

#### Schema tools

- Create tables and columns visually (types, defaults, primary key, unique, identity, RLS).
- Structure tab with indexes, foreign keys, constraints and triggers.
- Create, edit and delete functions, triggers, enums, sequences and extensions.
- Policies page to manage Row Level Security.

#### SQL editor

- CodeMirror editor with autocomplete for your tables and columns.
- Run everything or just the selection (`Ctrl+Enter`), with multiple result sets in tabs.
- Visual `EXPLAIN` / `EXPLAIN ANALYZE` that highlights the slowest step.
- Query history, saved snippets, result charts and export.

#### Everything else

- Interactive ER diagram with draggable tables, column-to-column links, focus mode and a minimap.
- Command palette (`Ctrl+K`) to jump to any table, database or action.
- Connect panel with connection strings and snippets for Node.js, Python, Prisma, Drizzle and Go.
- Home page with all local and cloud connections, plus onboarding for first-time users.
- Dark, Supabase-inspired UI.
- Installers for Windows (`.exe`, `.msi`), macOS Apple Silicon and Intel (`.dmg`) and Linux (`.AppImage`, `.deb`, `.rpm`), built by GitHub Actions.

[Unreleased]: https://github.com/piyushg-07/postcompass/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/piyushg-07/postcompass/releases/tag/v0.1.0
