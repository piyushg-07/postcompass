// PostCompass — Centralized Product Configuration
// All product data, features, downloads, and metadata in one place.

export const PRODUCT = {
  name: "PostCompass",
  tagline: "The modern PostgreSQL client built for the way you work.",
  description:
    "A powerful, cross-platform desktop application that combines the best of Supabase Table Editor and pgAdmin 4 into one seamless developer experience. Edit data inline, manage schemas visually, write SQL with AI assistance, and navigate your databases with precision.",
  version: "0.1.0",
  license: "Open Source",
  github: "https://github.com/piyushg-07/postcompass",
  docs: "#docs",
  changelog: "#changelog",
  website: "https://postcompass.dev",
} as const;

export type Platform = "windows" | "macos" | "linux";

export interface DownloadOption {
  platform: Platform;
  label: string;
  icon: string;
  primary: {
    label: string;
    url: string;
    format: string;
    arch: string;
  };
  secondary?: {
    label: string;
    url: string;
    format: string;
    arch: string;
  };
}

export const DOWNLOADS: DownloadOption[] = [
  {
    platform: "windows",
    label: "Windows",
    icon: "windows",
    primary: {
      label: "Download for Windows",
      url: "#download-windows-x64",
      format: ".exe",
      arch: "x64",
    },
  },
  {
    platform: "macos",
    label: "macOS",
    icon: "apple",
    primary: {
      label: "Apple Silicon",
      url: "#download-macos-arm64",
      format: ".dmg",
      arch: "Apple Silicon (M1+)",
    },
    secondary: {
      label: "Intel",
      url: "#download-macos-x64",
      format: ".dmg",
      arch: "Intel x64",
    },
  },
  {
    platform: "linux",
    label: "Linux",
    icon: "linux",
    primary: {
      label: "Download AppImage",
      url: "#download-linux-appimage",
      format: ".AppImage",
      arch: "x64",
    },
    secondary: {
      label: "Download .deb",
      url: "#download-linux-deb",
      format: ".deb",
      arch: "x64",
    },
  },
];

export interface Feature {
  id: string;
  title: string;
  description: string;
  details: string[];
  category: FeatureCategory;
  tier: 1 | 2 | 3;
}

export type FeatureCategory =
  | "data-editing"
  | "schema-management"
  | "query-tools"
  | "data-types"
  | "navigation"
  | "visualization"
  | "import-export"
  | "advanced";

export const FEATURE_CATEGORIES: Record<
  FeatureCategory,
  { label: string; description: string }
> = {
  "data-editing": {
    label: "Data Editing",
    description: "Edit your data as naturally as a spreadsheet",
  },
  "schema-management": {
    label: "Schema Management",
    description: "Design and modify your database schema visually",
  },
  "query-tools": {
    label: "SQL & Query Tools",
    description: "Write, analyze, and optimize your queries",
  },
  "data-types": {
    label: "Smart Type Editors",
    description: "Purpose-built editors for every PostgreSQL data type",
  },
  navigation: {
    label: "Filtering & Navigation",
    description: "Find and organize your data effortlessly",
  },
  visualization: {
    label: "Schema Visualization",
    description: "Understand your database structure at a glance",
  },
  "import-export": {
    label: "Import & Export",
    description: "Move data in and out with full control",
  },
  advanced: {
    label: "Advanced Management",
    description: "Professional-grade database administration tools",
  },
};

export const FEATURES: Feature[] = [
  // Tier 1 — Core Data Editing
  {
    id: "inline-editing",
    title: "Inline Cell Editing",
    description:
      "Click any cell, type a new value, and it saves automatically. No forms, no SQL — just click and edit like a spreadsheet.",
    details: [
      "Click-to-edit any cell with auto-save on blur",
      "Inline text, number, and boolean editing",
      "Expandable editor for long text content",
      "Set cells to NULL explicitly",
      "Undo unsaved changes before committing",
    ],
    category: "data-editing",
    tier: 1,
  },
  {
    id: "row-operations",
    title: "Row Operations",
    description:
      "Add, delete, duplicate, and manage rows with intuitive GUI controls. Bulk select multiple rows for batch operations.",
    details: [
      "Add new rows via a structured form",
      "Delete single or multiple rows with confirmation",
      "Duplicate/clone existing rows in one click",
      "Bulk select with checkboxes for batch operations",
      "Copy row data to clipboard",
    ],
    category: "data-editing",
    tier: 1,
  },
  {
    id: "column-management",
    title: "Visual Column Management",
    description:
      "Add, rename, delete, and modify columns through a visual interface. Change data types, set defaults, configure constraints — all without writing DDL.",
    details: [
      "Add columns with name, type, default, nullable, and unique settings",
      "Rename columns by clicking the header",
      "Change data types via dropdown with all PostgreSQL types",
      "Set default expressions (gen_random_uuid(), now(), etc.)",
      "Toggle NOT NULL, Unique, and Primary Key constraints",
      "Add Foreign Key relationships with cascade rules",
      "Configure identity/auto-increment columns",
      "Add check constraints with custom expressions",
      "Support for array types (text[], int4[], etc.)",
      "Live SQL preview showing generated DDL",
    ],
    category: "schema-management",
    tier: 1,
  },
  {
    id: "filtering-sorting",
    title: "Visual Filter Builder",
    description:
      "Build complex filters visually — pick a column, choose an operator, enter a value. Stack multiple conditions. No WHERE clauses to write by hand.",
    details: [
      "Click column headers to sort ASC/DESC",
      "Visual filter builder with column, operator, and value",
      "Stack multiple AND conditions",
      "Filter by cell selection (right-click → filter by value)",
      "Exclude by selection (NOT equals filter)",
      "Configurable row limits (100, 500, 1000, All)",
      "Column resize by dragging borders",
      "Column reorder by drag-and-drop",
      "Total row count display",
    ],
    category: "navigation",
    tier: 1,
  },
  {
    id: "pagination",
    title: "Smart Pagination",
    description:
      "Navigate large datasets with configurable page sizes and intuitive page controls.",
    details: [
      "Page-based navigation for large tables",
      "Configurable page size",
      "Total row count indicator",
    ],
    category: "navigation",
    tier: 1,
  },
  // Tier 2 — Power Features
  {
    id: "json-editor",
    title: "JSON Tree Editor",
    description:
      "Edit JSONB columns with an interactive tree view. Expand, add, edit, and delete keys and values visually — no manual JSON syntax needed.",
    details: [
      "Interactive tree view for JSON/JSONB data",
      "Expand and collapse nested objects",
      "Add, edit, and delete keys and values",
      "Visual structure without writing raw JSON",
    ],
    category: "data-types",
    tier: 2,
  },
  {
    id: "array-editor",
    title: "Array Tag Editor",
    description:
      "Manage PostgreSQL array columns with a tag-style input. Add and remove items individually — no manual {val1,val2} syntax required.",
    details: [
      "Tag-style input for text[], int[], and other array types",
      "Add and remove items individually",
      "No manual array literal syntax required",
    ],
    category: "data-types",
    tier: 2,
  },
  {
    id: "enum-dropdown",
    title: "Enum Dropdown Selector",
    description:
      "Enum columns display a dropdown showing only valid values. Prevents invalid data entry at the UI level.",
    details: [
      "Dropdown select showing only valid enum values",
      "Prevents invalid data at the UI level",
    ],
    category: "data-types",
    tier: 2,
  },
  {
    id: "type-editors",
    title: "Specialized Type Editors",
    description:
      "Purpose-built editors for Boolean toggles, Date pickers, UUID generators, Foreign Key selectors, and expandable text areas.",
    details: [
      "Boolean toggle switch (true/false/null)",
      "Date and timestamp picker widget",
      "UUID auto-generate button",
      "Foreign Key selector with related record preview",
      "Expandable text area for long content",
      "Hex viewer for binary/bytea data",
    ],
    category: "data-types",
    tier: 2,
  },
  {
    id: "sql-editor",
    title: "SQL Editor",
    description:
      "A full-featured SQL editor with syntax highlighting, context-aware autocomplete, multiple tabs, query history, and saved queries.",
    details: [
      "Full SQL syntax highlighting",
      "Context-aware autocomplete for tables, columns, and functions",
      "Multiple editor tabs open simultaneously",
      "Query history with re-run capability",
      "Saved queries for frequently used operations",
      "Template queries for common tasks",
      "Inline error highlighting and messages",
      "Tabular results grid with sort and filter",
      "Transaction controls (auto-commit, auto-rollback)",
      "Keyboard shortcuts (F5 execute, F7 EXPLAIN, F6 save)",
    ],
    category: "query-tools",
    tier: 2,
  },
  {
    id: "fk-selector",
    title: "Foreign Key Selector",
    description:
      "When editing a foreign key column, browse and select from the referenced table with a preview of related records.",
    details: [
      "Visual selector for referenced table records",
      "Preview of related record data",
      "Cascade rule configuration",
    ],
    category: "data-types",
    tier: 2,
  },
  // Tier 3 — Premium Differentiators
  {
    id: "schema-visualizer",
    title: "Interactive Schema Visualizer",
    description:
      "Auto-generated ERD diagrams showing all tables, columns, types, and relationships. Drag-and-drop design with DDL generation.",
    details: [
      "Auto-generated visual map of all tables and relationships",
      "Foreign key lines/arrows connecting related tables",
      "Column names, types, and constraints in each node",
      "Zoom, pan, and auto-layout for large schemas",
      "Drag-and-drop table creation and editing",
      "Relationship connectors (1:1, 1:N, M:N)",
      "Generate SQL (DDL) from the diagram",
      "Export diagram as PNG/SVG",
      "Reverse-engineer existing schema into ERD",
    ],
    category: "visualization",
    tier: 3,
  },
  {
    id: "explain-visualizer",
    title: "Graphical EXPLAIN Plan",
    description:
      "Visualize query execution plans as interactive node trees. Spot bottlenecks with Seq Scans, Index Scans, Nested Loops, and timing metrics.",
    details: [
      "Text, table, and graphical execution plan views",
      "EXPLAIN ANALYZE with actual timing and buffer metrics",
      "Visual tree of execution nodes",
      "Cost per node visualization",
      "Bottleneck identification",
    ],
    category: "query-tools",
    tier: 3,
  },
  {
    id: "csv-import-export",
    title: "CSV Import & Export",
    description:
      "Import CSV files with column mapping and header detection. Export table data or query results to CSV, with custom delimiters and encoding options.",
    details: [
      "CSV file upload with column mapping",
      "Header row detection",
      "Custom delimiter support (comma, tab, pipe)",
      "Text encoding selection (UTF-8, Latin-1, etc.)",
      "Column selection for partial export",
      "Export query results directly",
      "Multiple format support (CSV, TXT, Binary)",
    ],
    category: "import-export",
    tier: 3,
  },
  {
    id: "backup-restore",
    title: "Backup & Restore",
    description:
      "Full database backup via pg_dump with Custom, Tar, and Plain SQL formats. Restore from backup files with a visual GUI.",
    details: [
      "pg_dump integration via GUI",
      "Custom, Tar, and Plain SQL backup formats",
      "pg_restore via GUI",
      "Globals backup (roles, tablespaces)",
    ],
    category: "import-export",
    tier: 3,
  },
  {
    id: "ai-sql",
    title: "AI-Powered SQL Generation",
    description:
      "Describe what you want in plain English and get SQL generated automatically. Create tables, write queries, and build complex operations with natural language.",
    details: [
      "Natural language to SQL conversion",
      "Context-aware suggestions based on your schema",
      "Template generation for common patterns",
    ],
    category: "query-tools",
    tier: 3,
  },
  {
    id: "advanced-management",
    title: "Advanced Database Management",
    description:
      "Full control over indexes, triggers, functions, sequences, roles, extensions, RLS policies, and server monitoring — all from a visual interface.",
    details: [
      "Object explorer tree (Servers → DBs → Schemas → Tables)",
      "Server dashboard with real-time graphs",
      "Activity monitor (running queries, locks, sessions)",
      "Index management (btree, hash, gin, gist, brin)",
      "Trigger management with event types and conditions",
      "Function/procedure editor with PL/pgSQL support",
      "Sequence management",
      "Role and permission editor with granular checkboxes",
      "Extension manager (pgvector, postgis, uuid-ossp, etc.)",
      "RLS Policy editor for Row Level Security",
      "Maintenance operations (VACUUM, ANALYZE, REINDEX)",
      "Multi-table tabs for switching between tables",
      "Scratch pad for drafting code snippets",
    ],
    category: "advanced",
    tier: 3,
  },
];

export const NAV_LINKS = [
  { label: "Features", href: "#features" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "Documentation", href: "#docs" },
  { label: "Changelog", href: "#changelog" },
] as const;

export const HOW_IT_WORKS_STEPS = [
  {
    step: 1,
    title: "Install PostCompass",
    description:
      "Download the native app for your operating system. No Docker, no browser tabs, no cloud signup required.",
    code: "# Or install via command line\nwinget install postcompass    # Windows\nbrew install postcompass      # macOS\nsnap install postcompass      # Linux",
  },
  {
    step: 2,
    title: "Connect Your Database",
    description:
      "Enter your PostgreSQL connection string or fill in host, port, database, and credentials. Supports local, remote, and cloud-hosted databases.",
    code: 'postgresql://user:password@localhost:5432/mydb\n\n# Or connect to cloud databases\npostgresql://user:password@db.supabase.co:5432/postgres\npostgresql://user:password@your-rds.amazonaws.com:5432/prod',
  },
  {
    step: 3,
    title: "Browse & Edit Data",
    description:
      "Click on any table to see its data in a spreadsheet-like grid. Click any cell to edit it inline. Add rows, modify columns, filter and sort — all visually.",
    code: null,
  },
  {
    step: 4,
    title: "Build & Optimize",
    description:
      "Write SQL with autocomplete and AI assistance. Visualize your schema as an ERD. Analyze query performance with graphical EXPLAIN plans. Import and export data.",
    code: null,
  },
] as const;

export const USE_CASES = [
  {
    title: "Rapid Prototyping",
    problem:
      "You're building a new app and need to iterate on your database schema quickly without writing DDL for every change.",
    solution:
      "Add columns, change types, set defaults, and configure constraints visually. See the generated SQL before applying. Clone rows to create test data instantly.",
    icon: "zap",
  },
  {
    title: "Data Debugging",
    problem:
      "A bug report comes in and you need to inspect and fix specific rows in production data — fast.",
    solution:
      "Filter rows visually, click the problematic cell, edit the value inline, and it's saved. Use the JSON tree editor to fix nested JSONB structures without manual string editing.",
    icon: "bug",
  },
  {
    title: "Query Optimization",
    problem:
      "Your API endpoint is slow and you suspect an inefficient query but can't tell where the bottleneck is.",
    solution:
      "Paste your query in the SQL editor, run EXPLAIN ANALYZE, and see a graphical execution plan that highlights Seq Scans, missing indexes, and cost hotspots.",
    icon: "gauge",
  },
  {
    title: "Team Onboarding",
    problem:
      "A new developer joins the team and needs to understand the database structure quickly.",
    solution:
      "Open the Schema Visualizer to see all tables, columns, and relationships as an interactive ERD. Export it as an image for documentation.",
    icon: "users",
  },
  {
    title: "Data Migration",
    problem:
      "You need to import a CSV dataset and export transformed data from your PostgreSQL database.",
    solution:
      "Use the Import dialog to map CSV columns to table columns. Export query results with custom delimiters and encoding. Back up the full database before major changes.",
    icon: "arrow-right-left",
  },
] as const;

export const FAQ_ITEMS = [
  {
    question: "What is PostCompass?",
    answer:
      "PostCompass is a modern, cross-platform desktop application for managing PostgreSQL databases. It combines the best features of Supabase Table Editor and pgAdmin 4 — inline data editing, visual schema management, a powerful SQL editor, and advanced database administration tools — in a single native app.",
  },
  {
    question: "Which operating systems are supported?",
    answer:
      "PostCompass is available for Windows, macOS (Intel and Apple Silicon), and Linux (AppImage and .deb).",
  },
  {
    question: "Is PostCompass free?",
    answer:
      "PostCompass is open source. Check our GitHub repository for the license details and source code.",
  },
  {
    question: "How do I connect to my database?",
    answer:
      "After installing, click 'New Connection' and enter your PostgreSQL connection string or fill in the host, port, database, username, and password fields. PostCompass supports local databases, cloud-hosted PostgreSQL (Supabase, AWS RDS, etc.), and SSH tunneling.",
  },
  {
    question: "Can I edit data directly in the table view?",
    answer:
      "Yes. PostCompass supports inline cell editing — click any cell, type the new value, and it auto-saves when you click away. No forms or SQL required. It also includes specialized editors for JSON, arrays, enums, dates, and boolean values.",
  },
  {
    question: "How do I update PostCompass?",
    answer:
      "PostCompass will notify you when a new version is available. You can also check the GitHub Releases page for the latest version and download it manually.",
  },
  {
    question: "Where do I report bugs or request features?",
    answer:
      "Open an issue on the PostCompass GitHub repository. We actively review bug reports and feature requests from the community.",
  },
  {
    question: "Does PostCompass send my data to any server?",
    answer:
      "PostCompass is a desktop application that connects directly to your PostgreSQL database. Your data stays between your machine and your database. PostCompass does not route your queries or data through any third-party server.",
  },
  {
    question: "Can I use PostCompass with Supabase or cloud databases?",
    answer:
      "Yes. Any PostgreSQL-compatible database that accepts standard connections will work with PostCompass, including Supabase, AWS RDS, Google Cloud SQL, Azure Database for PostgreSQL, and self-hosted instances.",
  },
] as const;
