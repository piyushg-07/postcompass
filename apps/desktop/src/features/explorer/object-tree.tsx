import {
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Field,
  IconButton,
  Input,
  NativeSelect,
  Skeleton,
  Switch,
} from "@repo/ui";
import {
  ArchiveRestore,
  Blocks,
  ChevronRight,
  Database,
  DatabaseBackup,
  Eye,
  FolderTree,
  FunctionSquare,
  Hash,
  Layers,
  MoreHorizontal,
  Network,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Table2,
  TerminalSquare,
  Trash2,
  Type,
} from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { formatBytes, formatCount } from "../../lib/format";
import { describeError } from "../../lib/ipc";
import { queryKeys } from "../../lib/query";
import {
  createDatabase,
  createSchema,
  dropDatabase,
  dropSchema,
  renameDatabase,
  renameSchema,
} from "../../lib/sql";
import { useBackupDialogs } from "../backup/backup-store";
import {
  useDatabases,
  useExplorer,
  useSchemaObjects,
  useSchemas,
  useTables,
} from "./explorer-context";
import { RunSqlDialog } from "./run-sql-dialog";
import { useWorkspace } from "./workspace-store";

type Dialog =
  | { kind: "create-db" }
  | { kind: "rename-db" }
  | { kind: "drop-db" }
  | { kind: "create-schema" }
  | { kind: "rename-schema" }
  | { kind: "drop-schema" };

/** Left sidebar: database + schema pickers, then every object in the schema, searchable. */
export function ObjectTree({ defaultDatabase }: { defaultDatabase: string }) {
  const { serverId, connectionId } = useExplorer();
  const queryClient = useQueryClient();
  const ws = useWorkspace(serverId);
  const database = ws.database ?? defaultDatabase;
  const databases = useDatabases();
  const schemas = useSchemas(database);
  const [search, setSearch] = useState("");
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [name, setName] = useState("");
  const [cascade, setCascade] = useState(false);

  // Pick a sensible schema when none is chosen (or the chosen one disappeared)
  useEffect(() => {
    if (!schemas.data) return;
    if (ws.schema && schemas.data.some((s) => s.name === ws.schema)) return;
    const next =
      schemas.data.find((s) => s.name === "public") ??
      schemas.data.find((s) => !s.isSystem) ??
      schemas.data[0];
    ws.setLocation({ database, schema: next?.name ?? null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schemas.data, ws.schema, database]);

  const schema = ws.schema;
  const tables = useTables(database, schema);
  const objects = useSchemaObjects(database, schema);
  const query = search.trim().toLowerCase();
  const match = (n: string) => !query || n.toLowerCase().includes(query);

  const tableList = (tables.data ?? []).filter(
    (t) =>
      (t.kind === "table" ||
        t.kind === "partitioned_table" ||
        t.kind === "foreign_table") &&
      match(t.name),
  );
  const viewList = (tables.data ?? []).filter(
    (t) => t.kind === "view" && match(t.name),
  );
  const matviewList = (tables.data ?? []).filter(
    (t) => t.kind === "materialized_view" && match(t.name),
  );
  const functionList = (objects.data?.functions ?? []).filter((f) =>
    match(f.name),
  );
  const sequenceList = (objects.data?.sequences ?? []).filter((s) =>
    match(s.name),
  );
  const enumList = (objects.data?.enums ?? []).filter((e) => match(e.name));

  const open = (
    n: string,
    kind:
      | "table"
      | "view"
      | "materialized_view"
      | "partitioned_table"
      | "foreign_table",
  ) =>
    schema &&
    ws.openTab({
      type: "table",
      database,
      schema,
      name: n,
      kind,
      view: "data",
    });

  const openDialog = (d: Dialog, initialName = "") => {
    setName(initialName);
    setCascade(false);
    setDialog(d);
  };

  const refresh = () =>
    queryClient.invalidateQueries({
      queryKey: queryKeys.explorer.all(connectionId),
    });

  const userSchemas = (schemas.data ?? []).filter((s) => !s.isSystem);
  const systemSchemas = (schemas.data ?? []).filter((s) => s.isSystem);

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-border bg-surface">
      {/* Location */}
      <div className="flex flex-col gap-1.5 border-b border-border p-2">
        <div className="flex items-center gap-1">
          <Database className="size-3.5 shrink-0 text-fg-subtle" />
          <NativeSelect
            aria-label="Database"
            className="h-7 font-mono text-xs"
            value={database}
            onChange={(e) =>
              ws.setLocation({ database: e.target.value, schema: null })
            }
          >
            {(
              databases.data ?? [{ name: database, allowConnections: true }]
            ).map((d) => (
              <option
                key={d.name}
                value={d.name}
                disabled={!d.allowConnections}
              >
                {d.name}
                {"sizeBytes" in d && d.sizeBytes
                  ? `  (${formatBytes(d.sizeBytes)})`
                  : ""}
              </option>
            ))}
          </NativeSelect>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <IconButton
                size="sm"
                label="Database actions"
                icon={<MoreHorizontal />}
              />
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>Database</DropdownMenuLabel>
              <DropdownMenuItem
                icon={<Plus />}
                onSelect={() => openDialog({ kind: "create-db" })}
              >
                New database…
              </DropdownMenuItem>
              <DropdownMenuItem
                icon={<Pencil />}
                onSelect={() => openDialog({ kind: "rename-db" }, database)}
              >
                Rename {database}…
              </DropdownMenuItem>
              <DropdownMenuItem
                icon={<Blocks />}
                onSelect={() => ws.openTab({ type: "extensions", database })}
              >
                Extensions
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                icon={<DatabaseBackup />}
                onSelect={() =>
                  useBackupDialogs.getState().openBackup({ serverId, database })
                }
              >
                Back up {database}…
              </DropdownMenuItem>
              <DropdownMenuItem
                icon={<ArchiveRestore />}
                onSelect={() =>
                  useBackupDialogs
                    .getState()
                    .openRestore({ serverId, database })
                }
              >
                Restore a backup…
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                icon={<Trash2 />}
                danger
                onSelect={() => openDialog({ kind: "drop-db" })}
              >
                Drop {database}…
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="flex items-center gap-1">
          <FolderTree className="size-3.5 shrink-0 text-fg-subtle" />
          <NativeSelect
            aria-label="Schema"
            className="h-7 font-mono text-xs"
            value={schema ?? ""}
            onChange={(e) => ws.setLocation({ schema: e.target.value })}
          >
            {userSchemas.map((s) => (
              <option key={s.name} value={s.name}>
                {s.name} ({s.tableCount})
              </option>
            ))}
            {systemSchemas.length > 0 && (
              <optgroup label="System">
                {systemSchemas.map((s) => (
                  <option key={s.name} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </optgroup>
            )}
          </NativeSelect>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <IconButton
                size="sm"
                label="Schema actions"
                icon={<MoreHorizontal />}
              />
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>Schema</DropdownMenuLabel>
              <DropdownMenuItem
                icon={<Plus />}
                onSelect={() => openDialog({ kind: "create-schema" })}
              >
                New schema…
              </DropdownMenuItem>
              {schema && (
                <>
                  <DropdownMenuItem
                    icon={<Network />}
                    onSelect={() =>
                      ws.openTab({ type: "diagram", database, schema })
                    }
                  >
                    ER diagram
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    icon={<Pencil />}
                    onSelect={() =>
                      openDialog({ kind: "rename-schema" }, schema)
                    }
                  >
                    Rename {schema}…
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    icon={<Trash2 />}
                    danger
                    onSelect={() => openDialog({ kind: "drop-schema" })}
                  >
                    Drop {schema}…
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Search + quick actions */}
      <div className="flex items-center gap-1 border-b border-border p-2">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-fg-subtle" />
          <Input
            className="h-7 pl-7 text-xs"
            placeholder="Filter objects"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <IconButton
          size="sm"
          label="New query"
          icon={<TerminalSquare />}
          onClick={() => ws.newQuery(database)}
        />
        <IconButton
          size="sm"
          label="Refresh"
          icon={<RefreshCw />}
          onClick={() => void refresh()}
        />
      </div>

      {/* Objects */}
      <div className="min-h-0 flex-1 overflow-y-auto py-1">
        {schemas.isError && (
          <p className="p-3 text-xs text-danger">
            {describeError(schemas.error).message}
          </p>
        )}
        {tables.isPending && schema ? (
          <div className="flex flex-col gap-1.5 p-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-6" />
            ))}
          </div>
        ) : (
          <>
            <Group
              title="Tables"
              icon={<Table2 />}
              count={tableList.length}
              defaultOpen
              action={
                schema && (
                  <IconButton
                    size="sm"
                    label="New table"
                    icon={<Plus />}
                    onClick={() =>
                      ws.openTab({ type: "create-table", database, schema })
                    }
                  />
                )
              }
            >
              {tableList.map((t) => (
                <Item
                  key={t.name}
                  icon={<Table2 />}
                  label={t.name}
                  meta={formatCount(t.rowEstimate)}
                  title={`${t.name} · ~${Math.round(t.rowEstimate ?? 0).toLocaleString()} rows · ${formatBytes(t.sizeBytes)}${t.comment ? ` · ${t.comment}` : ""}`}
                  onClick={() => open(t.name, t.kind)}
                />
              ))}
            </Group>
            <Group title="Views" icon={<Eye />} count={viewList.length}>
              {viewList.map((t) => (
                <Item
                  key={t.name}
                  icon={<Eye />}
                  label={t.name}
                  onClick={() => open(t.name, "view")}
                />
              ))}
            </Group>
            <Group
              title="Materialized views"
              icon={<Layers />}
              count={matviewList.length}
            >
              {matviewList.map((t) => (
                <Item
                  key={t.name}
                  icon={<Layers />}
                  label={t.name}
                  onClick={() => open(t.name, "materialized_view")}
                />
              ))}
            </Group>
            <Group
              title="Functions"
              icon={<FunctionSquare />}
              count={functionList.length}
            >
              {functionList.map((f) => (
                <Item
                  key={f.id}
                  icon={<FunctionSquare />}
                  label={`${f.name}(${f.arguments})`}
                  title={`${f.kind} ${f.name}(${f.arguments}) → ${f.returns} · ${f.language}`}
                  onClick={() =>
                    schema &&
                    ws.openTab({
                      type: "definition",
                      database,
                      schema,
                      kind: "function",
                      name: f.id,
                      title: `${f.name}()`,
                    })
                  }
                />
              ))}
            </Group>
            <Group
              title="Sequences"
              icon={<Hash />}
              count={sequenceList.length}
            >
              {sequenceList.map((s) => (
                <Item
                  key={s.name}
                  icon={<Hash />}
                  label={s.name}
                  meta={s.lastValue ?? undefined}
                  onClick={() =>
                    schema &&
                    ws.openTab({
                      type: "definition",
                      database,
                      schema,
                      kind: "sequence",
                      name: s.name,
                      title: s.name,
                    })
                  }
                />
              ))}
            </Group>
            <Group title="Enums" icon={<Type />} count={enumList.length}>
              {enumList.map((e) => (
                <Item
                  key={e.name}
                  icon={<Type />}
                  label={e.name}
                  title={e.values.join(", ")}
                  meta={`${e.values.length}`}
                />
              ))}
            </Group>
          </>
        )}
      </div>

      {/* Database & schema dialogs */}
      {dialog?.kind === "create-db" && (
        <RunSqlDialog
          open
          onOpenChange={(o) => !o && setDialog(null)}
          title="New database"
          sql={name.trim() ? createDatabase(name.trim()) : "-- type a name"}
          database={database}
          confirmLabel="Create database"
          successMessage={`Database ${name.trim()} created`}
          refreshAll
          onDone={() => ws.setLocation({ database: name.trim(), schema: null })}
        >
          <NameField value={name} onChange={setName} placeholder="my_app" />
        </RunSqlDialog>
      )}
      {dialog?.kind === "rename-db" && (
        <RunSqlDialog
          open
          onOpenChange={(o) => !o && setDialog(null)}
          title={`Rename ${database}`}
          description="Open connections to this database are closed first."
          sql={
            name.trim() && name.trim() !== database
              ? renameDatabase(database, name.trim())
              : "-- type a new name"
          }
          database={
            database === defaultDatabase ? "template1" : defaultDatabase
          }
          confirmLabel="Rename"
          successMessage={`Renamed to ${name.trim()}`}
          refreshAll
          onDone={() => ws.setLocation({ database: name.trim(), schema: null })}
        >
          <NameField value={name} onChange={setName} />
        </RunSqlDialog>
      )}
      {dialog?.kind === "drop-db" && (
        <RunSqlDialog
          open
          onOpenChange={(o) => !o && setDialog(null)}
          title={`Drop database ${database}?`}
          description="Permanently deletes the database and everything in it. Open connections are closed."
          sql={dropDatabase(database)}
          database={
            database === defaultDatabase ? "template1" : defaultDatabase
          }
          confirmLabel="Drop database"
          destructive
          successMessage={`Database ${database} dropped`}
          refreshAll
          onDone={() =>
            ws.setLocation({ database: defaultDatabase, schema: null })
          }
        />
      )}
      {dialog?.kind === "create-schema" && (
        <RunSqlDialog
          open
          onOpenChange={(o) => !o && setDialog(null)}
          title="New schema"
          sql={name.trim() ? createSchema(name.trim()) : "-- type a name"}
          database={database}
          confirmLabel="Create schema"
          successMessage={`Schema ${name.trim()} created`}
          onDone={() => ws.setLocation({ schema: name.trim() })}
        >
          <NameField value={name} onChange={setName} placeholder="analytics" />
        </RunSqlDialog>
      )}
      {dialog?.kind === "rename-schema" && schema && (
        <RunSqlDialog
          open
          onOpenChange={(o) => !o && setDialog(null)}
          title={`Rename schema ${schema}`}
          sql={
            name.trim() && name.trim() !== schema
              ? renameSchema(schema, name.trim())
              : "-- type a new name"
          }
          database={database}
          confirmLabel="Rename"
          successMessage={`Renamed to ${name.trim()}`}
          onDone={() => {
            ws.closeTabsFor(
              (t) =>
                "schema" in t && t.database === database && t.schema === schema,
            );
            ws.setLocation({ schema: name.trim() });
          }}
        >
          <NameField value={name} onChange={setName} />
        </RunSqlDialog>
      )}
      {dialog?.kind === "drop-schema" && schema && (
        <RunSqlDialog
          open
          onOpenChange={(o) => !o && setDialog(null)}
          title={`Drop schema ${schema}?`}
          description="Without CASCADE this only works if the schema is empty."
          sql={dropSchema(schema, cascade)}
          database={database}
          confirmLabel="Drop schema"
          destructive
          successMessage={`Schema ${schema} dropped`}
          onDone={() => {
            ws.closeTabsFor(
              (t) =>
                "schema" in t && t.database === database && t.schema === schema,
            );
            ws.setLocation({ schema: null });
          }}
        >
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <Switch checked={cascade} onCheckedChange={setCascade} />
            Also drop everything inside it (CASCADE)
          </label>
        </RunSqlDialog>
      )}
    </aside>
  );
}

function NameField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <Field label="Name" hint="Lowercase names never need quotes in SQL.">
      {(p) => (
        <Input
          {...p}
          className="font-mono"
          autoFocus
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </Field>
  );
}

function Group({
  title,
  icon,
  count,
  defaultOpen = false,
  action,
  children,
}: {
  title: string;
  icon: ReactNode;
  count: number;
  defaultOpen?: boolean;
  action?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  if (count === 0 && !action) return null;
  return (
    <div className="flex flex-col">
      <div className="group flex h-7 items-center pr-1">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex h-full flex-1 cursor-pointer items-center gap-1.5 px-2 text-[11px] font-medium text-fg-muted hover:text-fg [&_svg]:size-3.5"
          aria-expanded={open}
        >
          <ChevronRight
            className={cn("transition-transform", open && "rotate-90")}
          />
          {icon}
          <span>{title}</span>
          <span className="text-fg-subtle">{count}</span>
        </button>
        {action}
      </div>
      {open && <ul className="flex flex-col pb-1">{children}</ul>}
    </div>
  );
}

function Item({
  icon,
  label,
  meta,
  title,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  meta?: string;
  title?: string;
  onClick?: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        title={title ?? label}
        onClick={onClick}
        disabled={!onClick}
        className="flex h-6 w-full cursor-pointer items-center gap-2 pr-2 pl-8 text-left text-xs text-fg-muted hover:bg-surface-hover hover:text-fg disabled:cursor-default disabled:hover:bg-transparent [&_svg]:size-3 [&_svg]:shrink-0 [&_svg]:text-fg-subtle"
      >
        {icon}
        <span className="min-w-0 flex-1 truncate font-mono">{label}</span>
        {meta && (
          <span className="shrink-0 font-mono text-[10px] text-fg-subtle">
            {meta}
          </span>
        )}
      </button>
    </li>
  );
}
