//! End-to-end install test: really downloads (or reuses a cached archive), initializes, starts,
//! connects to, stops and uninstalls a PostgreSQL server in a temporary folder.
//!
//! Slow and needs the network, so it is ignored by default:
//!   cargo test -p runtime-postgres --test install_e2e -- --ignored --nocapture
//! Set `POSTCOMPASS_PG_ARCHIVE` to a downloaded archive to skip the download.

use std::sync::{Arc, Mutex};

use driver_postgres::PostgresDriver;
use pc_core::driver::{
    ColumnValue, ConnectionConfig, DatabaseDriver, DriverSession, FilterOp, FilterSpec, ObjectKind,
    RowChange, RowsRequest, SortSpec, StatementResult,
};
use pc_core::runtime::{
    CancellationToken, InstallContext, InstallEvent, InstallRequest, LocalRuntime, ServerStatus,
    StepState,
};
use runtime_postgres::PostgresRuntime;

const VERSION: &str = "18.6.0";

#[tokio::test(flavor = "multi_thread")]
#[ignore = "downloads PostgreSQL and runs a real server"]
async fn installs_starts_stops_and_uninstalls() {
    let root = std::env::temp_dir().join(format!("postcompass-e2e-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&root);

    if let Ok(archive) = std::env::var("POSTCOMPASS_PG_ARCHIVE") {
        let name = std::path::Path::new(&archive)
            .file_name()
            .unwrap()
            .to_owned();
        std::fs::create_dir_all(root.join("downloads")).unwrap();
        std::fs::copy(&archive, root.join("downloads").join(name)).unwrap();
    }

    let runtime = PostgresRuntime;
    // Inside the range detection probes (5432–5442), so the detection check below can see it
    let port = runtime_postgres::first_free_port(5433)
        .filter(|p| *p <= 5442)
        .expect("a free port in 5433–5442");
    let events: Arc<Mutex<Vec<InstallEvent>>> = Arc::default();
    let sink = events.clone();
    let ctx = InstallContext {
        progress: Arc::new(move |event| {
            if let InstallEvent::Step {
                step,
                state,
                detail,
            } = &event
            {
                println!("{step:?} {state:?} {}", detail.as_deref().unwrap_or(""));
            }
            sink.lock().unwrap().push(event);
        }),
        cancel: CancellationToken::new(),
        root_dir: root.clone(),
    };

    let request = InstallRequest {
        version: VERSION.into(),
        port,
        name: "E2E PostgreSQL".into(),
        password: "e2e-Secret-123".into(),
        data_dir: None,
        auto_start: false,
        database: None,
    };

    let server = runtime
        .install(request, ctx)
        .await
        .expect("install succeeds");
    let _guard = StopOnDrop(server.clone());
    assert_eq!(runtime.status(&server).await, ServerStatus::Running);
    assert!(
        runtime_postgres::is_postgres("127.0.0.1", port).await,
        "server answers the handshake"
    );

    // Every step finished (done or skipped), none failed
    let failed = events.lock().unwrap().iter().any(|e| {
        matches!(
            e,
            InstallEvent::Step {
                state: StepState::Failed,
                ..
            }
        )
    });
    assert!(!failed, "no install step failed");

    // Detection labels our own install as managed
    let report = runtime.detect(Some(root.clone())).await;
    assert!(
        report.servers.iter().any(|s| s.port == port),
        "detection sees the running server"
    );

    // The driver connects with the install password and can inspect the server
    let config = ConnectionConfig {
        host: server.host.clone(),
        port: server.port,
        user: server.superuser.clone(),
        password: "e2e-Secret-123".into(),
        database: "postgres".into(),
        ssl_mode: Default::default(),
        ca_cert: None,
    };
    let tested = PostgresDriver
        .test_connection(&config)
        .await
        .expect("test connection succeeds");
    assert!(
        tested.server_version.starts_with("18."),
        "version {}",
        tested.server_version
    );
    let session = PostgresDriver
        .connect(config.clone())
        .await
        .expect("connect succeeds");
    let databases = session.databases().await.expect("list databases");
    assert!(
        databases
            .iter()
            .any(|d| d.name == "postgres" && d.size_bytes.is_some())
    );
    let schemas = session.schemas("postgres").await.expect("list schemas");
    assert!(schemas.iter().any(|s| s.name == "public" && !s.is_system));
    assert!(
        schemas
            .iter()
            .any(|s| s.name == "pg_catalog" && s.is_system)
    );
    let catalog = session
        .tables("postgres", "pg_catalog")
        .await
        .expect("list tables");
    assert!(catalog.iter().any(|t| t.name == "pg_class"));
    let err = session
        .schemas("no_such_db")
        .await
        .expect_err("missing database fails");
    assert_eq!(err.code(), pc_core::ErrorCode::NotFound);
    exercise_driver(session.as_ref()).await;
    drop(session);
    exercise_backup_restore(&server, &config, &root).await;

    let wrong = ConnectionConfig {
        password: "wrong".into(),
        ..config
    };
    let err = PostgresDriver.test_connection(&wrong).await.unwrap_err();
    assert_eq!(err.code(), pc_core::ErrorCode::AuthFailed);

    runtime.stop(&server).await.expect("stop succeeds");
    assert_eq!(runtime.status(&server).await, ServerStatus::Stopped);

    runtime.start(&server).await.expect("restart succeeds");
    assert_eq!(runtime.status(&server).await, ServerStatus::Running);

    runtime
        .uninstall(&server, false)
        .await
        .expect("uninstall succeeds");
    assert!(
        !std::path::Path::new(&server.data_dir).exists(),
        "data folder deleted"
    );

    let _ = std::fs::remove_dir_all(&root);
}

#[tokio::test(flavor = "multi_thread")]
#[ignore = "downloads PostgreSQL"]
async fn port_in_use_fails_cleanly() {
    let root = std::env::temp_dir().join(format!("postcompass-e2e-port-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&root);
    let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let port = listener.local_addr().unwrap().port();

    let ctx = InstallContext {
        progress: Arc::new(|_| {}),
        cancel: CancellationToken::new(),
        root_dir: root.clone(),
    };
    let request = InstallRequest {
        version: VERSION.into(),
        port,
        name: "Port test".into(),
        password: "e2e-Secret-123".into(),
        data_dir: None,
        auto_start: false,
        database: None,
    };
    let err = PostgresRuntime.install(request, ctx).await.unwrap_err();
    assert_eq!(err.code(), pc_core::ErrorCode::PortInUse);
    assert!(!root.join("servers").exists(), "nothing left behind");
    let _ = std::fs::remove_dir_all(&root);
}

/// Backs up the database the driver test filled, restores it into new databases, and checks the data.
async fn exercise_backup_restore(
    server: &pc_core::runtime::ManagedServer,
    config: &ConnectionConfig,
    root: &std::path::Path,
) {
    use pc_core::runtime::{
        BackupContent, BackupFormat, BackupRequest, RestoreRequest, ToolConnection,
    };
    use runtime_postgres::tools;

    let bin = std::path::Path::new(&server.bin_dir);
    let conn = ToolConnection {
        host: config.host.clone(),
        port: config.port,
        user: config.user.clone(),
        password: config.password.clone(),
    };
    let lines = Arc::new(Mutex::new(Vec::<String>::new()));
    let sink = lines.clone();
    let log = move |line: String| sink.lock().unwrap().push(line);
    let never = CancellationToken::new();

    let custom = root.join("backup.dump");
    let plain = root.join("backup.sql");
    for (path, format) in [
        (&custom, BackupFormat::Custom),
        (&plain, BackupFormat::Plain),
    ] {
        let result = tools::backup(
            bin,
            &conn,
            &BackupRequest {
                database: "postgres".into(),
                path: path.to_string_lossy().into_owned(),
                format,
                content: BackupContent::All,
                no_owner: true,
            },
            &log,
            &never,
        )
        .await
        .expect("backup succeeds");
        assert!(result.size_bytes > 0.0);
        assert!(
            !path.with_extension("partial").exists(),
            "temporary file cleaned up"
        );
    }
    assert!(
        lines
            .lock()
            .unwrap()
            .iter()
            .any(|l| l.contains("dumping contents of table"))
    );
    assert_eq!(
        tools::detect_format(&custom).await.unwrap(),
        BackupFormat::Custom
    );
    assert_eq!(
        tools::detect_format(&plain).await.unwrap(),
        BackupFormat::Plain
    );

    // Restore each format into a brand-new database and check the rows arrived
    for (path, db) in [(&custom, "restored_custom"), (&plain, "restored_plain")] {
        tools::restore(
            bin,
            &conn,
            &RestoreRequest {
                database: db.into(),
                path: path.to_string_lossy().into_owned(),
                create_database: true,
                clean: false,
                no_owner: true,
            },
            &log,
            &never,
        )
        .await
        .unwrap_or_else(|e| panic!("restore into {db} failed: {e}"));

        let session = PostgresDriver
            .connect(ConnectionConfig {
                database: db.into(),
                ..config.clone()
            })
            .await
            .expect("connect to restored database");
        let count = session
            .execute(db, "select count(*) from customer", 10, never.clone(), None)
            .await
            .unwrap();
        assert_eq!(
            first_cell(&count).as_deref(),
            Some("250"),
            "{db} has all customers"
        );
    }

    // Restoring on top of existing objects fails, and the single transaction leaves nothing half-done
    let err = tools::restore(
        bin,
        &conn,
        &RestoreRequest {
            database: "restored_plain".into(),
            path: plain.to_string_lossy().into_owned(),
            create_database: false,
            clean: false,
            no_owner: true,
        },
        &log,
        &never,
    )
    .await
    .expect_err("restoring into a database that already has the tables fails");
    assert_eq!(err.code(), pc_core::ErrorCode::ProcessFailed);

    // --clean replaces existing objects for custom archives
    tools::restore(
        bin,
        &conn,
        &RestoreRequest {
            database: "restored_custom".into(),
            path: custom.to_string_lossy().into_owned(),
            create_database: false,
            clean: true,
            no_owner: true,
        },
        &log,
        &never,
    )
    .await
    .expect("clean restore over an existing database succeeds");
}

/// Stops the test server even if an assertion panics, so failed runs don't leave servers running.
struct StopOnDrop(pc_core::runtime::ManagedServer);

impl Drop for StopOnDrop {
    fn drop(&mut self) {
        let pg_ctl = std::path::Path::new(&self.0.bin_dir).join(if cfg!(windows) {
            "pg_ctl.exe"
        } else {
            "pg_ctl"
        });
        let _ = std::process::Command::new(pg_ctl)
            .args(["stop", "-D", &self.0.data_dir, "-m", "immediate", "-w"])
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .status();
    }
}

fn cv(column: &str, value: Option<&str>) -> ColumnValue {
    ColumnValue {
        column: column.into(),
        value: value.map(Into::into),
    }
}

fn first_cell(result: &pc_core::driver::ExecuteResult) -> Option<String> {
    match &result.statements[0] {
        StatementResult::Rows { rows, .. } => rows[0][0].clone(),
        StatementResult::Command { .. } => None,
    }
}

fn rows_request(
    offset: u32,
    limit: u32,
    sort: Vec<SortSpec>,
    filters: Vec<FilterSpec>,
) -> RowsRequest {
    RowsRequest {
        offset,
        limit,
        sort,
        filters,
    }
}

/// Exercises every driver capability the explorer, table viewer, SQL editor and editors use.
async fn exercise_driver(session: &dyn DriverSession) {
    let db = "postgres";
    let never = CancellationToken::new();

    // SQL editor: several statements in one run, mixed results
    let setup = session
        .execute(
            db,
            "create table customer (id int generated always as identity primary key, name text not null, email text unique);
             create table orders (id bigserial primary key, customer_id int references customer(id) on delete cascade,
                                  total numeric(10,2) check (total >= 0), placed_at timestamptz default now());
             create index orders_customer_idx on orders (customer_id);
             create view big_orders as select * from orders where total > 100;
             create type mood as enum ('happy', 'sad');
             create function add_one(x int) returns int language sql as 'select x + 1';
             insert into customer (name, email) select 'Customer ' || g, 'c' || g || '@example.com' from generate_series(1, 250) g;
             insert into orders (customer_id, total) select (g % 250) + 1, g * 1.5 from generate_series(1, 500) g;
             select count(*) as n from customer;",
            100,
            never.clone(),
            None,
        )
        .await
        .expect("execute runs");
    assert!(setup.error.is_none(), "setup failed: {:?}", setup.error);
    assert!(
        matches!(setup.statements.last(), Some(StatementResult::Rows { rows, .. }) if rows[0][0].as_deref() == Some("250"))
    );

    // SQL errors come back in the result with a position, not as Err
    let bad = session
        .execute(db, "select * from no_such_table", 100, never.clone(), None)
        .await
        .unwrap();
    let err = bad.error.expect("error reported");
    assert_eq!(err.code.as_deref(), Some("42P01"));
    assert_eq!(err.position, Some(15));

    // Row cap keeps counting
    let capped = session
        .execute(
            db,
            "select g from generate_series(1, 30) g",
            10,
            never.clone(),
            None,
        )
        .await
        .unwrap();
    assert!(
        matches!(&capped.statements[0], StatementResult::Rows { rows, truncated: true, row_count, .. } if rows.len() == 10 && *row_count == 30.0)
    );

    // Table viewer: paging, sorting, filtering, totals
    let page = session
        .rows(
            db,
            "public",
            "customer",
            rows_request(0, 100, vec![], vec![]),
        )
        .await
        .expect("rows");
    assert_eq!(page.rows.len(), 100);
    assert!(page.has_more);
    assert_eq!(page.total, Some(250.0));
    assert!(!page.total_is_estimate);
    assert_eq!(page.key_columns, vec!["id".to_string()]);
    assert_eq!(
        page.rows[0][0].as_deref(),
        Some("1"),
        "default order is by primary key"
    );

    let last_page = session
        .rows(
            db,
            "public",
            "customer",
            rows_request(200, 100, vec![], vec![]),
        )
        .await
        .unwrap();
    assert_eq!(last_page.rows.len(), 50);
    assert!(!last_page.has_more);

    let sorted = session
        .rows(
            db,
            "public",
            "customer",
            rows_request(
                0,
                5,
                vec![SortSpec {
                    column: "id".into(),
                    descending: true,
                }],
                vec![FilterSpec {
                    column: "name".into(),
                    op: FilterOp::Contains,
                    value: Some("customer 2".into()),
                }],
            ),
        )
        .await
        .unwrap();
    assert_eq!(sorted.rows[0][0].as_deref(), Some("250"));
    assert!(sorted.total.unwrap() > 0.0);

    let typed = session
        .rows(
            db,
            "public",
            "customer",
            rows_request(
                0,
                100,
                vec![],
                vec![FilterSpec {
                    column: "id".into(),
                    op: FilterOp::LessOrEqual,
                    value: Some("3".into()),
                }],
            ),
        )
        .await
        .unwrap();
    assert_eq!(typed.rows.len(), 3);

    let view = session
        .rows(
            db,
            "public",
            "big_orders",
            rows_request(0, 10, vec![], vec![]),
        )
        .await
        .unwrap();
    assert!(view.key_columns.is_empty(), "views are read-only");

    // Structure and definitions
    let structure = session
        .table_structure(db, "public", "orders")
        .await
        .expect("structure");
    assert_eq!(structure.primary_key, vec!["id".to_string()]);
    assert_eq!(structure.foreign_keys.len(), 1);
    assert_eq!(structure.foreign_keys[0].referenced_table, "customer");
    assert_eq!(structure.foreign_keys[0].on_delete, "CASCADE");
    assert!(
        structure
            .indexes
            .iter()
            .any(|i| i.name == "orders_customer_idx")
    );
    assert_eq!(structure.constraints.len(), 1, "one check constraint");
    let total_col = structure
        .columns
        .iter()
        .find(|c| c.name == "total")
        .unwrap();
    assert_eq!(total_col.data_type, "numeric(10,2)");

    let customer = session
        .table_structure(db, "public", "customer")
        .await
        .unwrap();
    assert_eq!(customer.columns[0].identity.as_deref(), Some("always"));

    let ddl = session
        .definition(db, "public", ObjectKind::Table, "orders")
        .await
        .expect("table ddl");
    assert!(ddl.contains("CREATE TABLE public.orders"), "{ddl}");
    assert!(
        ddl.contains("REFERENCES customer(id) ON DELETE CASCADE"),
        "{ddl}"
    );
    assert!(ddl.contains("CREATE INDEX orders_customer_idx"), "{ddl}");
    let view_ddl = session
        .definition(db, "public", ObjectKind::View, "big_orders")
        .await
        .unwrap();
    assert!(view_ddl.starts_with("CREATE VIEW public.big_orders AS"));

    let objects = session.schema_objects(db, "public").await.expect("objects");
    let add_one = objects
        .functions
        .iter()
        .find(|f| f.name == "add_one")
        .expect("function listed");
    let fn_ddl = session
        .definition(db, "public", ObjectKind::Function, &add_one.id)
        .await
        .unwrap();
    assert!(fn_ddl.contains("CREATE OR REPLACE FUNCTION public.add_one"));
    assert!(objects.sequences.iter().any(|s| s.name == "orders_id_seq"));
    assert!(
        objects
            .enums
            .iter()
            .any(|e| e.name == "mood" && e.values == vec!["happy", "sad"])
    );
    let seq_ddl = session
        .definition(db, "public", ObjectKind::Sequence, "orders_id_seq")
        .await
        .unwrap();
    assert!(seq_ddl.starts_with("CREATE SEQUENCE public.orders_id_seq"));

    // ER diagram graph
    let graph = session.schema_graph(db, "public").await.expect("graph");
    assert!(graph.tables.iter().any(|t| t.name == "customer"));
    assert!(graph.relations.iter().any(|r| r.from_table == "orders"
        && r.to_table == "customer"
        && r.from_columns == vec!["customer_id"]));

    // Editing: preview, apply, and all-or-nothing on failure
    let changes = vec![
        RowChange::Update {
            key: vec![cv("id", Some("1"))],
            values: vec![cv("name", Some("O'Brien"))],
        },
        RowChange::Insert {
            values: vec![cv("name", Some("New")), cv("email", None)],
        },
        RowChange::Delete {
            key: vec![cv("id", Some("2"))],
        },
    ];
    let preview = session
        .preview_changes(db, "public", "customer", &changes)
        .await
        .expect("preview");
    assert_eq!(
        preview[0],
        "UPDATE public.customer SET name = 'O''Brien'::text WHERE id = '1'::integer;"
    );
    let applied = session
        .apply_changes(db, "public", "customer", &changes)
        .await
        .expect("apply");
    assert_eq!(
        (applied.inserted, applied.updated, applied.deleted),
        (1, 1, 1)
    );
    let check = session
        .execute(
            db,
            "select name from customer where id = 1",
            10,
            never.clone(),
            None,
        )
        .await
        .unwrap();
    assert_eq!(first_cell(&check).as_deref(), Some("O'Brien"));

    let failing = vec![
        RowChange::Update {
            key: vec![cv("id", Some("3"))],
            values: vec![cv("name", Some("Should not stick"))],
        },
        // NOT NULL violation fails the whole batch
        RowChange::Update {
            key: vec![cv("id", Some("4"))],
            values: vec![cv("name", None)],
        },
    ];
    assert!(
        session
            .apply_changes(db, "public", "customer", &failing)
            .await
            .is_err()
    );
    let unchanged = session
        .execute(
            db,
            "select name from customer where id = 3",
            10,
            never.clone(),
            None,
        )
        .await
        .unwrap();
    assert_eq!(first_cell(&unchanged).as_deref(), Some("Customer 3"));

    let missing_row = vec![RowChange::Delete {
        key: vec![cv("id", Some("999999"))],
    }];
    assert!(
        session
            .apply_changes(db, "public", "customer", &missing_row)
            .await
            .is_err()
    );

    // EXPLAIN, and EXPLAIN ANALYZE never commits
    let plan = session
        .explain(db, "select * from orders where customer_id = 5", false)
        .await
        .expect("explain");
    assert!(plan.plan_json.contains("\"Plan\""));
    // (customer 2 was deleted above, cascading to its orders, so count first)
    let before = session
        .execute(db, "select count(*) from orders", 10, never.clone(), None)
        .await
        .unwrap();
    let analyzed = session
        .explain(db, "delete from orders", true)
        .await
        .expect("explain analyze");
    assert!(analyzed.plan_json.contains("Actual"));
    let after = session
        .execute(db, "select count(*) from orders", 10, never.clone(), None)
        .await
        .unwrap();
    assert_eq!(
        first_cell(&after),
        first_cell(&before),
        "EXPLAIN ANALYZE rolled back"
    );
    assert_ne!(first_cell(&after).as_deref(), Some("0"));

    // Extensions are listed
    let extensions = session.extensions(db).await.expect("extensions");
    assert!(
        extensions
            .iter()
            .any(|e| e.name == "plpgsql" && e.installed_version.is_some())
    );

    // Cancelling a running query
    let cancel = CancellationToken::new();
    let trigger = cancel.clone();
    tokio::spawn(async move {
        tokio::time::sleep(std::time::Duration::from_millis(500)).await;
        trigger.cancel();
    });
    let slow = session
        .execute(db, "select pg_sleep(30)", 10, cancel, None)
        .await
        .unwrap();
    assert!(slow.cancelled);
    assert_eq!(slow.error.and_then(|e| e.code).as_deref(), Some("57014"));
    assert!(slow.duration_ms < 10_000);
}
