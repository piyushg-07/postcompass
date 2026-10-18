# PostCompass: Product & Build Plan

> A modern database management platform: a better pgAdmin with a smart layer on top.
> **Desktop only** (Mac, Windows, Linux). There is no web version. Postgres first, built so more databases can be added later.

---

## 1. Goals for the first release

The first release builds only the foundation. Features come later.

| # | Goal | Done when… |
|---|------|------------|
| 1 | **Design system** | Shared tokens and core components (Button, Toast, Input, …) used by every screen |
| 2 | **App shell** | Desktop app opens with the PostCompass window, sidebar, routing, and theme |
| 3 | **Onboarding** | First launch asks a few questions and saves the answers locally |
| 4 | **Postgres detection** | The app finds Postgres installs and running servers already on the machine |
| 5 | **Postgres installation** | A user without Postgres gets a working local server in one click, with no admin rights needed |
| 6 | **Empty-state dashboard** | After setup, a clean dashboard shows the local server status and "Add connection" |

**Out of scope for now:** the query editor, table browser, and other features (see §12, to be discussed later).

---

## 2. Core principle: modular by design

Everything database-specific sits behind an interface. Adding MySQL or SQLite later should mean
**adding a crate and registering it**. The UI and the shell should not need to change.

Since the app is desktop-only, all database logic lives in **Rust inside the Tauri app**. There is no separate server, no sidecar, and no HTTP layer.
The React UI calls Rust through Tauri commands.

There are two interfaces, with one implementation per database:

| Layer | What it does | Crate |
|-------|--------------|-------|
| **Driver** | Connect, test, query, introspect (list DBs, schemas, tables), for **any** server: local or remote | `driver-postgres` |
| **Local runtime** | Detect, install, start, stop, and uninstall a database on *this* machine | `runtime-postgres` |

```
DatabaseDriver  ──►  PostgresDriver   (later: MySqlDriver, SqliteDriver …)
LocalRuntime    ──►  PostgresRuntime  (later: MySqlRuntime …)
```

### 2.1 Driver interface (Rust, `crates/pc-core`)

```rust
#[derive(Serialize, Deserialize, specta::Type)]
pub enum DatabaseKind { Postgres /* later: MySql, Sqlite … */ }

#[derive(Serialize, specta::Type)]
pub struct DriverCapabilities {
    pub schemas: bool,          // Postgres: yes, MySQL: no (databases only)
    pub roles: bool,
    pub extensions: bool,
    pub explain_analyze: bool,
    pub listen_notify: bool,
    // UI shows or hides features based on these flags. It never checks kind == Postgres.
}

#[async_trait]
pub trait DatabaseDriver: Send + Sync {
    fn kind(&self) -> DatabaseKind;
    fn display_name(&self) -> &'static str;               // "PostgreSQL"
    fn default_port(&self) -> u16;                        // 5432
    fn capabilities(&self) -> DriverCapabilities;
    fn connection_fields(&self) -> Vec<FieldSpec>;        // generates the "Add connection" form automatically

    async fn test_connection(&self, cfg: &ConnectionConfig) -> Result<TestResult>; // version, latency
    async fn connect(&self, cfg: &ConnectionConfig) -> Result<Box<dyn DriverSession>>;
}

#[async_trait]
pub trait DriverSession: Send + Sync {
    async fn query(&self, sql: &str, params: &[Value], cancel: CancelToken) -> Result<QueryResult>;
    async fn databases(&self) -> Result<Vec<DatabaseInfo>>;
    async fn schemas(&self, db: &str) -> Result<Vec<SchemaInfo>>;
    async fn tables(&self, db: &str, schema: &str) -> Result<Vec<TableInfo>>;
    async fn close(&self) -> Result<()>;
}
```

**Postgres driver:** `tokio-postgres` + `deadpool-postgres` (pooling) + `rustls` (TLS).
`tokio-postgres` handles arbitrary user SQL and dynamic column types better than `sqlx`,
which is built around queries known at compile time.

### 2.2 Local runtime interface (Rust, `crates/pc-core`)

```rust
#[async_trait]
pub trait LocalRuntime: Send + Sync {
    fn kind(&self) -> DatabaseKind;
    async fn detect(&self) -> Result<Vec<DetectedInstall>>;          // §6
    async fn available_versions(&self) -> Result<Vec<Version>>;
    async fn install(&self, opts: InstallOptions,
                     progress: Channel<InstallEvent>) -> Result<ManagedServer>; // §7
    async fn start(&self, id: &ServerId) -> Result<()>;
    async fn stop(&self, id: &ServerId) -> Result<()>;
    async fn status(&self, id: &ServerId) -> Result<ServerStatus>;
    async fn uninstall(&self, id: &ServerId, keep_data: bool) -> Result<()>;
}
```

The **registry** (`Registry::new().driver(PostgresDriver).runtime(PostgresRuntime)`) in `src-tauri/src/lib.rs`
is the only place new databases get wired in.

---

## 3. Architecture

```
┌──────────────────────────── PostCompass (Tauri) ─────────────────────────────┐
│                                                                              │
│  React UI (apps/desktop/src)                                                 │
│     │  typed commands (tauri-specta)        ▲ events / Channels              │
│     ▼                                       │ (install progress, status)     │
│  Rust core (src-tauri)                                                       │
│   ├─ Registry ── DatabaseDriver ── PostgresDriver ──────► Postgres           │
│   │           └─ LocalRuntime  ── PostgresRuntime ─┐      (local or remote)  │
│   ├─ Connection manager (pools, cancel)            │                         │
│   ├─ Secrets (OS keychain)                         ▼                         │
│   ├─ App store (prefs, onboarding, connections)  Managed Postgres binaries   │
│   └─ Updater                                     in app data folder          │
└──────────────────────────────────────────────────────────────────────────────┘
```

Why everything is in Rust:

- **Small and fast:** no Node runtime bundled. The installer stays small, around 10–15 MB, and the Postgres binaries are downloaded only when needed.
- **Secure:** database passwords never pass through a local HTTP port. They go from the keychain straight to Rust.
- **Typed end to end:** `tauri-specta` generates TypeScript types for every command and event from the Rust structs, so the UI and Rust can't drift apart.

---

## 4. Repo layout (target)

```
postcompass/
├── apps/
│   └── desktop/                     The app
│       ├── src/                     React UI
│       │   ├── app/                 Router, providers, AppShell
│       │   ├── features/
│       │   │   ├── onboarding/
│       │   │   ├── servers/         Detection, install, start/stop
│       │   │   ├── connections/     Add / test / list connections
│       │   │   └── dashboard/
│       │   ├── lib/
│       │   │   ├── bindings.ts      ← generated by tauri-specta (do not edit)
│       │   │   └── ipc.ts           Thin wrappers + error → toast mapping
│       │   └── playground/          Dev-only component gallery
│       └── src-tauri/
│           ├── Cargo.toml           Workspace member
│           └── src/
│               ├── lib.rs           Registry + plugin setup
│               ├── commands/        Tauri commands (thin: validate → call crate)
│               ├── secrets.rs       OS keychain (keyring crate)
│               └── store.rs         App state
│
├── crates/                          Rust workspace (modular DB code)
│   ├── pc-core/                     Traits + shared types (DatabaseDriver, LocalRuntime, errors)
│   ├── driver-postgres/             PostgresDriver
│   └── runtime-postgres/            PostgresRuntime (detect.rs, install.rs, process.rs)
│
├── packages/
│   ├── ui/                          Design tokens + components (Button, Toast …)
│   ├── eslint-config/
│   └── typescript-config/
│
├── Cargo.toml                       Rust workspace root
└── docs/
    └── PLAN.md                      ← this file
```

**To remove in Phase 0:** `apps/web`, `apps/docs`, and `apps/server`. These were for a web version that is no longer planned.
If a cloud backend is needed later (accounts, licensing, sync), it can be added back as a separate app.

**To replace:** the current `packages/ui` from the create-turbo template gets replaced by the design system in §5.

Turborepo stays. It runs the UI tasks (`dev`, `build`, `lint`, `check-types`) and caches `packages/ui`. Cargo handles the Rust side.

---

## 5. Design system

### 5.1 Theme: pure black + emerald (Supabase-style)

Dark only for now. All colors are CSS variables in `packages/ui/src/styles/tokens.css`, exposed to Tailwind v4 via `@theme`.

| Token | Value | Use |
|-------|-------|-----|
| `--bg` | `#020202` | App background |
| `--surface` | `#0a0a0a` | Sidebar, cards, panels |
| `--surface-raised` | `#111111` | Dialogs, popovers, dropdowns |
| `--surface-hover` | `#171717` | Hover on rows / ghost buttons |
| `--border` | `#1f1f1f` | Default borders, dividers |
| `--border-strong` | `#2e2e2e` | Inputs, focused containers |
| `--text` | `#ededed` | Primary text |
| `--text-muted` | `#a1a1a1` | Secondary text, labels |
| `--text-subtle` | `#6b6b6b` | Placeholders, hints, disabled |
| `--accent` | `#3ecf8e` | **Emerald, used sparingly (rules below)** |
| `--accent-hover` | `#36b97e` | Primary button hover |
| `--accent-muted` | `rgba(62,207,142,0.10)` | Active nav background, success toast tint |
| `--accent-fg` | `#020202` | Text on emerald buttons |
| `--danger` | `#f0616d` | Errors, destructive actions |
| `--warning` | `#f5b544` | Warnings |
| `--info` | `#5ea8f0` | Neutral info |

**Emerald is used only for:**
1. The **primary action** on a screen (one per view)
2. **Focus rings** (keyboard accessibility)
3. **Success / running** status (status dots, success toasts, "Connected")
4. The **active / selected** indicator (current nav item, selected step)
5. Inline **links**

Everything else stays neutral black, grey, or white. If emerald appears in more than about 3 places on a screen, it's being overused.

**Type:** Inter (UI) + JetBrains Mono (SQL, logs, ports, versions). Base size 14px.
**Radius:** 6px (controls), 10px (cards / dialogs). **Spacing:** 4px scale. **Motion:** 120–200ms ease-out, and none when `prefers-reduced-motion` is set.

### 5.2 Component stack

- **Tailwind CSS v4** with tokens
- **Radix UI primitives**, for accessibility (focus, keyboard, ARIA) at no extra effort
- **class-variance-authority** for variants
- **lucide-react** for icons
- Components are **owned by us** in `packages/ui`, not a black-box library

### 5.3 Component list (build first)

| Component | Variants / notes |
|-----------|------------------|
| **Button** | `primary` (emerald), `secondary` (surface + border), `ghost`, `danger`, `link`; sizes `sm/md/lg`; `loading` (spinner, keeps width), `iconLeft/iconRight` |
| **IconButton** | Square ghost button + required `aria-label` + tooltip |
| **Toast** | `toast.success / error / info / warning / loading`, `toast.promise(p, {loading, success, error})`; bottom-right stack, max 3, action button, auto-dismiss 4s (errors stay until closed) |
| **Input / PasswordInput** | Label, hint, error text; password shows/hides + "generate" |
| **Select, Checkbox, Switch, RadioCard** | RadioCard = big selectable card used in onboarding |
| **Dialog / ConfirmDialog** | Destructive confirm with typed confirmation for dangerous actions |
| **Tooltip, Kbd** | `Ctrl/⌘ + K` hints |
| **Badge / StatusDot** | `running` (emerald), `stopped` (grey), `error` (red), `starting` (pulsing) |
| **Card, Separator, Tabs** | |
| **Stepper** | Onboarding progress (`Step 2 of 5`) |
| **Progress / Spinner / Skeleton** | Determinate progress for downloads |
| **LogViewer** | Mono, auto-scroll, copy button. Shows installer output |
| **EmptyState** | Icon + title + description + primary/secondary action |
| **AppShell / Sidebar / Topbar** | Layout primitives |

**Component playground:** a dev-only `/playground` route in the desktop app that renders every component in every state.
It's lighter than Storybook, and enough for now.

---

## 6. Postgres detection

On onboarding (and later from Settings → "Scan again"), the Rust `PostgresRuntime::detect()` checks:

| Check | Windows | macOS | Linux |
|-------|---------|-------|-------|
| Binaries on PATH | `psql`, `pg_ctl`, `postgres` | same | same |
| Common install dirs | `C:\Program Files\PostgreSQL\*\bin` | `/Applications/Postgres.app`, `/opt/homebrew/opt/postgresql@*`, `/usr/local/opt/postgresql@*` | `/usr/lib/postgresql/*/bin`, `/usr/pgsql-*/bin` |
| Services | `sc query` (postgresql-x64-*) | `brew services list`, `launchctl` | `systemctl list-units 'postgresql*'` |
| Listening ports | TCP probe on 5432–5440 (localhost only) | same | same |
| Docker | `docker ps` for postgres images (if docker exists) | same | same |
| Our own managed servers | From app config | same | same |

The result is a list of `DetectedInstall { version, bin_dir, data_dir?, port?, running, source }`, where
`source` is one of `system`, `homebrew`, `postgres_app`, `docker`, `managed`.

**UX outcomes:**
- **Found + running:** "We found PostgreSQL 16.4 running on port 5432." → **[Connect to it]** / [Install a separate one]
- **Found, not running:** offer to connect later, or install a managed one
- **Not found:** go straight to the install step (recommended path)

Detection must be **read-only and fast**: under 2s total, with each check timeboxed. It must never prompt for admin rights.

---

## 7. Postgres installation

### 7.1 Strategy: a "managed" install in the user's own space (default)

PostCompass downloads the **official prebuilt Postgres binaries** for the user's OS and CPU, then:
1. **Verifies** the SHA-256 checksum
2. **Extracts** to the app data folder, e.g. `%APPDATA%/PostCompass/runtimes/postgres/18.x/`
3. Runs **`initdb`** into `…/data/<server-id>/` with `scram-sha-256` auth and UTF-8
4. **Starts** it with `pg_ctl`, bound to **127.0.0.1 only**
5. Runs a **health check** (`SELECT version()`), then saves it as a connection automatically

Why this approach:

- **No admin / sudo needed** and no system-wide changes
- **Never conflicts** with an existing Postgres: if 5432 is taken, the app picks the next free port
- **Same flow on all 3 OSes**
- **Clean uninstall:** delete the folder, optionally keeping the data

**Implementation:** spike the `postgresql_embedded` Rust crate (theseus-rs). It downloads, verifies, runs initdb, and handles start/stop for Windows, macOS (Intel + Apple Silicon), and Linux.
Wrap it behind `LocalRuntime` so it can be replaced later if needed.

**Spike checklist:** licence, platform coverage, offline cache, Windows VC++ runtime needs, Linux glibc/musl.

**Advanced option (later):** "Install system-wide instead" through the OS package manager
(`winget install PostgreSQL.PostgreSQL.<ver>` / `brew install postgresql@<ver>` / `apt` / `dnf`).
This needs admin rights, so it's not the default.

### 7.2 Install options shown to the user

| Option | Default | Notes |
|--------|---------|-------|
| Version | Latest stable major (pinned in a version manifest we control) | Dropdown of supported majors |
| Port | 5432, or the next free one | Validated live |
| Superuser password | Auto-generated (24 chars) | Stored in the **OS keychain**, never in plain text; "Show / copy" available |
| Data location | App data folder | "Change…" for advanced users |
| Start with PostCompass / on login | On / Off | |

Most users just click **Install**. The defaults are designed to be correct.

### 7.3 Install progress screen

Steps are streamed from Rust to the UI via a Tauri `Channel<InstallEvent>`:

```
✓ Checking system         (disk space ≥ 1 GB, arch, port)
✓ Downloading PostgreSQL  ████████████░░░░  64%  · 18.2 / 28.4 MB
○ Verifying checksum
○ Setting up database     (initdb)
○ Starting server
○ Connecting

[ Show details ▾ ]   ← LogViewer with raw output
[ Cancel ]
```

### 7.4 Failure handling (must have)

| Situation | Behaviour |
|-----------|-----------|
| No internet / proxy | Clear error + retry; respect system proxy |
| Download interrupted | Resume if possible, otherwise clean restart |
| Checksum mismatch | Delete the file, don't continue, show error |
| Port taken mid-install | Pick the next free port automatically and tell the user |
| Not enough disk space | Check before downloading |
| Antivirus blocks `postgres.exe` (Windows) | Detect start failure, show help text |
| User cancels | Stop and remove partial files (rollback) |
| Any step fails | Roll back to a clean state; "Copy error details" for support |

### 7.5 After install: process management

- Server status on the dashboard: Running / Stopped / Error, with Start, Stop, and Restart
- On app quit, the managed server stops by default (setting: "Keep running in background")
- On app start, the server auto-starts if enabled
- **Uninstall** offers "Keep my data" / "Delete everything" (typed confirmation)

---

## 8. Onboarding flow (first launch)

Five short screens, each skippable with sensible defaults. The Stepper sits at the top. Answers are saved locally with `tauri-plugin-store`.

```
1. Welcome            2. About you          3. How you'll use it   4. Postgres check        5. Ready
┌──────────────┐     ┌──────────────┐      ┌──────────────┐       ┌──────────────┐        ┌──────────────┐
│ PostCompass  │     │ Your name    │      │ ◉ Local dev  │       │ Scanning…    │        │ ✓ All set    │
│ Manage Post- │ ──► │ Role ▾       │ ───► │ ○ Remote DBs │ ────► │ found / not  │ ─────► │ Open         │
│ gres, better │     │ Experience   │      │ ○ Both       │       │ found →      │        │ dashboard →  │
│ [Get started]│     │ ○○○          │      │ ○ Learning   │       │ install (§7) │        │              │
└──────────────┘     └──────────────┘      └──────────────┘       └──────────────┘        └──────────────┘
```

**Questions:**
1. **Name** (optional): used for the greeting
2. **Role:** Developer · Data / Analyst · DBA · Student · Other
3. **Experience with Postgres:** New · Some · Expert. This sets the defaults: beginners see more hints, experts get a denser UI.
4. **Use case:** Local development · Manage remote servers · Both · Learning SQL
5. **Anonymous usage stats:** **off by default**, opt-in only

The **Postgres check** (step 4) runs detection (§6) and branches:
- Found → "Connect to existing" or "Install a separate one"
- Not found → install (§7)
- "Skip, I'll connect to a remote server" → straight to the dashboard

---

## 9. Empty-state dashboard (after setup)

```
┌───────────┬──────────────────────────────────────────────────────────────┐
│ ◆ PostCo… │  Good evening, <name>                        ⌘K  Search…     │
│           ├──────────────────────────────────────────────────────────────┤
│ ▣ Home    │  ┌─ Local server ─────────────────────────────────────────┐  │
│ ⛁ Connect │  │ ● Running   PostgreSQL 18.0 · localhost:5432           │  │
│ ⚙ Servers │  │ [Open]  [Stop]  [Copy connection string]               │  │
│           │  └────────────────────────────────────────────────────────┘  │
│           │                                                              │
│           │              ⛁                                               │
│           │       No connections yet                                     │
│           │   Connect to a database to start exploring.                  │
│           │   [+ Add connection]   [Install local Postgres]              │
│           │                                                              │
│ ⚙ Settings│  Recent activity — nothing yet                               │
└───────────┴──────────────────────────────────────────────────────────────┘
```

- **Sidebar:** Home, Connections, Servers (local runtimes), Settings. The active item gets the emerald indicator.
- **Local server card:** only shown when a managed or detected server exists
- **Add connection:** a dialog generated from the driver's `connection_fields()`. It has Host/Port/User/Password/DB/SSL fields, a connection-string paste box, and **Test connection** (toast with version + latency).
- **⌘K command palette:** shell only for now, so features can plug in later
- **Settings:** Postgres servers, data folder, start-on-login, telemetry, about/version

---

## 10. Security baseline

- **Passwords** live in the OS keychain (`keyring` crate: Windows Credential Manager / macOS Keychain / libsecret). Config files only store a reference.
- **Managed Postgres** listens on `127.0.0.1` only, with `scram-sha-256` auth and no `trust` auth.
- **No local network ports opened by the app:** UI ↔ Rust talks over Tauri IPC only. Passwords are read from the keychain in Rust and are never sent to the UI.
- **Downloads** are always checksum-verified, over HTTPS only.
- **Tauri:** least-privilege capabilities (only the commands we need) and a strict **CSP** (currently `null`, must be set).
- **Remote connections:** SSL modes supported from day one (`disable/require/verify-full`).

---

## 11. Build phases

Each phase ends with something visible and testable.

| Phase | Scope | Deliverable / acceptance |
|-------|-------|--------------------------|
| **0. Prerequisites** | Install Rust + MSVC build tools; remove `apps/web`, `apps/docs`, `apps/server`; set up the Cargo workspace (`crates/`) + `tauri-specta`; add Tailwind v4 | `pnpm dev` opens the Tauri window |
| **1. Design system** | Tokens, fonts, Button, Toast, Input, Dialog, StatusDot, Stepper, Progress, EmptyState, LogViewer; `/playground` | Every component in every state visible in the playground, keyboard accessible |
| **2. App shell + onboarding UI** | Routing, AppShell/Sidebar, onboarding screens with mocked data, app store | Complete onboarding click-through (mocked) on desktop; answers persist across restarts |
| **3. Detection** | `pc-core` traits, `PostgresRuntime::detect()` for all 3 OSes, Tauri command | Correct results on a machine with and without Postgres (each OS) |
| **4. Installer** | Spike `postgresql_embedded` → install, progress channel, rollback, keychain, start/stop, port picking | Fresh machine → running local Postgres in one click on Win/Mac/Linux, no admin |
| **5. Postgres driver + connections** | `driver-postgres` (tokio-postgres, pooling, TLS, cancel), connection manager, `test_connection`, save connections (secrets in keychain) | "Test connection" works against the local server and a remote DB (incl. SSL) |
| **6. Dashboard** | Empty states, local server card (live status), Add connection dialog, Settings basics | Matches §9; start/stop reflects real state |
| **7. Ship** | GitHub Actions matrix build (win/mac/linux), code signing (Windows) + notarization (macOS), `tauri-plugin-updater` | Signed installers for all 3 OSes; auto-update works |

**Suggested order:** do Phases 1 and 2 in parallel with the Phase 4 *spike*, since the installer carries the most risk and should be checked early.

### Status (2026-10-18)

| Phase | Status | Notes |
|-------|--------|-------|
| 0 | ✅ Done | Rust workspace, `pc-core`, tauri-specta bindings, Tailwind v4 + tokens. Cargo build output lives outside OneDrive (`.cargo/config.toml`, machine-local). |
| 1 | ✅ Done | All components in `packages/ui`, gallery under **Components** in the sidebar (dev builds only). Token names use `fg` (`text-fg`, `text-fg-muted`) instead of `text` to avoid clashing with Tailwind's `text-*`. |
| 2 | ✅ Done | Onboarding (5 steps) → shell with Home / Servers / Settings. State in `state.json` in the app config folder. |
| 3 | ✅ Done | `runtime-postgres/src/detect.rs`. PostgreSQL handshake probe on 5432–5442, PATH + common dirs, Windows/Homebrew/systemd services, Docker. |
| 4 | ✅ Done | Own installer instead of `postgresql_embedded` (needed progress events, resume and cancel). Binaries from theseus-rs/postgresql-binaries, SHA-256 verified. End-to-end test: `cargo test -p runtime-postgres --test install_e2e -- --ignored`. Custom data folder is supported in the backend but not yet in the UI (needs a folder picker). |
| 5 | 🟡 Local done | `DatabaseDriver` in `pc-core`, `crates/driver-postgres` (tokio-postgres). **Open** on a running local server → Explorer (databases → schemas → tables) using the keychain password. `test_connection` command exists. **Next:** Add-connection form, saved remote connections (passwords in keychain), SSL/TLS for cloud. |

---

## 12. Feature backlog (to discuss later)

Candidates for the "better than pgAdmin" layer. These are not committed yet:

- SQL editor (Monaco), autocomplete from the schema, multiple tabs, saved queries, history
- Table browser with inline editing, filters, and safe-edit (preview SQL before applying)
- Visual schema / ER diagram
- EXPLAIN ANALYZE visualiser
- Roles & permissions manager
- Extensions manager
- Backups & restore (pg_dump / pg_restore) with schedules
- Live monitoring: connections, locks, slow queries, table bloat
- AI assistant: natural language → SQL, explain query, index suggestions
- Multiple local Postgres versions side by side
- Import/export CSV / JSON

---

## 13. Open decisions

| # | Decision | Recommendation |
|---|----------|----------------|
| 1 | Postgres client crate | `tokio-postgres` + `deadpool-postgres`; confirm in Phase 5 |
| 2 | Large query results | Stream rows to the UI in pages over a Tauri `Channel` (needed once the query editor lands) |
| 3 | Default Postgres version | Latest stable major, controlled by our version manifest |
| 4 | App state storage | `tauri-plugin-store` (JSON) for prefs; move to SQLite when connections/history grow |
| 5 | Cloud backend | None for v1. Revisit if accounts, licensing, or sync are needed |
| 6 | Light theme | Not now. Tokens already allow it later |
