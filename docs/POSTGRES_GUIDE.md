# PostgreSQL — Everything You Need to Know Before Building PostCompass

> A complete, practical guide to how PostgreSQL works: architecture, storage, indexes (B-tree, GIN, GiST, BRIN…),
> MVCC, WAL, security, extensions ("plugins" like the ones Supabase shows), monitoring, backups — and what each
> one means for a database management app like PostCompass.
>
> Written for PostgreSQL 18 (current), with notes where older versions differ.

---

## Table of contents

1. [What PostgreSQL is](#1-what-postgresql-is)
2. [The object hierarchy: cluster → database → schema → objects](#2-the-object-hierarchy)
3. [Architecture: processes and memory](#3-architecture-processes-and-memory)
4. [Storage: how data sits on disk](#4-storage-how-data-sits-on-disk)
5. [Data types](#5-data-types)
6. [Tables, constraints, and keys](#6-tables-constraints-and-keys)
7. [Indexes — B-tree, Hash, GIN, GiST, SP-GiST, BRIN](#7-indexes)
8. [How a query runs: parser, planner, executor, EXPLAIN](#8-how-a-query-runs)
9. [MVCC, VACUUM, and bloat](#9-mvcc-vacuum-and-bloat)
10. [Transactions, isolation levels, and locks](#10-transactions-isolation-levels-and-locks)
11. [WAL, checkpoints, and crash recovery](#11-wal-checkpoints-and-crash-recovery)
12. [Replication: physical and logical](#12-replication)
13. [Security: roles, privileges, RLS, authentication](#13-security)
14. [Views, functions, procedures, triggers, and other objects](#14-views-functions-procedures-triggers)
15. [Extensions ("plugins") — what they are and the important ones](#15-extensions-plugins)
16. [JSON / JSONB](#16-json--jsonb)
17. [Full-text search](#17-full-text-search)
18. [Partitioning](#18-partitioning)
19. [System catalogs and statistics views](#19-system-catalogs-and-statistics-views)
20. [Configuration (postgresql.conf, pg_hba.conf)](#20-configuration)
21. [Connections and pooling](#21-connections-and-pooling)
22. [Backup and restore](#22-backup-and-restore)
23. [Command-line tools that ship with PostgreSQL](#23-command-line-tools)
24. [Versions and upgrades](#24-versions-and-upgrades)
25. [The Supabase dashboard, explained in Postgres terms](#25-the-supabase-dashboard-explained-in-postgres-terms)
26. [What this means for PostCompass (feature → Postgres mapping)](#26-what-this-means-for-postcompass)
27. [Glossary](#27-glossary)
28. [Learning path](#28-learning-path)

---

## 1. What PostgreSQL is

PostgreSQL ("Postgres") is an open-source **object-relational database**. It started as POSTGRES at UC Berkeley
(1986), gained SQL in 1995, and has had a major release every year since. It's known for:

- **Correctness**: full ACID transactions, strict standards compliance.
- **Extensibility**: you can add your own data types, operators, index types, functions in many languages, and
  whole features packaged as **extensions** (this is why Supabase can offer pgvector, PostGIS, pg_cron, etc.).
- **Rich types**: JSONB, arrays, ranges, geometric types, UUIDs, full-text search, enums, composite types.
- **Concurrency without read locks**: readers never block writers and writers never block readers (MVCC, §9).

**ACID** in one line each:

| Letter | Meaning | How Postgres does it |
|---|---|---|
| **A**tomicity | All of a transaction happens, or none of it | Transaction commit/abort recorded in WAL + commit log |
| **C**onsistency | Constraints always hold | CHECK, FOREIGN KEY, UNIQUE, NOT NULL, triggers |
| **I**solation | Concurrent transactions don't see each other's half-done work | MVCC snapshots, locks, SSI |
| **D**urability | Committed data survives a crash | WAL is flushed to disk (fsync) before commit returns |

---

## 2. The object hierarchy

This is the single most important mental model for building a management UI.

```
Machine
└── Cluster  (= one running Postgres "server"/instance, one data directory, one port, e.g. 5432)
    ├── Roles            (users & groups — shared by ALL databases in the cluster)
    ├── Tablespaces      (disk locations — shared)
    └── Databases        (postgres, template0, template1, your_app, …)
        └── Schemas      (public, auth, storage, extensions, pg_catalog, information_schema, …)
            ├── Tables (+ columns, constraints, indexes, triggers, policies)
            ├── Views / Materialized views
            ├── Sequences
            ├── Functions / Procedures
            ├── Types (enum, composite, domain, range)
            └── …
```

Key facts:

- **Cluster** — confusingly, "cluster" in Postgres just means *one instance* managing one data directory. (In
  PostCompass's UI we call this a "database"; internally it's a `ManagedServer`.)
- **A connection is to exactly one database.** You cannot `SELECT` across databases in one query (you need
  `dblink` or `postgres_fdw`). That's why the explorer must open a new session to switch databases.
- **Roles are cluster-wide**, not per database. A role's *privileges* are per object.
- **Default databases**:
  - `postgres` — empty default database to connect to.
  - `template1` — copied every time you run `CREATE DATABASE` (anything you put here appears in new DBs).
  - `template0` — pristine, read-only template (used for restores / different encodings).
- **Schemas are namespaces** inside a database. `public` is the default. The **`search_path`** setting decides
  which schemas are searched for unqualified names (default: `"$user", public`).
- **System schemas**: `pg_catalog` (system tables), `information_schema` (SQL-standard views),
  `pg_toast` (out-of-line storage), `pg_temp_N` (temp tables).

Fully qualified name: `database.schema.object` → in SQL you write `schema.object` (database is the connection).

---

## 3. Architecture: processes and memory

Postgres uses **one OS process per connection** (not threads).

```
                 ┌────────────────────────────────────────────┐
 client ──TCP──▶ │ postmaster (main "postgres" process)       │  listens on port, forks a backend per connection
                 └──────┬─────────────────────────────────────┘
                        │ fork
        ┌───────────────┼──────────────┬──────────────┬──────────────┐
        ▼               ▼              ▼              ▼              ▼
   backend (conn 1) backend (conn 2)  checkpointer   walwriter     autovacuum launcher → workers
                                       bgwriter       archiver      logical replication launcher
                                       startup / walsender / walreceiver (replication)
                        │
                        ▼
               ┌─────────────────── Shared memory ───────────────────┐
               │ shared_buffers (page cache) · WAL buffers · lock table │
               │ commit log (CLOG) · proc array (snapshots) · stats     │
               └────────────────────────────────────────────────────────┘
```

### Background processes

| Process | Job |
|---|---|
| **postmaster** | Parent. Accepts connections, forks backends, restarts children after crashes. |
| **backend** | One per client connection. Parses, plans, executes your SQL. Visible in `pg_stat_activity`. |
| **checkpointer** | Periodically writes all dirty pages to disk and marks a *checkpoint* in WAL (§11). |
| **background writer** | Trickles dirty pages to disk so backends rarely have to. |
| **walwriter** | Flushes WAL buffers to disk. |
| **autovacuum launcher / workers** | Clean dead rows and update statistics automatically (§9). |
| **archiver** | Copies finished WAL files to an archive (for point-in-time recovery). |
| **walsender / walreceiver** | Stream WAL to/from replicas (§12). |
| **logical replication launcher / workers** | Run logical subscriptions. |
| **I/O workers** (PG 18) | Perform asynchronous reads (`io_method = worker`). |

### Memory

| Setting | Scope | What it is | Typical value |
|---|---|---|---|
| `shared_buffers` | Shared | Postgres's own page cache | ~25% of RAM |
| `effective_cache_size` | Hint only | How much OS cache + shared_buffers the planner may assume | ~50–75% of RAM |
| `work_mem` | Per sort/hash operation, per query node | Memory for sorts, hash joins before spilling to disk | 4–64 MB |
| `maintenance_work_mem` | Per maintenance op | VACUUM, CREATE INDEX, ALTER TABLE ADD FK | 64 MB–1 GB |
| `wal_buffers` | Shared | WAL not yet written | auto (~16 MB) |
| `temp_buffers` | Per session | Temp tables | 8 MB |

⚠️ `work_mem` can be used **many times per query** (each sort/hash node) and per connection — 100 connections ×
3 sorts × 64 MB = 19 GB. That's why it's kept modest.

Postgres also relies on the **OS page cache** — data is often cached twice (shared_buffers + OS). That's normal.

---

## 4. Storage: how data sits on disk

### The data directory (`PGDATA`)

```
PGDATA/
├── postgresql.conf        main config
├── postgresql.auto.conf   written by ALTER SYSTEM (overrides postgresql.conf)
├── pg_hba.conf            who may connect, from where, how (authentication)
├── pg_ident.conf          OS user → DB role mapping
├── PG_VERSION             major version of this cluster
├── postmaster.pid         present while running (PID, port, socket dir…)
├── base/                  one subfolder per database (named by database OID)
│   └── 16384/             files per table/index, named by "relfilenode"
├── global/                cluster-wide catalogs (pg_database, pg_authid…)
├── pg_wal/                write-ahead log segments (16 MB each)
├── pg_xact/               commit status of every transaction (CLOG)
├── pg_multixact/          shared row-lock info
├── pg_tblspc/             symlinks to other tablespaces
├── pg_stat/ , pg_stat_tmp/ statistics
└── log/                   server logs (if logging_collector = on)
```

### Pages, heap, and tuples

- All data is stored in **8 KB pages** (blocks).
- A table's main storage is called the **heap** — rows are stored in no particular order.
- A row is called a **tuple**. Each tuple has a hidden header: `xmin` (transaction that created it), `xmax`
  (transaction that deleted/updated it), `ctid` (physical location: `(page, item)`), and more.
  Try: `SELECT ctid, xmin, xmax, * FROM my_table;`
- Each table/index file is split into 1 GB segments (`16385`, `16385.1`, …).

### Forks — each relation has several files

| Fork | Suffix | Purpose |
|---|---|---|
| main | (none) | The actual data |
| FSM | `_fsm` | **Free Space Map** — which pages have room for new rows |
| VM | `_vm` | **Visibility Map** — which pages have only rows visible to everyone (enables index-only scans, lets VACUUM skip pages) |
| init | `_init` | For unlogged tables |

### TOAST

Rows must fit in a page, so large values (> ~2 KB) are compressed and/or moved **out of line** into a hidden
`pg_toast.pg_toast_<oid>` table. This is automatic. **TOAST** = "The Oversized-Attribute Storage Technique".
Compression: `pglz` (default) or `lz4` (`default_toast_compression`). Max value size: 1 GB.

### OIDs

Every system object has an **OID** (object identifier, 32-bit). `pg_class.oid` identifies a table; `regclass`
casts help: `SELECT 'public.users'::regclass::oid;`.

### Tablespaces

A tablespace is a directory where Postgres can put tables/indexes (e.g., a faster disk). Default ones:
`pg_default` (base/) and `pg_global` (global/). Rarely used on cloud setups.

### Unlogged and temporary tables

- **UNLOGGED**: no WAL → much faster writes, but **emptied after a crash** and not replicated.
- **TEMPORARY**: visible only to the session; dropped at session end.

---

## 5. Data types

| Category | Types | Notes |
|---|---|---|
| Integers | `smallint` (2B), `integer` (4B), `bigint` (8B) | Use `bigint` for IDs that may grow |
| Auto IDs | `GENERATED ALWAYS AS IDENTITY` (modern), `serial`/`bigserial` (legacy) | Both use a **sequence** behind the scenes |
| Exact decimal | `numeric(p,s)` / `decimal` | Money math. Slower than floats |
| Floating | `real` (4B), `double precision` (8B) | Inexact |
| Money | `money` | Avoid — locale-dependent; use `numeric` |
| Text | `text`, `varchar(n)`, `char(n)` | `text` and `varchar` perform the same; `char(n)` pads — avoid |
| Boolean | `boolean` | `true/false/null` |
| Binary | `bytea` | Raw bytes |
| Date/time | `date`, `time`, `timestamp`, **`timestamptz`**, `interval` | **Always prefer `timestamptz`** (stored as UTC, displayed in session time zone) |
| UUID | `uuid` | `gen_random_uuid()` (v4, built in), `uuidv7()` (PG 18, time-ordered — better for indexes) |
| JSON | `json` (text, keeps formatting), **`jsonb`** (binary, indexable) | Use `jsonb` (§16) |
| Arrays | `integer[]`, `text[]`, … | Any type can be an array |
| Ranges | `int4range`, `int8range`, `numrange`, `tsrange`, `tstzrange`, `daterange`, plus multiranges | Great for bookings (with exclusion constraints) |
| Network | `inet`, `cidr`, `macaddr` | |
| Geometric | `point`, `line`, `box`, `circle`, `polygon`, `path` | For real GIS use PostGIS |
| Full text | `tsvector`, `tsquery` | §17 |
| Bit strings | `bit(n)`, `bit varying` | |
| XML | `xml` | |
| Special | `oid`, `regclass`, `regtype`, `pg_lsn`, `xid8` | System use |
| User-defined | `ENUM`, composite (`CREATE TYPE … AS (…)`), `DOMAIN` (type + constraint), range types | |
| From extensions | `vector` (pgvector), `geometry`/`geography` (PostGIS), `citext`, `hstore`, `ltree` | |

**Why it matters for PostCompass**: the data grid must render/edit each type correctly (JSON viewer, array
editor, date pickers, `bytea` as hex, `NULL` vs empty string, big numbers as strings in JS because `bigint` can
exceed `Number.MAX_SAFE_INTEGER`).

---

## 6. Tables, constraints, and keys

```sql
CREATE TABLE orders (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  customer_id bigint NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  status      text   NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','shipped')),
  total       numeric(12,2) NOT NULL CHECK (total >= 0),
  email       text UNIQUE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  total_cents bigint GENERATED ALWAYS AS ((total * 100)::bigint) STORED
);
```

### Constraint types

| Constraint | What it enforces | Creates an index? |
|---|---|---|
| `NOT NULL` | Value required | No |
| `CHECK (expr)` | Expression must be true (or null) | No |
| `UNIQUE` | No duplicates (NULLs allowed unless `NULLS NOT DISTINCT`) | Yes (B-tree) |
| `PRIMARY KEY` | UNIQUE + NOT NULL, one per table | Yes |
| `FOREIGN KEY … REFERENCES` | Value must exist in parent table | **No — index the FK column yourself!** |
| `EXCLUDE USING gist (…)` | No two rows "overlap" (e.g., room bookings) | Yes (GiST) |

Foreign key actions: `ON DELETE / ON UPDATE` → `NO ACTION` (default), `RESTRICT`, `CASCADE`, `SET NULL`,
`SET DEFAULT`. Constraints can be `DEFERRABLE INITIALLY DEFERRED` (checked at commit).

PG 18 adds **temporal constraints**: `PRIMARY KEY (id, valid_period WITHOUT OVERLAPS)`.

### Generated columns
- `STORED` — computed on write and saved.
- `VIRTUAL` — computed on read (PG 18, now the default when you don't specify).

### Altering tables safely (important for a GUI that runs DDL)

Some `ALTER TABLE`s **rewrite the whole table** and hold an `ACCESS EXCLUSIVE` lock (blocks everything):
- Changing a column type (most cases), adding a column with a *volatile* default (e.g., `DEFAULT random()`).

Cheap / instant:
- Adding a nullable column, adding a column with a *constant* default (PG 11+), dropping a column (just
  marks it dropped), renaming.

Safer patterns:
- `CREATE INDEX CONCURRENTLY` instead of `CREATE INDEX`.
- `ADD CONSTRAINT … NOT VALID` then `VALIDATE CONSTRAINT` later (for CHECK and FK).
- Set `lock_timeout` before DDL so you don't queue behind long transactions and block everyone.

---

## 7. Indexes

An index is a separate data structure that lets Postgres find rows without scanning the whole table.
Every index **speeds reads but slows writes** (each INSERT/UPDATE must update it) and takes disk space.

Postgres has **six built-in index types** (access methods), plus more from extensions:

| Type | Full name | Best for | Operators it accelerates |
|---|---|---|---|
| **B-tree** | Balanced tree | Default. Equality & ranges on sortable data | `= < <= > >= BETWEEN IN`, `IS NULL`, `LIKE 'abc%'`, ORDER BY |
| **Hash** | Hash table | Equality only | `=` |
| **GIN** | Generalized **Inverted** Index | Values that contain *many* elements: JSONB, arrays, full-text, trigrams | `@> <@ ? ?| ?& && @@` |
| **GiST** | Generalized Search Tree | Geometric/spatial, ranges, nearest-neighbor, full-text, exclusion constraints | `&& @> <@ << >> <->` (distance) |
| **SP-GiST** | Space-Partitioned GiST | Non-balanced structures: quadtrees, k-d trees, radix tries (IPs, phone prefixes, points) | similar to GiST |
| **BRIN** | Block Range INdex | Huge tables where values correlate with physical order (time-series, append-only logs) | `= < > …` (coarse) |

### 7.1 B-tree (the default)
- `CREATE INDEX ON orders (customer_id);` creates a B-tree.
- Keeps keys sorted → supports ranges and `ORDER BY` without sorting.
- **Multicolumn**: `(a, b)` helps queries on `a` or `a AND b`, but generally not `b` alone (PG 18 adds
  **skip scan**, which can sometimes use it for `b` alone when `a` has few distinct values).
- Deduplication (PG 13+) keeps indexes on repetitive values small.

### 7.2 Hash
- Only `=`. Can be smaller than B-tree for long keys (e.g., long URLs). Rarely needed.

### 7.3 GIN — Generalized Inverted Index ⭐ (the one you saw in Supabase)
Think of the index at the back of a book: for each **word** it lists the **pages** it appears on.
GIN stores, for each *element* (array item, JSON key/value, word, trigram), the list of rows containing it.

```sql
-- JSONB: find rows whose data contains {"plan":"pro"}
CREATE INDEX ON events USING gin (data);                 -- supports @>, ?, ?|, ?&
CREATE INDEX ON events USING gin (data jsonb_path_ops);  -- smaller/faster, but only @> (and jsonpath)
SELECT * FROM events WHERE data @> '{"plan":"pro"}';

-- Arrays
CREATE INDEX ON posts USING gin (tags);
SELECT * FROM posts WHERE tags @> ARRAY['postgres'];

-- Full-text search
CREATE INDEX ON docs USING gin (to_tsvector('english', body));

-- Fuzzy / ILIKE '%abc%' search (needs pg_trgm extension)
CREATE EXTENSION pg_trgm;
CREATE INDEX ON users USING gin (name gin_trgm_ops);
SELECT * FROM users WHERE name ILIKE '%ann%';
```
- ✅ Very fast lookups for "contains".
- ❌ Slower to update (uses a "pending list" + `fastupdate` to batch inserts); larger than B-tree.
- `btree_gin` extension lets GIN index plain scalar columns too (useful for combined multicolumn GIN).

### 7.4 GiST — Generalized Search Tree
A balanced tree of "bounding" keys (like bounding boxes). It's a *framework* — each data type defines what
"contains/overlaps/distance" means.
```sql
CREATE INDEX ON places USING gist (location);          -- PostGIS geometry, point
CREATE INDEX ON bookings USING gist (during);          -- tstzrange overlaps (&&)
SELECT * FROM places ORDER BY location <-> point(0,0) LIMIT 10;  -- K-nearest-neighbor

-- No double-booking:
CREATE EXTENSION btree_gist;
ALTER TABLE bookings ADD EXCLUDE USING gist (room_id WITH =, during WITH &&);
```
- GIN vs GiST for full text: GIN = faster search, slower writes; GiST = faster writes, lossy (rechecks rows).

### 7.5 SP-GiST
For data that partitions naturally into non-overlapping regions: points (quadtree), IP addresses (`inet`),
text prefixes. `CREATE INDEX ON logs USING spgist (client_ip inet_ops);`

### 7.6 BRIN — Block Range Index
Stores only the **min/max per range of pages** (default 128 pages). Tiny (KBs for a TB table).
```sql
CREATE INDEX ON measurements USING brin (recorded_at);
```
- ✅ Perfect for append-only time-series where `recorded_at` grows with physical position.
- ❌ Useless if values are randomly scattered.

### 7.7 Index *features* (work with most types)

| Feature | Example | Why |
|---|---|---|
| **Unique** | `CREATE UNIQUE INDEX ON users (lower(email));` | Enforce uniqueness |
| **Partial** | `CREATE INDEX ON orders (created_at) WHERE status = 'pending';` | Index only the rows you query — smaller & faster |
| **Expression** | `CREATE INDEX ON users (lower(email));` | Query must use the same expression |
| **Covering** (`INCLUDE`) | `CREATE INDEX ON orders (customer_id) INCLUDE (total);` | Enables **index-only scans** |
| **Multicolumn** | `(tenant_id, created_at DESC)` | Order matters: equality columns first, then range/sort |
| **Concurrently** | `CREATE INDEX CONCURRENTLY …` | Doesn't block writes (slower, can't be in a transaction; may leave an INVALID index on failure) |
| **REINDEX** | `REINDEX INDEX CONCURRENTLY idx;` | Rebuild a bloated/corrupt index |
| **Operator class** | `text_pattern_ops`, `jsonb_path_ops`, `gin_trgm_ops`, `vector_cosine_ops` | Chooses which operators the index supports |
| **Collation / sort** | `(name COLLATE "C")`, `DESC NULLS LAST` | Match query ordering |

### 7.8 Extension index types
- **pgvector**: `hnsw` and `ivfflat` for AI embeddings (approximate nearest neighbor).
- **bloom** (contrib): many-column equality with tiny index.
- **RUM**, **pgroonga**: advanced full-text.

### 7.9 Finding index problems (PostCompass features!)
```sql
-- Unused indexes (wasted writes/space)
SELECT relname, indexrelname, idx_scan, pg_size_pretty(pg_relation_size(indexrelid))
FROM pg_stat_user_indexes WHERE idx_scan = 0;

-- Tables read mostly by sequential scans (maybe missing an index)
SELECT relname, seq_scan, idx_scan, n_live_tup FROM pg_stat_user_tables ORDER BY seq_scan DESC;

-- Foreign keys without an index (classic Supabase "advisor" lint)
-- Invalid indexes left by failed CONCURRENTLY builds
SELECT indexrelid::regclass FROM pg_index WHERE NOT indisvalid;
```

---

## 8. How a query runs

```
SQL text → Parser → Analyzer/Rewriter (views, rules) → Planner/Optimizer → Executor → rows
```

1. **Parser**: checks syntax, builds a parse tree.
2. **Analyzer/Rewriter**: resolves names (search_path!), expands views and rules.
3. **Planner**: considers many plans and picks the cheapest using **statistics** about your data
   (row counts, distinct values, most-common values, histograms — collected by `ANALYZE`, stored in
   `pg_statistic`, readable via `pg_stats`).
4. **Executor**: runs the plan tree, pulling rows node by node.

### EXPLAIN
```sql
EXPLAIN SELECT …;                                   -- estimated plan
EXPLAIN (ANALYZE, BUFFERS) SELECT …;                -- actually runs it, real times & I/O (PG 18: BUFFERS default with ANALYZE)
EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT …;   -- JSON — what a visual plan viewer parses
```
⚠️ `EXPLAIN ANALYZE` **executes** the statement — wrap writes in `BEGIN … ROLLBACK`.

Reading a node: `Seq Scan on orders (cost=0.00..1834.00 rows=100000 width=40) (actual time=0.01..12.3 rows=99812 loops=1)`
- `cost=startup..total` — arbitrary planner units.
- `rows` estimated vs actual — **big mismatches = stale/insufficient statistics** → run `ANALYZE`.
- `loops` — multiply times by loops.

### Scan types
| Node | When |
|---|---|
| **Seq Scan** | Reads the whole table. Best when you need a large fraction of rows. |
| **Index Scan** | Walks the index, fetches each row from the heap. Few rows. |
| **Index Only Scan** | All needed columns are in the index and pages are all-visible (VM). No heap access. |
| **Bitmap Index Scan → Bitmap Heap Scan** | Medium number of rows; can combine multiple indexes (`BitmapAnd/Or`). |
| **TID Scan** | `WHERE ctid = …` |

### Join types
| Node | Good for |
|---|---|
| **Nested Loop** | Small outer side + indexed inner side |
| **Hash Join** | Large unsorted inputs, equality joins (builds a hash table, uses `work_mem`) |
| **Merge Join** | Both inputs already sorted on the join key |

Other nodes: `Sort`, `Incremental Sort`, `HashAggregate`, `GroupAggregate`, `Limit`, `Gather` (parallel query),
`Memoize`, `Materialize`, `CTE Scan`, `Append` (partitions).

**Parallel query**: big scans/joins/aggregates can use multiple worker processes
(`max_parallel_workers_per_gather`).

**Prepared statements** (`PREPARE`/extended protocol) skip parsing/planning on repeat; after 5 executions
Postgres may switch to a *generic plan*.

---

## 9. MVCC, VACUUM, and bloat

**MVCC = Multi-Version Concurrency Control.** Postgres never overwrites a row in place.

- `INSERT` → new tuple with `xmin = my transaction id`.
- `DELETE` → sets `xmax = my xid` on the old tuple (it's still physically there).
- `UPDATE` → `DELETE` + `INSERT`: old version gets `xmax`, a **new version** is written.

Each transaction gets a **snapshot** (which transactions were committed when it started). It sees a tuple
only if `xmin` is committed-and-visible and `xmax` is not. Result: **readers never block writers**, and every
query sees a consistent picture.

### The cost: dead tuples
Old versions no longer visible to *any* transaction are **dead tuples**. They waste space ("**bloat**") until
cleaned.

### VACUUM
| Command | What it does | Locks |
|---|---|---|
| `VACUUM` | Marks dead tuple space reusable, updates FSM & VM, freezes old xids | Light — runs alongside reads/writes |
| `VACUUM ANALYZE` | + refreshes planner statistics | Light |
| `VACUUM FULL` | Rewrites the table compactly, returns space to OS | **ACCESS EXCLUSIVE — blocks everything** |
| `ANALYZE` | Statistics only | Light |
| `pg_repack` (extension) | Like VACUUM FULL but online | Brief locks only |

**Autovacuum** runs this automatically when a table's dead tuples exceed
`autovacuum_vacuum_threshold + autovacuum_vacuum_scale_factor × rows` (default 50 + 20%). For big tables you
often lower the scale factor per table: `ALTER TABLE big SET (autovacuum_vacuum_scale_factor = 0.02);`

**What stops VACUUM from cleaning** (a key monitoring feature):
- Long-running transactions / `idle in transaction` sessions (they hold an old snapshot).
- Abandoned **replication slots**.
- Old prepared transactions (`pg_prepared_xacts`).

### HOT updates
**Heap-Only Tuple** updates: if no indexed column changes and the page has free space, the new version goes on
the same page and indexes aren't touched. Much cheaper. Tune with `fillfactor` (e.g. 90).

### Transaction ID wraparound ⚠️
XIDs are 32-bit (~4 billion, compared in a 2-billion window). Old rows must be **frozen** (marked as
"visible to everyone forever") by VACUUM before the counter wraps, or Postgres will eventually **refuse writes**
to protect data. Autovacuum forces an anti-wraparound vacuum at `autovacuum_freeze_max_age` (200 million).
Monitor:
```sql
SELECT datname, age(datfrozenxid) FROM pg_database ORDER BY 2 DESC;
```

---

## 10. Transactions, isolation levels, and locks

```sql
BEGIN;
  UPDATE accounts SET balance = balance - 100 WHERE id = 1;
  UPDATE accounts SET balance = balance + 100 WHERE id = 2;
COMMIT;   -- or ROLLBACK;

SAVEPOINT s1; … ROLLBACK TO s1;   -- partial rollback
```
Every statement outside `BEGIN` runs in its own transaction (**autocommit**). After an error inside a
transaction, everything fails until `ROLLBACK` ("current transaction is aborted").

### Isolation levels
| Level | Sees | Anomalies prevented | Notes |
|---|---|---|---|
| Read Uncommitted | = Read Committed in Postgres | — | Postgres never shows dirty reads |
| **Read Committed** (default) | New snapshot **per statement** | Dirty reads | Two SELECTs in one tx may differ |
| **Repeatable Read** | One snapshot **per transaction** | + non-repeatable reads, phantoms | May fail with serialization error on concurrent update — retry |
| **Serializable** | As if transactions ran one at a time (SSI) | All anomalies | Must retry on `40001` errors |

### Table-level lock modes (weakest → strongest)
| Mode | Taken by | Conflicts with |
|---|---|---|
| ACCESS SHARE | `SELECT` | ACCESS EXCLUSIVE only |
| ROW SHARE | `SELECT … FOR UPDATE/SHARE` | EXCLUSIVE, ACCESS EXCLUSIVE |
| ROW EXCLUSIVE | `INSERT/UPDATE/DELETE/MERGE` | SHARE and stronger |
| SHARE UPDATE EXCLUSIVE | `VACUUM`, `ANALYZE`, `CREATE INDEX CONCURRENTLY` | itself and stronger |
| SHARE | `CREATE INDEX` (non-concurrent) | writes |
| SHARE ROW EXCLUSIVE | `CREATE TRIGGER`, some ALTERs | |
| EXCLUSIVE | `REFRESH MATERIALIZED VIEW CONCURRENTLY` | all but ACCESS SHARE |
| **ACCESS EXCLUSIVE** | `DROP`, `TRUNCATE`, `VACUUM FULL`, most `ALTER TABLE` | **everything, even SELECT** |

**Lock queue trap**: an `ALTER TABLE` waiting for a long `SELECT` makes *every later query* wait behind it. Use
`SET lock_timeout = '3s'` before DDL.

### Row-level locks
`SELECT … FOR UPDATE` / `FOR NO KEY UPDATE` / `FOR SHARE` / `FOR KEY SHARE`. Add `NOWAIT` or `SKIP LOCKED`
(great for job queues).

### Deadlocks
Two transactions waiting on each other → Postgres detects it after `deadlock_timeout` (1s) and kills one.
Avoid by locking rows in a consistent order.

### Advisory locks
App-defined locks: `pg_advisory_lock(42)`, `pg_try_advisory_xact_lock(…)`.

### Monitoring locks (a PostCompass feature)
```sql
SELECT pid, pg_blocking_pids(pid) AS blocked_by, state, wait_event_type, wait_event, now() - query_start AS running, query
FROM pg_stat_activity WHERE cardinality(pg_blocking_pids(pid)) > 0;

SELECT pg_cancel_backend(pid);     -- cancel current query
SELECT pg_terminate_backend(pid);  -- kill the connection
```

---

## 11. WAL, checkpoints, and crash recovery

**WAL = Write-Ahead Log.** Rule: *a change is written to the log before the data file.*

1. A transaction modifies pages in `shared_buffers` (in memory) and appends WAL records.
2. On `COMMIT`, WAL is flushed (`fsync`) to `pg_wal/`. Now it's durable — even if data pages aren't on disk yet.
3. Later the **checkpointer** writes dirty data pages to disk and records a **checkpoint**.
4. After a crash, Postgres replays WAL from the last checkpoint ("**redo**") → consistent state.

Each WAL position is an **LSN** (Log Sequence Number), e.g. `0/16B3748` (`pg_current_wal_lsn()`).

Key settings:
| Setting | Meaning |
|---|---|
| `wal_level` | `minimal` / `replica` (default) / `logical` (needed for logical replication, CDC, Supabase Realtime) |
| `synchronous_commit` | `on` (default). `off` = faster commits, may lose the last few ms of commits on crash (no corruption) |
| `fsync` | Never turn off in production |
| `full_page_writes` | Protects against torn pages |
| `checkpoint_timeout` / `max_wal_size` | How often checkpoints happen (time / WAL volume) |
| `archive_mode` / `archive_command` / `archive_library` | Ship WAL segments elsewhere for PITR |
| `data_checksums` | Detect corruption (enabled by default by `initdb` since PG 18) |

WAL powers: crash recovery, **replication**, **point-in-time recovery (PITR)**, and **logical decoding / CDC**.

---

## 12. Replication

### Physical (streaming) replication
- Replica receives the primary's WAL byte-for-byte and replays it → an exact copy of the **whole cluster**.
- Replica is read-only (**hot standby**). Can be promoted to primary on failover.
- Asynchronous by default; **synchronous** via `synchronous_standby_names` (commit waits for replica).
- Set up with `pg_basebackup` + `primary_conninfo`.
- Monitor: `pg_stat_replication` (on primary), `pg_stat_wal_receiver` (replica), lag = LSN differences.

### Logical replication
- Replicates **row changes per table** (decoded from WAL), between different major versions or schemas.
```sql
-- publisher
CREATE PUBLICATION app_pub FOR TABLE orders, customers;   -- or FOR ALL TABLES / FOR TABLES IN SCHEMA
-- subscriber
CREATE SUBSCRIPTION app_sub CONNECTION 'host=… dbname=…' PUBLICATION app_pub;
```
- Requires `wal_level = logical`. DDL is **not** replicated. Tables need a primary key or `REPLICA IDENTITY`.
- Used for zero-downtime upgrades, CDC (Debezium), and **Supabase Realtime** (the `supabase_realtime`
  publication — that's what "Database → Publications" in Supabase manages).

### Replication slots ⚠️
A slot makes the primary **keep WAL until the consumer has received it**. An abandoned slot makes `pg_wal/`
grow until the disk is full. Monitor `pg_replication_slots` (`active`, `restart_lsn`, `wal_status`).
Limit with `max_slot_wal_keep_size`.

---

## 13. Security

### Roles
In Postgres, **users and groups are both "roles"**. A "user" is just a role with `LOGIN`.
```sql
CREATE ROLE app_user LOGIN PASSWORD '…';
CREATE ROLE readonly NOLOGIN;            -- a "group"
GRANT readonly TO app_user;              -- membership
ALTER ROLE app_user CONNECTION LIMIT 10 VALID UNTIL '2027-01-01';
```
Role attributes: `SUPERUSER`, `CREATEDB`, `CREATEROLE`, `LOGIN`, `REPLICATION`, `BYPASSRLS`, `INHERIT`.
Predefined roles: `pg_read_all_data`, `pg_write_all_data`, `pg_monitor`, `pg_read_all_stats`,
`pg_signal_backend`, `pg_checkpoint`, `pg_maintain` (PG 17), `pg_database_owner`, …

### Privileges (GRANT / REVOKE)
| Object | Privileges |
|---|---|
| Database | `CONNECT`, `CREATE` (schemas), `TEMPORARY` |
| Schema | `USAGE` (can see objects), `CREATE` |
| Table | `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `REFERENCES`, `TRIGGER`, `MAINTAIN` |
| Column | `SELECT`, `INSERT`, `UPDATE`, `REFERENCES` per column |
| Sequence | `USAGE`, `SELECT`, `UPDATE` |
| Function | `EXECUTE` (granted to PUBLIC by default!) |

```sql
GRANT USAGE ON SCHEMA public TO readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO readonly;  -- for future tables
```
- Every object has an **owner**, who can do anything with it (and DROP it).
- `PUBLIC` = every role. Since PG 15, ordinary users can no longer `CREATE` in `public` by default.
- Inspect: `\dp` in psql, `information_schema.table_privileges`, `has_table_privilege(...)`, `pg_class.relacl`.

### Row-Level Security (RLS) — the heart of Supabase
```sql
ALTER TABLE todos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own todos" ON todos
  FOR SELECT                                   -- or INSERT / UPDATE / DELETE / ALL
  TO authenticated                             -- which roles
  USING (user_id = auth.uid());                -- filter for existing rows
CREATE POLICY "insert own" ON todos FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());           -- rule for new/changed rows
```
- With RLS enabled and **no policy**, non-owners see **nothing**.
- Table owners and `BYPASSRLS`/superusers skip RLS (unless `FORCE ROW LEVEL SECURITY`).
- Policies are `PERMISSIVE` (OR-ed, default) or `RESTRICTIVE` (AND-ed).
- Stored in `pg_policy` / `pg_policies`.
- Supabase uses roles `anon`, `authenticated`, `service_role` and helper functions like `auth.uid()` that read
  the JWT from a session setting.

### Authentication — `pg_hba.conf`
Each line: `TYPE  DATABASE  USER  ADDRESS  METHOD` — first match wins.
```
local   all   all                    peer            # Unix socket, OS user = DB user
host    all   all   127.0.0.1/32     scram-sha-256   # password over TCP from localhost
hostssl all   all   0.0.0.0/0        scram-sha-256   # require SSL from anywhere
host    all   all   0.0.0.0/0        reject
```
Methods: `trust` (no password — dangerous), `scram-sha-256` (default, best for passwords), `md5` (deprecated in
PG 18), `peer`, `ident`, `cert`, `ldap`, `radius`, `gss`, `oauth` (PG 18). Reload after editing:
`SELECT pg_reload_conf();`

`listen_addresses` in postgresql.conf controls which network interfaces accept connections (PostCompass's local
databases use `127.0.0.1` only).

### Other security topics
- **SSL/TLS**: `ssl = on`, `sslmode=require|verify-full` on clients.
- **SECURITY DEFINER** functions run with the owner's privileges → always `SET search_path` on them.
- **pgaudit** extension for audit logging.
- **Column encryption**: `pgcrypto`, or app-side. Secrets: Supabase Vault.

---

## 14. Views, functions, procedures, triggers

| Object | What it is |
|---|---|
| **View** | Saved query; no storage. `CREATE VIEW active_users AS SELECT …`. Updatable if simple. `security_invoker = true` makes it respect the caller's RLS (important in Supabase). |
| **Materialized view** | Query result stored on disk. `REFRESH MATERIALIZED VIEW [CONCURRENTLY] mv;` (concurrent needs a unique index). |
| **Sequence** | Number generator: `nextval('seq')`, `currval`, `setval`. Not transactional (gaps are normal). |
| **Function** | `CREATE FUNCTION … RETURNS … LANGUAGE sql/plpgsql/…`. Can return scalar, row, `SETOF`, `TABLE(...)`. Volatility: `IMMUTABLE` / `STABLE` / `VOLATILE` (affects optimization & indexing). |
| **Procedure** | `CREATE PROCEDURE`, called with `CALL`; can `COMMIT` inside. |
| **Trigger** | Runs a function `BEFORE / AFTER / INSTEAD OF` `INSERT / UPDATE / DELETE / TRUNCATE`, `FOR EACH ROW` or `FOR EACH STATEMENT`. Has `NEW`, `OLD`, `TG_OP`. |
| **Event trigger** | Fires on DDL (`ddl_command_end`, `sql_drop`, `login` in PG 17). |
| **Rule** | Old query-rewrite system. Avoid — use triggers/views. |
| **Enum / Domain / Composite / Range types** | `CREATE TYPE mood AS ENUM ('sad','ok','happy');`, `CREATE DOMAIN email AS text CHECK (…)` |
| **Collation** | Sort/compare rules for text (ICU or libc). |
| **Foreign table** | Table backed by an FDW (another DB, CSV, API). |
| **Cast / Operator / Aggregate** | Fully user-definable. |

Procedural languages: **PL/pgSQL** (built in), `sql`, and via extensions PL/Python (`plpython3u`), PL/Perl,
PL/v8 (JavaScript), PL/Rust, PL/Tcl. `u` = "untrusted" (superuser only).

Example trigger (auto `updated_at`):
```sql
CREATE FUNCTION set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;
CREATE TRIGGER t_updated BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

**LISTEN / NOTIFY**: lightweight pub/sub — `NOTIFY channel, 'payload';` / `LISTEN channel;`.

---

## 15. Extensions ("plugins")

### What an extension is
An **extension** is a package of SQL objects (types, functions, operators, index methods, tables) and often a
compiled C library, installed into a database with one command:
```sql
SELECT * FROM pg_available_extensions ORDER BY name;   -- what's installed on disk (can be enabled)
CREATE EXTENSION IF NOT EXISTS pg_trgm;                -- enable in THIS database
CREATE EXTENSION postgis WITH SCHEMA extensions;       -- put its objects in a schema (Supabase does this)
ALTER EXTENSION pg_trgm UPDATE;                        -- upgrade
DROP EXTENSION pg_trgm;                                -- remove (CASCADE drops dependent objects)
SELECT * FROM pg_extension;                            -- enabled in this database
```
Important facts:
- **Two steps**: files must exist on the server (shipped with Postgres = "contrib", or installed via OS
  package/`pgxn`/build), *then* `CREATE EXTENSION` per database. Supabase's "Extensions" page is just a list of
  `pg_available_extensions` with a toggle that runs `CREATE/DROP EXTENSION`.
- Some need **`shared_preload_libraries`** in postgresql.conf + **restart**: `pg_stat_statements`, `pg_cron`,
  `auto_explain`, `pgaudit`, `timescaledb`, `pg_net`, `pg_partman_bgw`, `pg_prewarm` (autoprewarm).
- Many need superuser (or are marked `trusted`, so a database owner can install them).
- Files: `SHAREDIR/extension/<name>.control` + `<name>--<version>.sql`, library in `PKGLIBDIR`.
- For PostCompass's bundled Postgres (theseus binaries), contrib extensions are included; third-party ones
  (pgvector, PostGIS…) must be installed separately.

### The important extensions, grouped

#### Built-in "contrib" (ship with PostgreSQL)
| Extension | What it does |
|---|---|
| **pg_stat_statements** ⭐ | Records execution stats for every normalized query (calls, total/mean time, rows, buffers). Powers "Query Performance" screens. Needs preload. |
| **pgcrypto** | Hashing (`crypt`, `digest`, `hmac`), encryption, `gen_random_bytes` |
| **uuid-ossp** | UUID generators (`uuid_generate_v4()`); mostly replaced by built-in `gen_random_uuid()`/`uuidv7()` |
| **pg_trgm** ⭐ | Trigram similarity: fuzzy search, `similarity()`, `%`, fast `LIKE/ILIKE '%x%'` with GIN/GiST |
| **btree_gin / btree_gist** | Let GIN/GiST index ordinary scalar types (for multicolumn & exclusion constraints) |
| **citext** | Case-insensitive text type |
| **hstore** | Key/value type (pre-JSONB) |
| **ltree** | Hierarchical paths (`Top.Science.Astronomy`) with tree queries |
| **intarray** | Fast integer-array operators & indexes |
| **cube / earthdistance** | Multi-dimensional cubes; great-circle distances |
| **fuzzystrmatch** | Soundex, Levenshtein, metaphone |
| **unaccent** | Remove accents (for search) |
| **tablefunc** | `crosstab()` pivot tables |
| **postgres_fdw** ⭐ | Query tables in another Postgres server as if local |
| **dblink** | Run queries on another database (older approach) |
| **file_fdw** | Read CSV/files as tables |
| **pg_buffercache** | See what's in shared_buffers |
| **pg_prewarm** | Load tables into cache (after restart) |
| **pgstattuple** | Exact bloat/dead tuple stats of a table/index |
| **pg_visibility** | Inspect visibility map |
| **amcheck** | Verify B-tree/heap integrity (corruption checks) |
| **pageinspect** | Look at raw pages (learning/debugging) |
| **pg_walinspect** | Inspect WAL records from SQL |
| **auto_explain** | Logs plans of slow queries automatically |
| **pg_surgery**, **pg_freespacemap**, **sslinfo**, **seg**, **isn**, **lo**, **tsm_system_rows**, **bloom**, **dict_int**, **xml2**, **tcn**, **sepgsql**, **passwordcheck** | Specialized |

#### Popular third-party (most available on Supabase)
| Extension | What it does |
|---|---|
| **pgvector** (`vector`) ⭐ | Vector type + `hnsw`/`ivfflat` indexes for AI embeddings & semantic search (`<->` L2, `<=>` cosine, `<#>` inner product) |
| **PostGIS** ⭐ | Full GIS: `geometry`/`geography` types, spatial functions, GiST indexes. Plus `postgis_topology`, `postgis_raster`, `pgrouting` (routing) |
| **pg_cron** ⭐ | Cron jobs inside Postgres: `SELECT cron.schedule('nightly', '0 3 * * *', 'VACUUM ANALYZE');` (Supabase "Cron") |
| **pg_net** | Async HTTP requests from SQL (Supabase "Database Webhooks" use it) |
| **http** | Synchronous HTTP client |
| **pg_graphql** | GraphQL API generated from your schema (Supabase) |
| **supabase_vault** / **pgsodium** | Encrypted secret storage / libsodium crypto (Supabase "Vault") |
| **pgjwt** | Create/verify JWTs in SQL |
| **wrappers** | Supabase's FDW framework (Stripe, Firebase, S3, ClickHouse… as tables) |
| **pg_jsonschema** | Validate JSON against JSON Schema in CHECK constraints |
| **index_advisor** / **hypopg** | Suggest indexes / hypothetical indexes to test plans without building them |
| **pg_repack** | Remove bloat online (rebuilds tables/indexes without long locks) |
| **pgaudit** | Detailed audit logging |
| **pg_partman** | Automatic partition creation/retention |
| **timescaledb** | Time-series: hypertables, compression, continuous aggregates |
| **pgroonga** / **rum** | Advanced full-text search (all languages / ranking in index) |
| **pg_hashids** | Short YouTube-style IDs from numbers |
| **plv8** | JavaScript functions |
| **pgtap** | Unit tests in SQL |
| **plpgsql_check** | Linter for PL/pgSQL |
| **pg_stat_monitor** | Richer alternative to pg_stat_statements |
| **citus** | Distributed (sharded) Postgres |
| **pg_squeeze**, **orafce**, **pg_hint_plan**, **age** (graph), **pgmq** (message queue), **pg_uuidv7** | Various |

---

## 16. JSON / JSONB

```sql
CREATE TABLE events (id bigint GENERATED ALWAYS AS IDENTITY, data jsonb);
INSERT INTO events (data) VALUES ('{"user":{"id":7,"plan":"pro"},"tags":["a","b"]}');

SELECT data->'user'          FROM events;  -- jsonb
SELECT data->'user'->>'plan' FROM events;  -- text
SELECT data #>> '{user,id}'  FROM events;  -- path → text
SELECT * FROM events WHERE data @> '{"user":{"plan":"pro"}}';  -- containment (GIN-indexable)
SELECT * FROM events WHERE data ? 'tags';                         -- key exists
SELECT * FROM events WHERE data @? '$.tags[*] ? (@ == "a")';      -- SQL/JSON path
UPDATE events SET data = jsonb_set(data, '{user,plan}', '"free"');
SELECT jsonb_pretty(data), jsonb_typeof(data), jsonb_object_keys(data) FROM events;
SELECT * FROM JSON_TABLE(...);   -- PG 17: turn JSON into rows/columns
```
- `json` keeps whitespace/duplicate keys; `jsonb` is parsed binary, unordered keys, indexable → use `jsonb`.
- Index: GIN (`jsonb_ops` or `jsonb_path_ops`) or B-tree on an expression (`(data->>'email')`).
- Build JSON: `jsonb_build_object`, `jsonb_agg`, `to_jsonb(row)`, `row_to_json`.

---

## 17. Full-text search

```sql
SELECT to_tsvector('english', 'The quick brown foxes jumped');   -- 'brown':3 'fox':4 'jump':5 'quick':2
SELECT to_tsquery('english', 'fox & jump');                       -- 'fox' & 'jump'
SELECT websearch_to_tsquery('english', '"brown fox" -dog');

ALTER TABLE docs ADD COLUMN fts tsvector
  GENERATED ALWAYS AS (to_tsvector('english', coalesce(title,'') || ' ' || coalesce(body,''))) STORED;
CREATE INDEX ON docs USING gin (fts);
SELECT title, ts_rank(fts, q) FROM docs, websearch_to_tsquery('english','postgres index') q
WHERE fts @@ q ORDER BY 2 DESC LIMIT 20;
```
- Dictionaries/configurations stem words ("foxes" → "fox") and drop stop words.
- `setweight` for title vs body ranking; `ts_headline` for highlighted snippets.
- For typo tolerance combine with `pg_trgm`.

---

## 18. Partitioning

Split one big logical table into smaller physical tables.
```sql
CREATE TABLE logs (id bigint, created_at timestamptz NOT NULL, msg text) PARTITION BY RANGE (created_at);
CREATE TABLE logs_2026_10 PARTITION OF logs FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');
CREATE TABLE logs_default PARTITION OF logs DEFAULT;
```
- Strategies: `RANGE` (dates), `LIST` (region IN ('eu','us')), `HASH` (spread evenly).
- **Partition pruning**: queries filtering on the key only touch matching partitions.
- Drop old data instantly: `DROP TABLE logs_2025_01;` or `ALTER TABLE logs DETACH PARTITION … CONCURRENTLY`.
- Primary keys/unique indexes must include the partition key.
- Automate with `pg_partman`. Catalog: `pg_partitioned_table`, `pg_inherits`.
- Older mechanism: table **inheritance** (`INHERITS`).

---

## 19. System catalogs and statistics views

Everything Postgres knows is stored in tables you can query. **This is how PostCompass builds its object tree,
table editor, and monitoring.**

### Catalogs (`pg_catalog`) — the structure
| Catalog | Contains |
|---|---|
| `pg_database` | Databases (name, owner, encoding, `datallowconn`, `datfrozenxid`) |
| `pg_namespace` | Schemas |
| `pg_class` | Every "relation": tables (`relkind='r'`), partitioned tables (`p`), indexes (`i`, `I`), sequences (`S`), views (`v`), materialized views (`m`), foreign tables (`f`), TOAST (`t`), composite types (`c`). Has `reltuples` (row estimate), `relpages`, `relrowsecurity` |
| `pg_attribute` | Columns (`attnum > 0 AND NOT attisdropped`) |
| `pg_attrdef` | Column defaults |
| `pg_type` | Data types |
| `pg_index` | Index details (columns, unique, primary, valid) |
| `pg_constraint` | PK, FK, UNIQUE, CHECK, EXCLUDE (`contype` = p/f/u/c/x) |
| `pg_proc` | Functions & procedures (`prokind` f/p/a/w) |
| `pg_trigger` | Triggers |
| `pg_policy` | RLS policies |
| `pg_roles` / `pg_authid` | Roles (`pg_authid` has password hashes — superuser only) |
| `pg_auth_members` | Role memberships |
| `pg_extension` | Installed extensions |
| `pg_depend` | Dependencies between objects (what breaks if I drop X) |
| `pg_description` | Comments (`COMMENT ON TABLE … IS '…'`) |
| `pg_enum`, `pg_sequence`, `pg_inherits`, `pg_publication`, `pg_subscription`, `pg_event_trigger`, `pg_collation`, `pg_tablespace` | … |

Friendly views: `pg_tables`, `pg_views`, `pg_indexes`, `pg_matviews`, `pg_policies`, `pg_sequences`,
`pg_settings`, `pg_stats`, `pg_user`. SQL standard: `information_schema.tables`, `.columns`,
`.table_constraints`, `.key_column_usage` (portable but slower and less complete).

Helpful functions: `pg_get_tabledef`-like DDL via `pg_get_indexdef(oid)`, `pg_get_constraintdef(oid)`,
`pg_get_viewdef(oid)`, `pg_get_functiondef(oid)`, `pg_get_triggerdef(oid)`, `format_type(typid, typmod)`,
`obj_description(oid)`, `col_description(oid, attnum)`.

Sizes: `pg_database_size()`, `pg_total_relation_size()` (table + indexes + TOAST), `pg_relation_size()`,
`pg_indexes_size()`, `pg_size_pretty()`.

### Statistics views — the activity (monitoring dashboards)
| View | Shows |
|---|---|
| **`pg_stat_activity`** ⭐ | Every connection: pid, user, db, client address, `state` (active / idle / idle in transaction), current query, wait events, start times |
| `pg_stat_database` | Per DB: commits, rollbacks, blocks read/hit (cache hit ratio), deadlocks, temp files, conflicts |
| **`pg_stat_user_tables`** | Per table: seq/idx scans, inserts/updates/deletes, live/dead tuples, last (auto)vacuum/analyze |
| `pg_stat_user_indexes` | Per index: number of scans (unused-index detection) |
| `pg_statio_user_tables` / `_indexes` | Cache hits vs disk reads per object |
| **`pg_stat_statements`** (extension) | Top queries by time/calls |
| `pg_locks` | All locks held/awaited |
| `pg_stat_progress_vacuum` / `_create_index` / `_analyze` / `_cluster` / `_basebackup` / `_copy` | Live progress of long operations |
| `pg_stat_bgwriter`, `pg_stat_checkpointer` (PG 17), `pg_stat_wal`, `pg_stat_io` (PG 16) | Background I/O |
| `pg_stat_replication`, `pg_replication_slots`, `pg_stat_subscription` | Replication |
| `pg_stat_archiver` | WAL archiving success/failure |
| `pg_settings` | All config parameters, current value, source, unit, whether restart is needed |

Useful one-liners:
```sql
-- Cache hit ratio (aim > 99%)
SELECT sum(blks_hit) * 100.0 / nullif(sum(blks_hit) + sum(blks_read), 0) FROM pg_stat_database;

-- Biggest tables
SELECT relname, pg_size_pretty(pg_total_relation_size(relid)) FROM pg_stat_user_tables
ORDER BY pg_total_relation_size(relid) DESC LIMIT 10;

-- Slowest queries
SELECT calls, round(mean_exec_time::numeric, 2) AS ms, query FROM pg_stat_statements ORDER BY total_exec_time DESC LIMIT 10;

-- Fast row count estimate (COUNT(*) is slow on big tables)
SELECT reltuples::bigint FROM pg_class WHERE oid = 'public.orders'::regclass;
```

---

## 20. Configuration

- Files: `postgresql.conf` (main), `postgresql.auto.conf` (from `ALTER SYSTEM`, wins), `pg_hba.conf`,
  `pg_ident.conf`.
- Change from SQL: `ALTER SYSTEM SET work_mem = '32MB'; SELECT pg_reload_conf();`
- Scopes (lowest → highest priority): file → `ALTER DATABASE … SET` → `ALTER ROLE … SET` →
  `ALTER ROLE … IN DATABASE … SET` → session `SET` → `SET LOCAL` (transaction only).
- `pg_settings.context` tells you how a change takes effect:
  `postmaster` = **restart required**, `sighup` = reload, `superuser`/`user` = per session, `internal` = fixed.
- `SHOW all;`, `SHOW config_file;`, `SHOW data_directory;`

### Settings worth knowing
| Area | Parameters |
|---|---|
| Connections | `listen_addresses`, `port`, `max_connections` (100), `superuser_reserved_connections` |
| Memory | `shared_buffers`, `work_mem`, `maintenance_work_mem`, `effective_cache_size`, `huge_pages` |
| Planner | `random_page_cost` (4 → ~1.1 on SSD), `effective_io_concurrency`, `default_statistics_target`, `jit` |
| WAL/checkpoints | `wal_level`, `max_wal_size`, `checkpoint_timeout`, `checkpoint_completion_target`, `synchronous_commit` |
| Autovacuum | `autovacuum`, `autovacuum_max_workers`, `autovacuum_naptime`, `*_scale_factor`, `*_cost_limit` |
| Timeouts | `statement_timeout`, `lock_timeout`, `idle_in_transaction_session_timeout`, `idle_session_timeout`, `transaction_timeout` (PG 17) |
| Logging | `logging_collector`, `log_min_duration_statement` (log slow queries), `log_line_prefix`, `log_lock_waits`, `log_autovacuum_min_duration`, `log_connections` |
| Locale | `timezone`, `datestyle`, `lc_messages`, `client_encoding` |
| Extensions | `shared_preload_libraries` (restart) |
| Parallelism | `max_worker_processes`, `max_parallel_workers`, `max_parallel_workers_per_gather` |

Tools like **PGTune** suggest starting values from RAM/CPU — a nice PostCompass "tuning wizard" idea.

---

## 21. Connections and pooling

- Each connection = one process (~5–10 MB+), so thousands of connections hurt. `max_connections` is usually
  100–500.
- **Connection string formats**: URI `postgresql://user:pass@host:5432/db?sslmode=require` or key/value
  `host=… port=… dbname=… user=…`. Env vars: `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`.
  Password file: `~/.pgpass` (`%APPDATA%\postgresql\pgpass.conf` on Windows). Service file: `pg_service.conf`.
- **Connection poolers** sit between apps and Postgres:
  - **PgBouncer** (most common), **Supavisor** (Supabase's), **pgcat**, **Odyssey**, **pgpool-II**.
  - Modes: **session** (one server conn per client session), **transaction** (server conn per transaction —
    most efficient; breaks session features like `SET`, advisory locks, older prepared statements),
    **statement**.
  - That's why Supabase shows two strings: direct (5432) and pooled (6543).
- Connection states to watch: `idle in transaction` is bad (holds snapshot & locks).

---

## 22. Backup and restore

### Logical backups (SQL-level)
| Tool | Output | Notes |
|---|---|---|
| `pg_dump` | One database | Formats: `-Fp` plain SQL, `-Fc` custom (compressed, selective restore), `-Fd` directory (parallel `-j`), `-Ft` tar |
| `pg_dumpall` | Whole cluster incl. roles & tablespaces | Plain SQL only. `--globals-only` for roles |
| `pg_restore` | Restores `-Fc/-Fd/-Ft` dumps | `-j` parallel, `--clean`, `--if-exists`, `-n schema`, `-t table`, `--list` |
| `psql -f dump.sql` | Restores plain SQL dumps | |
| `COPY` / `\copy` | Table ⇄ CSV | `COPY t TO STDOUT WITH (FORMAT csv, HEADER)` — fastest import/export |

- ✅ Portable across versions/OS, selective.
- ❌ Slow for very big DBs; it's a snapshot (no PITR). Roles aren't in `pg_dump`.
- `pg_dump` output version ≥ server version is required (PostCompass ships matching binaries).

### Physical backups (file-level)
- `pg_basebackup` copies the whole data directory while running (PG 17: `--incremental` +
  `pg_combinebackup`).
- **PITR (point-in-time recovery)**: base backup + archived WAL → restore to *any* moment
  (`recovery_target_time`). Tools: **pgBackRest**, **Barman**, **WAL-G**.
- ✅ Fast, exact. ❌ Same major version & platform only; whole cluster only.

**Rule**: a backup isn't a backup until you've tested restoring it.

---

## 23. Command-line tools

| Tool | Purpose |
|---|---|
| `initdb` | Create a new cluster (data directory). Options: `-D`, `-U`, `--auth`, `-E UTF8`, `--locale`, `--data-checksums` |
| `pg_ctl` | Start/stop/restart/reload/promote a cluster (`pg_ctl -D data start -l logfile`). Stop modes: smart / **fast** / immediate |
| `postgres` | The server binary itself |
| `psql` ⭐ | Interactive terminal |
| `pg_isready` | Is the server accepting connections? (exit codes 0/1/2/3) |
| `createdb` / `dropdb` / `createuser` / `dropuser` | Wrappers around SQL |
| `pg_dump` / `pg_dumpall` / `pg_restore` | Backups (§22) |
| `pg_basebackup` / `pg_combinebackup` / `pg_receivewal` | Physical backups & WAL streaming |
| `pg_upgrade` | Major version upgrade in place (`--link` for speed) |
| `vacuumdb` / `reindexdb` / `clusterdb` | Maintenance across databases |
| `pg_controldata` | Show cluster control info (version, checkpoint, state) |
| `pg_resetwal` | Last-resort recovery (dangerous) |
| `pg_rewind` | Resync an old primary after failover |
| `pg_waldump` | Decode WAL files |
| `pg_checksums` | Enable/verify data checksums offline |
| `pgbench` | Benchmarking |
| `pg_config` | Show build/install paths (where extensions go) |

### psql meta-commands cheat sheet
```
\l            list databases          \c dbname     connect to another database
\dn           schemas                 \dt  [s.]*    tables
\d  table     describe table          \d+ table     + sizes, storage, comments
\di \dv \dm   indexes / views / matviews
\df           functions               \dx           installed extensions
\du           roles                   \dp           privileges
\x            expanded display        \timing       show query time
\e            edit query in $EDITOR   \i file.sql   run a file
\copy         client-side COPY        \watch 2      re-run every 2s
\conninfo     current connection      \q            quit
\set ECHO_HIDDEN on   → shows the catalog SQL psql uses (great for learning how to build PostCompass queries!)
```

---

## 24. Versions and upgrades

- **One major release per year** (Sept/Oct): 13, 14, 15, 16, 17, 18. Each is supported for **5 years**.
- **Minor releases** (18.0 → 18.1) every quarter: bug & security fixes only, same data format — just swap
  binaries and restart.
- **Major upgrades** change the on-disk format. Options: `pg_dump`/`pg_restore`, `pg_upgrade` (fast, minutes),
  or logical replication (near-zero downtime).
- Version check: `SELECT version();`, `SHOW server_version_num;` (e.g. `180000`) — PostCompass should gate
  features/catalog queries on this.

Recent highlights:
| Version | Highlights |
|---|---|
| 13 | B-tree dedup, incremental sort, parallel vacuum of indexes |
| 14 | Faster many-connection performance, multirange types, `pg_stat_wal` |
| 15 | `MERGE`, `public` schema no longer writable by everyone, zstd/lz4 base backup compression, JSON logs |
| 16 | `pg_stat_io`, logical replication from standbys, parallel FULL/RIGHT joins, `pg_maintain` groundwork |
| 17 | New vacuum memory structure (much less memory), incremental backup, `JSON_TABLE`, `MERGE … RETURNING`, `pg_stat_checkpointer`, `transaction_timeout`, `pg_maintain` role |
| 18 | **Asynchronous I/O** (`io_method`), `uuidv7()`, **virtual generated columns** (default), B-tree **skip scan**, `OLD`/`NEW` in `RETURNING`, temporal `WITHOUT OVERLAPS` constraints, OAuth authentication, data checksums on by default, `pg_upgrade` keeps planner stats, md5 passwords deprecated |

---

## 25. The Supabase dashboard, explained in Postgres terms

Supabase is "just Postgres" plus services around it. Every screen maps to Postgres features:

| Supabase screen | Postgres reality |
|---|---|
| **Table Editor** | `SELECT/INSERT/UPDATE/DELETE` + catalog queries on `pg_class`, `pg_attribute`, `pg_constraint` |
| **SQL Editor** | Runs SQL; saved snippets are stored by Supabase, not in Postgres |
| Database → **Schema Visualizer** | Tables + foreign keys from `pg_constraint (contype='f')` drawn as a diagram |
| Database → **Tables / Columns** | `pg_class`, `pg_attribute`, `ALTER TABLE` |
| Database → **Functions** | `pg_proc` (`CREATE FUNCTION`) |
| Database → **Triggers** | `pg_trigger` |
| Database → **Enumerated Types** | `pg_type` + `pg_enum` |
| Database → **Extensions** | `pg_available_extensions` + `CREATE/DROP EXTENSION` (§15) |
| Database → **Indexes** | `pg_index`, `pg_indexes`; the type dropdown = B-tree / Hash / **GIN** / **GiST** / SP-GiST / **BRIN** (§7) |
| Database → **Roles** | `pg_roles`, `CREATE ROLE`, attributes |
| Database → **Policies** / Auth → Policies | RLS: `pg_policy`, `CREATE POLICY` (§13) |
| Database → **Publications** | `pg_publication` — logical replication (Realtime uses `supabase_realtime`) |
| Database → **Replication** (read replicas) | Physical streaming replication |
| Database → **Backups / PITR** | `pg_basebackup` + WAL archiving (WAL-G) |
| Database → **Wrappers** | Foreign Data Wrappers (`wrappers` extension) |
| Database → **Webhooks** | Triggers calling `pg_net` (`supabase_functions.http_request`) |
| **Cron** | `pg_cron` (`cron.job`, `cron.job_run_details`) |
| **Vault** | `supabase_vault` (`vault.secrets`, `vault.decrypted_secrets`) |
| **Queues** | `pgmq` extension |
| Reports / **Query Performance** | `pg_stat_statements` |
| **Advisors** (Security / Performance) | Lint SQL queries ("splinter") over catalogs: RLS disabled, unindexed foreign keys, duplicate/unused indexes, SECURITY DEFINER views, mutable search_path… |
| Settings → Database → **Connection string / Pooler** | Direct port 5432 vs Supavisor pooler 6543 (§21) |
| **Auth** | Postgres schema `auth` (`auth.users`) + GoTrue service; JWT claims read by RLS via `auth.uid()` |
| **Storage** | Schema `storage` (`storage.objects`, `storage.buckets`) + S3-compatible service; RLS on `storage.objects` |
| **Realtime** | Logical replication / WAL decoding broadcast over websockets |
| **API** (auto REST) | PostgREST reads your schema and turns tables/views/functions into HTTP endpoints using roles `anon`/`authenticated` |
| **GraphQL** | `pg_graphql` extension |

---

## 26. What this means for PostCompass

How each feature (built or planned) maps to the Postgres knowledge above:

| PostCompass feature | Postgres mechanism | Watch out for |
|---|---|---|
| Install / start / stop local DB | `initdb`, `pg_ctl`, `postmaster.pid`, `pg_isready` | Port conflicts; data dir permissions; `listen_addresses=127.0.0.1` |
| Connect dialog (URI/psql/.env/JDBC) | Connection strings, `sslmode` | URL-encode passwords |
| Object tree | `pg_namespace`, `pg_class` (relkind), `pg_proc`, `pg_type`, `pg_extension` | Hide `pg_toast`, `pg_temp_*`; one connection per database |
| Table data grid | `SELECT … LIMIT/OFFSET` or keyset paging; `ctid` / primary key for edits | `bigint`/`numeric` as strings; tables with no PK are read-only; `reltuples` for fast counts |
| Table designer | `ALTER TABLE`, `pg_get_*def()` for DDL | Rewrites & ACCESS EXCLUSIVE locks — warn users, use `lock_timeout` |
| Index manager | `pg_index`, `pg_stat_user_indexes`, `CREATE INDEX CONCURRENTLY` | Show type (B-tree/GIN/GiST/BRIN), size, scans, invalid state |
| SQL editor | Simple vs extended protocol, transactions, `statement_timeout`, `pg_cancel_backend` | Multiple statements, notices (`RAISE NOTICE`), autocommit toggle |
| Visual EXPLAIN | `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` | ANALYZE executes writes → wrap in ROLLBACK |
| ER diagram | `pg_constraint` FKs | Composite and cross-schema FKs |
| Backup / restore | `pg_dump -Fc`, `pg_restore`, `pg_dumpall --globals-only` | Version-matched binaries; roles aren't in pg_dump |
| Monitoring (planned) | `pg_stat_activity`, `pg_stat_database`, `pg_stat_statements`, `pg_locks`, `pg_stat_progress_*` | `pg_stat_statements` needs `shared_preload_libraries` + restart |
| Roles & users (planned) | `pg_roles`, `pg_auth_members`, GRANT/REVOKE, default privileges | Roles are cluster-wide |
| RLS policy editor | `pg_policy`, `CREATE POLICY` | USING vs WITH CHECK |
| Extensions page | `pg_available_extensions`, `pg_extension` | Preload + restart for some; third-party binaries not bundled |
| Settings editor | `pg_settings` (context, unit, min/max, enumvals), `ALTER SYSTEM`, `pg_reload_conf()` | Show "restart required" badges |
| Health advisor | Bloat (`pgstattuple`/estimates), unused/duplicate indexes, unindexed FKs, wraparound age, inactive slots, idle-in-transaction | |
| Cloud connections (last) | Same catalogs; SSL, poolers (transaction mode), limited privileges (no superuser) | Feature-detect privileges & extensions |

Driver note: the Rust driver (`tokio-postgres`) speaks the **wire protocol** (startup → auth (SCRAM) →
simple/extended query → row descriptions with type OIDs → data rows). Type OIDs from `pg_type` decide how each
column is decoded and rendered.

---

## 27. Glossary

| Term | Meaning |
|---|---|
| **ACID** | Atomicity, Consistency, Isolation, Durability |
| **Autovacuum** | Background process that vacuums & analyzes tables automatically |
| **Backend** | Server process serving one connection |
| **Bloat** | Wasted space from dead tuples / half-empty pages |
| **Catalog** | System tables describing the database (`pg_catalog`) |
| **Checkpoint** | Point where all dirty pages are flushed; recovery starts here |
| **CLOG / pg_xact** | Commit status of every transaction |
| **Cluster** | One Postgres instance (data directory + server process) |
| **ctid** | Physical row address (page, item) |
| **Dead tuple** | Old row version no transaction can see |
| **FDW** | Foreign Data Wrapper — access external data as tables |
| **Fillfactor** | % of a page filled on insert (room for HOT updates) |
| **Freeze** | Mark old tuples as visible forever (prevents wraparound) |
| **GIN / GiST / SP-GiST / BRIN** | Index types (§7) |
| **Heap** | A table's main data file (unordered rows) |
| **HOT** | Heap-Only Tuple update (no index changes) |
| **LSN** | Log Sequence Number — position in WAL |
| **MVCC** | Multi-Version Concurrency Control |
| **OID** | Object identifier |
| **Page / block** | 8 KB unit of storage |
| **PITR** | Point-In-Time Recovery |
| **Postmaster** | The main server process |
| **Relation** | Any table-like object (table, index, view, sequence…) in `pg_class` |
| **Replication slot** | Keeps WAL for a consumer until it's read |
| **RLS** | Row-Level Security |
| **Schema** | Namespace inside a database |
| **search_path** | Ordered list of schemas used to resolve unqualified names |
| **Snapshot** | Set of transactions visible to a query/transaction |
| **SSI** | Serializable Snapshot Isolation |
| **Tablespace** | Disk location for data files |
| **TOAST** | Out-of-line storage for large values |
| **Tuple** | A row version |
| **Visibility map** | Bitmap of all-visible / all-frozen pages |
| **WAL** | Write-Ahead Log |
| **Wraparound** | 32-bit transaction ID counter overflow, prevented by freezing |
| **XID** | Transaction ID |

---

## 28. Learning path

1. **Use it**: install (PostCompass does this), connect with `psql`, create tables, insert data, run joins.
2. **Model data**: types (§5), constraints & keys (§6), normalization, JSONB where flexible (§16).
3. **Indexes & EXPLAIN** (§7–8): add an index, compare `EXPLAIN ANALYZE` before/after. Try GIN on JSONB and
   `pg_trgm`, BRIN on a timestamp.
4. **Concurrency** (§9–10): open two psql windows, run conflicting transactions, watch `pg_locks` and
   `pg_stat_activity`, see MVCC with `xmin/xmax`.
5. **Operations** (§11, 20, 22): change settings, take and restore a `pg_dump`, read the logs.
6. **Security** (§13): create roles, GRANTs, then RLS policies like Supabase.
7. **Extensions** (§15): `pg_stat_statements`, `pg_trgm`, `pgcrypto`, then pgvector/PostGIS/pg_cron.
8. **Internals** (§3–4, 19): `\set ECHO_HIDDEN on` in psql to see the catalog queries behind `\d` — the exact
   skill needed to build PostCompass.

**Best references**
- Official docs: <https://www.postgresql.org/docs/current/> (Tutorial, Ch. 11 Indexes, Ch. 13 Concurrency,
  Ch. 14 Performance Tips, Ch. 25 Maintenance, Ch. 28 WAL, Ch. 51+ System Catalogs)
- *The Internals of PostgreSQL* — <https://www.interdb.jp/pg/>
- *PostgreSQL 14 Internals* (free book by Egor Rogov, Postgres Professional)
- *Use The Index, Luke* — <https://use-the-index-luke.com/>
- Supabase docs → Database section (RLS, extensions, indexes)
- `explain.depesz.com` / `explain.dalibo.com` for reading plans
