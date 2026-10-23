import {
  Button,
  cn,
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  IconButton,
  Input,
  Skeleton,
  Checkbox,
  toast,
  Tooltip,
} from "@repo/ui";
import {
  Blocks,
  ShieldCheck,
  Check,
  ChevronsUpDown,
  Code,
  Copy,
  CopyPlus,
  Eraser,
  Eye,
  FunctionSquare,
  Hash,
  Layers,
  MoreHorizontal,
  Network,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  Table2,
  TerminalSquare,
  Trash2,
  Type,
  Zap,
} from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { formatCount } from "../../lib/format";
import { describeError } from "../../lib/ipc";
import { queryKeys } from "../../lib/query";
import {
  createSchema,
  dropSchema,
  qualified,
  renameSchema,
} from "../../lib/sql";
import { useCreateTableSheet } from "./create-table-sheet";
import {
  type TableAction,
  TableActionDialog,
  type TableTarget,
} from "./tabs/table-actions";
import {
  useExplorer,
  useSchemaObjects,
  useSchemas,
  useTables,
} from "./explorer-context";
import { NameField, RunSqlDialog } from "./run-sql-dialog";
import { SqlPanel } from "./sql-panel";
import { type ObjectGroup, useWorkspace } from "./workspace-store";

const DATABASE_PAGES: { group: ObjectGroup; label: string; icon: ReactNode }[] =
  [
    { group: "functions", label: "Functions", icon: <FunctionSquare /> },
    { group: "triggers", label: "Triggers", icon: <Zap /> },
    { group: "enums", label: "Enumerated types", icon: <Type /> },
    { group: "sequences", label: "Sequences", icon: <Hash /> },
  ];

type Dialog = "create-schema" | "rename-schema" | "drop-schema";

/**
 * Left sidebar, laid out like Supabase's table editor: schema picker, "New table", then the tables.
 * Views, functions and other objects sit under "More". The database is picked in the header.
 */
export function ObjectTree({ defaultDatabase }: { defaultDatabase: string }) {
  const { serverId, connectionId } = useExplorer();
  const queryClient = useQueryClient();
  const ws = useWorkspace(serverId);
  const database = ws.database ?? defaultDatabase;
  const schemas = useSchemas(database);
  const [search, setSearch] = useState("");
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [name, setName] = useState("");
  const [cascade, setCascade] = useState(false);
  const [tableAction, setTableAction] = useState<{
    target: TableTarget;
    action: TableAction;
  } | null>(null);

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
  const [panel, setPanel] = useState<"tables" | "sql" | "database">("tables");
  const query = search.trim().toLowerCase();
  const match = (n: string) => !query || n.toLowerCase().includes(query);

  // Tables and views share one list, like Supabase; the icon tells them apart
  const tableList = (tables.data ?? []).filter((t) => match(t.name));
  const counts: Record<ObjectGroup, number | undefined> = {
    functions: objects.data?.functions.length,
    triggers: objects.data?.triggers.length,
    enums: objects.data?.enums.length,
    sequences: objects.data?.sequences.length,
  };

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

  const activeTab = ws.tabs.find((t) => t.id === ws.activeTabId);
  const isActive = (n: string) =>
    activeTab?.type === "table" &&
    activeTab.database === database &&
    activeTab.schema === schema &&
    activeTab.name === n;

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
    <aside className="flex h-full w-full flex-col overflow-clip border-r border-border bg-surface">
      {/* Like Supabase: table editor, SQL editor, database objects */}
      <div className="shrink-0 px-2 pt-2">
        <div className="flex gap-0.5 rounded-control border border-border bg-bg p-0.5">
          {(["tables", "sql", "database"] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPanel(p)}
              className={cn(
                "h-6 flex-1 cursor-pointer rounded text-xs transition-colors",
                panel === p
                  ? "bg-surface-hover font-medium text-fg"
                  : "text-fg-muted hover:text-fg",
              )}
            >
              {p === "tables" ? "Tables" : p === "sql" ? "SQL" : "Database"}
            </button>
          ))}
        </div>
      </div>

      {panel !== "sql" && (
        <div className="flex flex-col gap-2 px-2 pt-3 pb-2">
          {/* Schema */}
          <div className="flex items-center gap-1">
            <SchemaPicker
              schema={schema}
              userSchemas={userSchemas.map((x) => x.name)}
              systemSchemas={systemSchemas.map((x) => x.name)}
              onSelect={(next) => ws.setLocation({ schema: next })}
              onCreate={() => openDialog("create-schema")}
            />
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
                      onSelect={() => openDialog("rename-schema", schema)}
                    >
                      Rename {schema}…
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      icon={<Trash2 />}
                      danger
                      onSelect={() => openDialog("drop-schema")}
                    >
                      Drop {schema}…
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {panel === "tables" && (
            <>
              <div className="flex items-center gap-1.5">
                <div className="relative flex-1">
                  <Search className="absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-fg-subtle" />
                  <Input
                    className="h-7 pl-7 text-xs"
                    placeholder="Search tables"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <Tooltip content="New table">
                  <Button
                    size="icon"
                    variant="primary"
                    aria-label="New table"
                    className="size-7 shrink-0"
                    disabled={!schema}
                    onClick={() =>
                      schema &&
                      useCreateTableSheet
                        .getState()
                        .open({ serverId, database, schema })
                    }
                  >
                    <Plus />
                  </Button>
                </Tooltip>
                <IconButton
                  size="sm"
                  label="Refresh"
                  icon={<RefreshCw />}
                  onClick={() => void refresh()}
                />
              </div>
            </>
          )}
        </div>
      )}

      {panel === "sql" ? (
        <SqlPanel database={database} />
      ) : panel === "database" ? (
        <nav className="min-h-0 flex-1 overflow-y-auto py-2">
          <ul className="flex flex-col gap-px">
            {DATABASE_PAGES.map(({ group, label, icon }) => (
              <Item
                key={group}
                icon={icon}
                label={label}
                meta={counts[group]?.toString()}
                plain
                active={
                  activeTab?.type === "objects" &&
                  activeTab.group === group &&
                  activeTab.database === database &&
                  activeTab.schema === schema
                }
                onClick={() =>
                  schema &&
                  ws.openTab({ type: "objects", database, schema, group })
                }
              />
            ))}
            <Item
              icon={<ShieldCheck />}
              label="Policies"
              plain
              active={
                activeTab?.type === "policies" &&
                activeTab.database === database &&
                activeTab.schema === schema
              }
              onClick={() =>
                schema && ws.openTab({ type: "policies", database, schema })
              }
            />
            <Item
              icon={<Blocks />}
              label="Extensions"
              plain
              active={
                activeTab?.type === "extensions" &&
                activeTab.database === database
              }
              onClick={() => ws.openTab({ type: "extensions", database })}
            />
          </ul>
        </nav>
      ) : (
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
              {tableList.length === 0 ? (
                <p className="px-3 py-2 text-xs text-fg-subtle">
                  {query
                    ? "Nothing matches."
                    : `No tables in ${schema ?? "this schema"} yet.`}
                </p>
              ) : (
                <ul className="flex flex-col gap-px py-1">
                  {tableList.map((t) => (
                    <Item
                      key={t.name}
                      icon={
                        t.kind === "view" ? (
                          <Eye />
                        ) : t.kind === "materialized_view" ? (
                          <Layers />
                        ) : (
                          <Table2 />
                        )
                      }
                      label={t.name}
                      meta={
                        t.kind === "view" ? "view" : formatCount(t.rowEstimate)
                      }
                      active={isActive(t.name)}
                      onClick={() => open(t.name, t.kind)}
                      menu={
                        schema && (
                          <TableMenu
                            name={t.name}
                            kind={t.kind}
                            isView={
                              t.kind === "view" ||
                              t.kind === "materialized_view"
                            }
                            onAction={(action) =>
                              setTableAction({
                                target: {
                                  database,
                                  schema,
                                  name: t.name,
                                  kind: t.kind,
                                },
                                action,
                              })
                            }
                            select={`SELECT *\nFROM ${qualified(schema, t.name)}\nLIMIT 100;`}
                            onView={(view) =>
                              ws.openTab({
                                type: "table",
                                database,
                                schema,
                                name: t.name,
                                kind: t.kind,
                                view,
                              })
                            }
                            onQuery={(sql) => ws.newQuery(database, sql)}
                            onRefresh={() => void refresh()}
                            onTableSheet={(mode) =>
                              useCreateTableSheet.getState().open({
                                serverId,
                                database,
                                schema,
                                table: t.name,
                                mode,
                              })
                            }
                          />
                        )
                      }
                    />
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}

      {tableAction && (
        <TableActionDialog
          key={`${tableAction.target.name}:${tableAction.action}`}
          target={tableAction.target}
          action={tableAction.action}
          onClose={() => setTableAction(null)}
        />
      )}
      {dialog === "create-schema" && (
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
      {dialog === "rename-schema" && schema && (
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
      {dialog === "drop-schema" &&
        schema &&
        (() => {
          const tableCount =
            schemas.data?.find((x) => x.name === schema)?.tableCount ?? 0;
          return (
            <RunSqlDialog
              open
              onOpenChange={(o) => !o && setDialog(null)}
              title={`Delete schema ${schema}?`}
              // Deleting a schema with tables needs CASCADE, so ask for an explicit OK first
              sql={
                tableCount === 0
                  ? dropSchema(schema, false)
                  : cascade
                    ? dropSchema(schema, true)
                    : "-- confirm deleting its tables"
              }
              database={database}
              confirmLabel="Delete schema"
              destructive
              successMessage={`Schema ${schema} deleted`}
              onDone={() => {
                ws.closeTabsFor(
                  (t) =>
                    "schema" in t &&
                    t.database === database &&
                    t.schema === schema,
                );
                ws.setLocation({ schema: null });
              }}
            >
              {tableCount === 0 ? (
                <p className="text-sm text-fg-muted">
                  This schema is empty. It will be removed permanently.
                </p>
              ) : (
                <div className="flex flex-col gap-3 rounded-control border border-danger/30 bg-danger/5 p-3">
                  <p className="text-sm text-fg">
                    <span className="font-mono">{schema}</span> has {tableCount}{" "}
                    {tableCount === 1 ? "table" : "tables"}.{" "}
                    {tableCount === 1 ? "It" : "They"} and all their data will
                    be deleted permanently.
                  </p>
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-fg-muted">
                    <Checkbox
                      checked={cascade}
                      onCheckedChange={(v) => setCascade(v === true)}
                    />
                    I understand, delete everything in it
                  </label>
                </div>
              )}
            </RunSqlDialog>
          );
        })()}
    </aside>
  );
}

/** Schema dropdown like Supabase's: "schema  public", a search box, the schemas, then "Create a new schema". */
function SchemaPicker({
  schema,
  userSchemas,
  systemSchemas,
  onSelect,
  onCreate,
}: {
  schema: string | null;
  userSchemas: string[];
  systemSchemas: string[];
  onSelect: (schema: string) => void;
  onCreate: () => void;
}) {
  const [filter, setFilter] = useState("");
  const q = filter.trim().toLowerCase();
  const item = (name: string) => (
    <DropdownMenuItem
      key={name}
      icon={<Check className={name === schema ? "text-accent" : "invisible"} />}
      onSelect={() => onSelect(name)}
    >
      <span className="font-mono">{name}</span>
    </DropdownMenuItem>
  );
  const users = userSchemas.filter((n) => n.includes(q));
  const system = systemSchemas.filter((n) => n.includes(q));
  return (
    <DropdownMenu onOpenChange={(o) => !o && setFilter("")}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex h-7 min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-control border border-border-strong bg-bg px-2 text-xs hover:border-fg-subtle data-[state=open]:border-fg-subtle"
        >
          <span className="shrink-0 text-fg-subtle">schema</span>
          <span className="min-w-0 flex-1 truncate text-left font-mono text-fg">
            {schema ?? "…"}
          </span>
          <ChevronsUpDown className="size-3.5 shrink-0 text-fg-subtle" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-60 p-0">
        <div className="relative border-b border-border p-1">
          <Search className="absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-fg-subtle" />
          <input
            autoFocus
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            // Keep typing in the box instead of the menu's type-to-select
            onKeyDown={(e) => e.key !== "Escape" && e.stopPropagation()}
            placeholder="Find schema…"
            className="h-7 w-full bg-transparent pr-2 pl-7 text-xs text-fg outline-none placeholder:text-fg-subtle"
          />
        </div>
        <div className="max-h-72 overflow-y-auto p-1">
          {users.map(item)}
          {system.length > 0 && (
            <>
              <DropdownMenuLabel>System</DropdownMenuLabel>
              {system.map(item)}
            </>
          )}
          {users.length + system.length === 0 && (
            <p className="px-2 py-1.5 text-xs text-fg-subtle">
              No schemas found
            </p>
          )}
        </div>
        <div className="border-t border-border p-1">
          <DropdownMenuItem icon={<Plus />} onSelect={onCreate}>
            Create a new schema
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Item({
  icon,
  label,
  meta,
  active,
  plain,
  onClick,
  menu,
}: {
  icon: ReactNode;
  label: string;
  meta?: string;
  active?: boolean;
  /** Regular text instead of monospace, for page names rather than object names. */
  plain?: boolean;
  onClick?: () => void;
  /** Right-click menu. */
  menu?: ReactNode;
}) {
  const button = (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        "mx-2 flex h-7 w-[calc(100%-16px)] cursor-pointer items-center gap-2 rounded-control px-2 text-left text-xs text-fg-muted transition-colors hover:bg-surface-hover/70 hover:text-fg disabled:cursor-default disabled:hover:bg-transparent [&_svg]:size-3.5 [&_svg]:shrink-0 [&_svg]:text-fg-subtle",
        active &&
          "relative bg-surface-hover text-fg before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-full before:bg-accent [&_svg]:text-accent",
      )}
    >
      {icon}
      <span className={cn("min-w-0 flex-1 truncate", !plain && "font-mono")}>
        {label}
      </span>
      {meta && (
        <span className="shrink-0 font-mono text-[10px] text-fg-subtle">
          {meta}
        </span>
      )}
    </button>
  );
  return (
    <li>
      {menu ? (
        <ContextMenu>
          <ContextMenuTrigger asChild>{button}</ContextMenuTrigger>
          {menu}
        </ContextMenu>
      ) : (
        button
      )}
    </li>
  );
}

/** Right-click menu of a table or view in the sidebar. */
function TableMenu({
  name,
  kind,
  isView,
  select,
  onView,
  onQuery,
  onRefresh,
  onTableSheet,
  onAction,
}: {
  name: string;
  kind: string;
  isView: boolean;
  select: string;
  onView: (view: "data" | "structure" | "definition") => void;
  onQuery: (sql: string) => void;
  onRefresh: () => void;
  onTableSheet: (mode: "edit" | "duplicate") => void;
  onAction: (action: TableAction) => void;
}) {
  const copy = (text: string, what: string) =>
    void navigator.clipboard
      .writeText(text)
      .then(() => toast.success(`${what} copied`));
  return (
    <ContextMenuContent>
      <ContextMenuLabel>{name}</ContextMenuLabel>
      <ContextMenuItem icon={<Table2 />} onSelect={() => onView("data")}>
        View data
      </ContextMenuItem>
      {!isView && (
        <ContextMenuItem icon={<Layers />} onSelect={() => onView("structure")}>
          View structure
        </ContextMenuItem>
      )}
      {isView && (
        <ContextMenuItem icon={<Code />} onSelect={() => onView("definition")}>
          View definition
        </ContextMenuItem>
      )}
      <ContextMenuItem
        icon={<TerminalSquare />}
        onSelect={() => onQuery(select)}
      >
        Query in SQL editor
      </ContextMenuItem>
      {!isView && (
        <>
          <ContextMenuSeparator />
          <ContextMenuItem
            icon={<Settings2 />}
            onSelect={() => onTableSheet("edit")}
          >
            Edit table
          </ContextMenuItem>
          <ContextMenuItem
            icon={<CopyPlus />}
            onSelect={() => onTableSheet("duplicate")}
          >
            Duplicate table
          </ContextMenuItem>
        </>
      )}
      <ContextMenuSeparator />
      <ContextMenuItem icon={<Copy />} onSelect={() => copy(name, "Name")}>
        Copy name
      </ContextMenuItem>
      <ContextMenuItem
        icon={<Copy />}
        onSelect={() => copy(select, "SELECT statement")}
      >
        Copy SELECT statement
      </ContextMenuItem>
      <ContextMenuSeparator />
      {kind === "materialized_view" && (
        <ContextMenuItem
          icon={<RefreshCw />}
          onSelect={() => onAction("refresh")}
        >
          Refresh materialized view…
        </ContextMenuItem>
      )}
      <ContextMenuItem icon={<Pencil />} onSelect={() => onAction("rename")}>
        Rename…
      </ContextMenuItem>
      {!isView && (
        <ContextMenuItem
          icon={<Eraser />}
          onSelect={() => onAction("truncate")}
        >
          Empty table (truncate)…
        </ContextMenuItem>
      )}
      <ContextMenuItem
        icon={<Trash2 />}
        danger
        onSelect={() => onAction("drop")}
      >
        Drop{" "}
        {kind === "view"
          ? "view"
          : kind === "materialized_view"
            ? "materialized view"
            : "table"}
        …
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem icon={<RefreshCw />} onSelect={onRefresh}>
        Refresh list
      </ContextMenuItem>
    </ContextMenuContent>
  );
}
