import { Badge, Button, cn, EmptyState, Skeleton, StatusDot } from "@repo/ui";
import { ChevronRight, Database, Eye, FolderTree, Layers, RefreshCw, Table2, Unplug } from "lucide-react";
import { type ReactNode, useCallback, useEffect, useState } from "react";
import { useAppState } from "../../app/app-state";
import type { DatabaseInfo, OpenedConnection, SchemaInfo, TableInfo, TableKind } from "../../lib/bindings";
import { formatBytes, formatCount } from "../../lib/format";
import { commands, describeError, unwrap } from "../../lib/ipc";

type Load<T> = { status: "loading" } | { status: "ready"; data: T } | { status: "error"; message: string };

/** Loads `fetch()` whenever `key` changes. `null` key means "nothing selected". */
function useLoad<T>(key: string | null, fetch: () => Promise<T>) {
  const [state, setState] = useState<Load<T>>({ status: "loading" });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (key === null) return;
    let alive = true;
    setState({ status: "loading" });
    fetch()
      .then((data) => alive && setState({ status: "ready", data }))
      .catch((e: unknown) => alive && setState({ status: "error", message: describeError(e).message }));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` captures everything `fetch` depends on
  }, [key, nonce]);

  return { state, reload: useCallback(() => setNonce((n) => n + 1), []) };
}

/** Browse a connected server: databases → schemas → tables. */
export function ExplorerPage({ serverId, onClose }: { serverId: string; onClose: () => void }) {
  const { state } = useAppState();
  const server = state.servers.find((s) => s.id === serverId);
  const [connection, setConnection] = useState<Load<OpenedConnection>>({ status: "loading" });
  const [database, setDatabase] = useState<string | null>(null);
  const [schema, setSchema] = useState<string | null>(null);

  const connect = useCallback(() => {
    setConnection({ status: "loading" });
    unwrap(commands.openServer(serverId))
      .then((opened) => {
        setConnection({ status: "ready", data: opened });
        setDatabase((db) => db ?? opened.database);
      })
      .catch((e: unknown) => {
        const { title, message, hint } = describeError(e);
        setConnection({ status: "error", message: hint ? `${title}: ${message}. ${hint}` : `${title}: ${message}` });
      });
  }, [serverId]);

  useEffect(connect, [connect]);

  const connectionId = connection.status === "ready" ? connection.data.connectionId : null;

  const databases = useLoad<DatabaseInfo[]>(connectionId, () => unwrap(commands.listDatabases(connectionId!)));
  const schemas = useLoad<SchemaInfo[]>(connectionId && database ? `${connectionId}/${database}` : null, () =>
    unwrap(commands.listSchemas(connectionId!, database!)),
  );
  const tables = useLoad<TableInfo[]>(
    connectionId && database && schema ? `${connectionId}/${database}/${schema}` : null,
    () => unwrap(commands.listTables(connectionId!, database!, schema!)),
  );

  // Default to the "public" schema (or the first user schema) when a database is picked
  useEffect(() => {
    if (schemas.state.status !== "ready") return;
    const names = schemas.state.data;
    if (schema && names.some((s) => s.name === schema)) return;
    setSchema(names.find((s) => s.name === "public")?.name ?? names.find((s) => !s.isSystem)?.name ?? null);
  }, [schemas.state, schema]);

  const disconnect = async () => {
    if (connectionId) await commands.closeConnection(connectionId);
    onClose();
  };

  if (!server) {
    return <EmptyState title="Server not found" description="It may have been removed." />;
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-border px-6">
        <div className="flex min-w-0 items-center gap-3">
          <span className="truncate text-sm font-semibold">{server.name}</span>
          {connection.status === "ready" && (
            <span className="flex items-center gap-2 text-xs text-fg-muted">
              <StatusDot status="running" />
              Connected · PostgreSQL {connection.data.serverVersion} · {connection.data.latencyMs} ms
            </span>
          )}
          {connection.status === "loading" && <span className="text-xs text-fg-subtle">Connecting…</span>}
        </div>
        <div className="flex items-center gap-2">
          {connection.status === "ready" && (
            <Button
              size="sm"
              variant="ghost"
              iconLeft={<RefreshCw />}
              onClick={() => {
                databases.reload();
                schemas.reload();
                tables.reload();
              }}
            >
              Refresh
            </Button>
          )}
          <Button size="sm" iconLeft={<Unplug />} onClick={() => void disconnect()}>
            Disconnect
          </Button>
        </div>
      </header>

      {connection.status === "error" ? (
        <div className="flex flex-1 items-center justify-center">
          <EmptyState
            icon={<Unplug />}
            title="Couldn't open this server"
            description={connection.message}
            actions={
              <>
                <Button onClick={onClose}>Back</Button>
                <Button variant="primary" onClick={connect}>
                  Try again
                </Button>
              </>
            }
          />
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-[220px_240px_1fr]">
          <Pane title="Databases" icon={<Database />}>
            <List
              load={databases.state}
              empty="No databases"
              items={(data) =>
                data.map((db) => (
                  <Item
                    key={db.name}
                    active={db.name === database}
                    disabled={!db.allowConnections}
                    onClick={() => {
                      setDatabase(db.name);
                      setSchema(null);
                    }}
                    label={db.name}
                    meta={formatBytes(db.sizeBytes)}
                  />
                ))
              }
            />
          </Pane>

          <Pane title="Schemas" icon={<FolderTree />}>
            <List
              load={database ? schemas.state : { status: "ready", data: [] }}
              empty="No schemas"
              items={(data) => {
                const user = data.filter((s) => !s.isSystem);
                const system = data.filter((s) => s.isSystem);
                return [
                  ...user.map((s) => (
                    <Item
                      key={s.name}
                      active={s.name === schema}
                      onClick={() => setSchema(s.name)}
                      label={s.name}
                      meta={String(s.tableCount)}
                    />
                  )),
                  system.length > 0 && (
                    <li key="__system" className="px-3 pt-3 pb-1 text-[10px] font-medium tracking-wide text-fg-subtle uppercase">
                      System
                    </li>
                  ),
                  ...system.map((s) => (
                    <Item
                      key={s.name}
                      active={s.name === schema}
                      onClick={() => setSchema(s.name)}
                      label={s.name}
                      meta={String(s.tableCount)}
                      muted
                    />
                  )),
                ];
              }}
            />
          </Pane>

          <section className="flex min-w-0 flex-col overflow-hidden">
            <div className="flex h-10 shrink-0 items-center gap-1.5 border-b border-border px-4 text-xs text-fg-muted">
              <span>{database ?? "—"}</span>
              <ChevronRight className="size-3 text-fg-subtle" />
              <span className="text-fg">{schema ?? "—"}</span>
            </div>
            <div className="min-h-0 flex-1 overflow-auto">
              <TablesView load={schema ? tables.state : null} schema={schema} />
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

const KIND_LABELS: Record<TableKind, string> = {
  table: "Table",
  partitioned_table: "Partitioned",
  view: "View",
  materialized_view: "Materialized view",
  foreign_table: "Foreign table",
};

function TablesView({ load, schema }: { load: Load<TableInfo[]> | null; schema: string | null }) {
  if (!load) {
    return <EmptyState icon={<Layers />} title="Pick a schema" description="Choose a schema to see its tables." />;
  }
  if (load.status === "loading") {
    return (
      <div className="flex flex-col gap-2 p-4">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-8" />
        ))}
      </div>
    );
  }
  if (load.status === "error") {
    return <p className="p-4 text-sm text-danger">{load.message}</p>;
  }
  if (load.data.length === 0) {
    return (
      <EmptyState
        icon={<Table2 />}
        title={`${schema} is empty`}
        description="Tables and views you create in this schema will show up here."
      />
    );
  }
  return (
    <table className="w-full text-sm">
      <thead className="sticky top-0 bg-bg text-left text-xs text-fg-subtle">
        <tr className="border-b border-border">
          <th className="px-4 py-2 font-medium">Name</th>
          <th className="px-4 py-2 font-medium">Type</th>
          <th className="px-4 py-2 text-right font-medium">Rows (est.)</th>
          <th className="px-4 py-2 text-right font-medium">Size</th>
        </tr>
      </thead>
      <tbody>
        {load.data.map((t) => (
          <tr key={t.name} className="border-b border-border/60 hover:bg-surface-hover">
            <td className="px-4 py-2">
              <span className="flex items-center gap-2">
                {t.kind === "view" || t.kind === "materialized_view" ? (
                  <Eye className="size-3.5 text-fg-subtle" />
                ) : (
                  <Table2 className="size-3.5 text-fg-subtle" />
                )}
                <span className="font-mono text-xs text-fg">{t.name}</span>
              </span>
            </td>
            <td className="px-4 py-2">
              <Badge>{KIND_LABELS[t.kind]}</Badge>
            </td>
            <td className="px-4 py-2 text-right font-mono text-xs text-fg-muted">{formatCount(t.rowEstimate)}</td>
            <td className="px-4 py-2 text-right font-mono text-xs text-fg-muted">{formatBytes(t.sizeBytes)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Pane({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section className="flex min-h-0 flex-col border-r border-border">
      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-border px-3 text-xs font-medium text-fg-muted [&_svg]:size-3.5">
        {icon}
        {title}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto py-1">{children}</div>
    </section>
  );
}

function List<T>({ load, items, empty }: { load: Load<T>; items: (data: T) => ReactNode; empty: string }) {
  if (load.status === "loading") {
    return (
      <div className="flex flex-col gap-1.5 p-2">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-7" />
        ))}
      </div>
    );
  }
  if (load.status === "error") {
    return <p className="p-3 text-xs text-danger">{load.message}</p>;
  }
  const rendered = items(load.data);
  if (Array.isArray(rendered) && rendered.filter(Boolean).length === 0) {
    return <p className="p-3 text-xs text-fg-subtle">{empty}</p>;
  }
  return <ul className="flex flex-col">{rendered}</ul>;
}

function Item({
  label,
  meta,
  active,
  disabled,
  muted,
  onClick,
}: {
  label: string;
  meta?: string;
  active: boolean;
  disabled?: boolean;
  muted?: boolean;
  onClick: () => void;
}) {
  return (
    <li className="px-1.5">
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        aria-current={active || undefined}
        className={cn(
          "relative flex h-7 w-full cursor-pointer items-center gap-2 rounded-control px-2 text-left text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-40",
          active ? "bg-surface-hover text-fg" : muted ? "text-fg-subtle hover:bg-surface-hover/60" : "text-fg-muted hover:bg-surface-hover/60 hover:text-fg",
        )}
      >
        {active && <span className="absolute top-1.5 bottom-1.5 left-0 w-0.5 rounded-full bg-accent" />}
        <span className="min-w-0 flex-1 truncate font-mono">{label}</span>
        {meta && <span className="shrink-0 font-mono text-[10px] text-fg-subtle">{meta}</span>}
      </button>
    </li>
  );
}
