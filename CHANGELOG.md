# Changelog

All notable changes to PostCompass are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-10-25

The first public release of PostCompass, a fast, modern desktop app for PostgreSQL on Windows, macOS and Linux.

### Added

#### Getting started

- Guided first-run setup: a few quick questions about you and how you'll use PostCompass, then install PostgreSQL in one click or skip it.
- Settings page with your profile (name, role, setup date), app preferences and version info.

#### Local databases

- One-click install of PostgreSQL 14, 15, 16, 17 or 18, with SHA-256 verified binaries and no admin rights needed.
- Start, stop and remove managed servers.
- Create, rename and drop databases and schemas.
- Backup and restore with bundled `pg_dump` / `pg_restore`.

#### Cloud connections

- Connect to AWS RDS / Aurora, Google Cloud SQL, Azure, Alibaba Cloud, Oracle Cloud, DigitalOcean, Heroku Postgres, Neon, Railway, Render, Cloudflare Hyperdrive or any PostgreSQL server.
- Sensible defaults per provider, such as port 25060 for DigitalOcean.
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
- Home page with all local and cloud connections.
- Dark, Supabase-inspired UI.
- Installers for Windows (`.exe`, `.msi`), macOS Apple Silicon and Intel (`.dmg`, ad-hoc signed) and Linux (`.AppImage`, `.deb`, `.rpm`), built by GitHub Actions.
- Contributor docs: `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, issue forms and a pull request template.

[Unreleased]: https://github.com/piyushg-07/postcompass/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/piyushg-07/postcompass/releases/tag/v0.1.0
