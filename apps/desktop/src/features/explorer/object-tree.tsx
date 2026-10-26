import {
  Button,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  IconButton,
  Input,
  Skeleton,
  Tooltip,
} from "@repo/ui";
import {
  Blocks,
  ShieldCheck,
  FunctionSquare,
  Hash,
  MoreHorizontal,
  Network,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Table2,
  Trash2,
  Type,
  Zap,
} from "lucide-react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useShallow } from "zustand/react/shallow";
import { queryKeys } from "../../lib/query";
import { useCreateTableSheet } from "./create-table-sheet";
import { type TableAction, TableActionDialog, type TableTarget } from "./tabs/table-actions";
import {
  useExplorer,
  useSchemaObjects,
  useSchemas,
  useTables,
} from "./explorer-context";
import { SqlPanel } from "./sql-panel";
import {
  type ObjectGroup,
  useWorkspaceActions,
  useWorkspaceStore,
} from "./workspace-store";
import { LoadError } from "./load-error";
import { SchemaDialog, type SchemaDialogKind } from "./object-tree/schema-dialogs";
import { SchemaPicker } from "./object-tree/schema-picker";
import { TableRow, type TableRowHandlers } from "./object-tree/table-row";
import { Item, ROW_HEIGHT, VIRTUAL_FROM } from "./object-tree/tree-item";

const DATABASE_PAGES: { group: ObjectGroup; label: string; icon: ReactNode }[] =
  [
    { group: "functions", label: "Functions", icon: <FunctionSquare /> },
    { group: "triggers", label: "Triggers", icon: <Zap /> },
    { group: "enums", label: "Enumerated types", icon: <Type /> },
    { group: "sequences", label: "Sequences", icon: <Hash /> },
  ];

/**
 * Left sidebar, laid out like Supabase's table editor: schema picker, "New table", then the tables.
 * Views, functions and other objects sit under "More". The database is picked in the header.
 */
export function ObjectTree({ defaultDatabase }: { defaultDatabase: string }) {
  const { serverId, connectionId } = useExplorer();
  const queryClient = useQueryClient();
  const actions = useWorkspaceActions(serverId);
  // Only what the sidebar shows: typing in a query tab changes the workspace on every keystroke,
  // and re-rendering hundreds of rows for that would make typing lag
  const [storedDatabase, schema, active] = useWorkspaceStore(
    useShallow((s) => {
      const ws = s.workspaces[serverId];
      const tab = ws?.tabs.find((t) => t.id === ws.activeTabId);
      return [
        ws?.database ?? null,
        ws?.schema ?? null,
        tab?.type === "query" || !tab ? null : tab.id,
      ] as const;
    }),
  );
  const activeTab = useWorkspaceStore((s) =>
    active === null
      ? undefined
      : s.workspaces[serverId]?.tabs.find((t) => t.id === active),
  );
  const database = storedDatabase ?? defaultDatabase;
  const schemas = useSchemas(database);
  const [search, setSearch] = useState("");
  const [dialog, setDialog] = useState<SchemaDialogKind | null>(null);
  const [tableAction, setTableAction] = useState<{
    target: TableTarget;
    action: TableAction;
  } | null>(null);

  // Pick a sensible schema when none is chosen (or the chosen one disappeared)
  const { setLocation } = actions;
  useEffect(() => {
    if (!schemas.data) return;
    if (schema && schemas.data.some((s) => s.name === schema)) return;
    const next =
      schemas.data.find((s) => s.name === "public") ??
      schemas.data.find((s) => !s.isSystem) ??
      schemas.data[0];
    setLocation({ database, schema: next?.name ?? null });
  }, [schemas.data, schema, database, setLocation]);

  const tables = useTables(database, schema);
  const objects = useSchemaObjects(database, schema);
  const [panel, setPanel] = useState<"tables" | "sql" | "database">("tables");
  const query = search.trim().toLowerCase();

  // Tables and views share one list, like Supabase; the icon tells them apart
  const tableList = useMemo(
    () =>
      (tables.data ?? []).filter(
        (t) => !query || t.name.toLowerCase().includes(query),
      ),
    [tables.data, query],
  );
  // Big schemas only render the rows in view, so thousands of tables stay smooth
  const listScroll = useRef<HTMLDivElement>(null);
  const virtual = tableList.length > VIRTUAL_FROM;
  const virtualizer = useVirtualizer({
    count: tableList.length,
    getScrollElement: () => listScroll.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 20,
  });
  const counts: Record<ObjectGroup, number | undefined> = {
    functions: objects.data?.functions.length,
    triggers: objects.data?.triggers.length,
    enums: objects.data?.enums.length,
    sequences: objects.data?.sequences.length,
  };

  const refresh = useMemo(
    () => () =>
      void queryClient.invalidateQueries({
        queryKey: queryKeys.explorer.all(connectionId),
      }),
    [queryClient, connectionId],
  );

  const handlers = useMemo((): TableRowHandlers | null => {
    if (!schema) return null;
    return {
      open: (name, kind, view) =>
        actions.openTab({ type: "table", database, schema, name, kind, view }),
      query: (sql) => actions.newQuery(database, sql),
      refresh,
      tableSheet: (name, mode) =>
        useCreateTableSheet
          .getState()
          .open({ serverId, database, schema, table: name, mode }),
      action: (name, kind, action) =>
        setTableAction({ target: { database, schema, name, kind }, action }),
    };
  }, [actions, database, schema, serverId, refresh]);

  const isActive = (n: string) =>
    activeTab?.type === "table" &&
    activeTab.database === database &&
    activeTab.schema === schema &&
    activeTab.name === n;

  const userSchemas = (schemas.data ?? []).filter((s) => !s.isSystem);
  const systemSchemas = (schemas.data ?? []).filter((s) => s.isSystem);
  // While the schema is still being picked, the table query is idle: show it as loading
  const loadingTables = schema ? tables.isPending : schemas.isPending;

  return (
    <aside className="flex h-full w-full flex-col overflow-clip border-r border-border bg-surface">
      {/* Like Supabase: table editor, SQL editor, database objects */}
      <div className="shrink-0 px-2 pt-2">
        <div className="flex gap-0.5 rounded-control border border-border bg-bg p-0.5">
          {(["tables", "sql", "database"] as const).map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={panel === p}
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
              onSelect={(next) => actions.setLocation({ schema: next })}
              onCreate={() => setDialog("create-schema")}
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
                        actions.openTab({ type: "diagram", database, schema })
                      }
                    >
                      ER diagram
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      icon={<Pencil />}
                      onSelect={() => setDialog("rename-schema")}
                    >
                      Rename {schema}…
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      icon={<Trash2 />}
                      danger
                      onSelect={() => setDialog("drop-schema")}
                    >
                      Drop {schema}…
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {panel === "tables" && (
            <div className="flex items-center gap-1.5">
              <div className="relative flex-1">
                <Search className="absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-fg-subtle" />
                <Input
                  className="h-7 pl-7 text-xs"
                  placeholder="Search tables"
                  aria-label="Search tables"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") setSearch("");
                    if (e.key === "Enter" && tableList[0])
                      handlers?.open(tableList[0].name, tableList[0].kind, "data");
                  }}
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
                onClick={refresh}
              />
            </div>
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
                  actions.openTab({ type: "objects", database, schema, group })
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
                schema &&
                actions.openTab({ type: "policies", database, schema })
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
              onClick={() => actions.openTab({ type: "extensions", database })}
            />
          </ul>
        </nav>
      ) : (
        <div ref={listScroll} className="min-h-0 flex-1 overflow-y-auto py-1">
          {schemas.isError && <LoadError query={schemas} compact />}
          {tables.isError && <LoadError query={tables} compact />}
          {loadingTables && !schemas.isError ? (
            <div className="flex flex-col gap-1.5 p-2">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-6" />
              ))}
            </div>
          ) : tables.isError ? null : tableList.length === 0 ? (
            query ? (
              <p className="px-4 py-3 text-xs text-fg-subtle">
                No tables match “{search.trim()}”.
              </p>
            ) : (
              <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                <span className="flex size-9 items-center justify-center rounded-card border border-border bg-bg text-fg-subtle">
                  <Table2 className="size-4" />
                </span>
                <p className="text-xs font-medium text-fg">No tables yet</p>
                <p className="text-xs text-fg-subtle">
                  Create the first table in{" "}
                  <span className="font-mono">{schema ?? "this schema"}</span>.
                </p>
                {schema && (
                  <Button
                    size="sm"
                    variant="secondary"
                    iconLeft={<Plus />}
                    className="mt-1"
                    onClick={() =>
                      useCreateTableSheet
                        .getState()
                        .open({ serverId, database, schema })
                    }
                  >
                    Create table
                  </Button>
                )}
              </div>
            )
          ) : (
            schema &&
            handlers && (
              <ul
                className="relative flex flex-col gap-px py-1"
                style={
                  virtual ? { height: virtualizer.getTotalSize() } : undefined
                }
              >
                {(virtual
                  ? virtualizer
                      .getVirtualItems()
                      .map((v) => [tableList[v.index]!, v.start] as const)
                  : tableList.map((t) => [t, null] as const)
                ).map(([t, top]) => (
                  <TableRow
                    key={t.name}
                    table={t}
                    schema={schema}
                    active={isActive(t.name)}
                    query={query}
                    top={top}
                    handlers={handlers}
                  />
                ))}
              </ul>
            )
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
      {dialog && (
        <SchemaDialog
          kind={dialog}
          database={database}
          schema={schema}
          tableCount={
            schemas.data?.find((x) => x.name === schema)?.tableCount ?? 0
          }
          onClose={() => setDialog(null)}
          onLocation={(next) => actions.setLocation({ schema: next })}
          closeTabsFor={actions.closeTabsFor}
        />
      )}
    </aside>
  );
}
