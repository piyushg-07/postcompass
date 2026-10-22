import {
  Button,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Field,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Spinner,
  Switch,
  toast,
} from "@repo/ui";
import {
  Copy,
  CopyPlus,
  Eraser,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  Settings2,
  SquareTerminal,
  Trash2,
  Unlock,
} from "lucide-react";
import { useState } from "react";
import type { ObjectKind } from "../../../lib/bindings";
import { describeError } from "../../../lib/ipc";
import {
  dropTable,
  qualified,
  renameTable,
  truncateTable,
} from "../../../lib/sql";
import { useCreateTableSheet } from "../create-table-sheet";
import { TableData, TableFooter } from "../data/table-data";
import { useDefinition, useExplorer, useStructure } from "../explorer-context";
import { RunSqlDialog } from "../run-sql-dialog";
import { SqlBlock } from "../sql/sql-editor";
import { StructureView } from "../structure/structure-view";
import { type Tab, type TableView, useWorkspace } from "../workspace-store";

type TableTabModel = Extract<Tab, { type: "table" }>;

const VIEWS: { id: TableView; label: string }[] = [
  { id: "data", label: "Data" },
  { id: "structure", label: "Structure" },
  { id: "definition", label: "Definition" },
];

/** Like Supabase, views only have data and their SQL definition. */
const VIEW_VIEWS = VIEWS.filter((v) => v.id !== "structure");

type Action = "rename" | "truncate" | "drop" | "refresh" | "secure";

export function TableTab({ tab }: { tab: TableTabModel }) {
  const { serverId } = useExplorer();
  const { updateTab, closeTab } = useWorkspace(serverId);
  const [action, setAction] = useState<Action | null>(null);
  const [newName, setNewName] = useState(tab.name);
  const [cascade, setCascade] = useState(false);
  const isView = tab.kind === "view" || tab.kind === "materialized_view";
  const kindLabel =
    tab.kind === "view"
      ? "view"
      : tab.kind === "materialized_view"
        ? "materialized view"
        : "table";

  const openTableSheet = (mode: "edit" | "duplicate") =>
    useCreateTableSheet.getState().open({
      serverId,
      database: tab.database,
      schema: tab.schema,
      table: tab.name,
      mode,
    });

  const footerRight = (
    <>
      <div className="flex items-center rounded-control border border-border p-0.5">
        {(isView ? VIEW_VIEWS : VIEWS).map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => updateTab(tab.id, { view: v.id })}
            className={cn(
              "h-6 cursor-pointer rounded px-2.5 text-xs transition-colors",
              tab.view === v.id
                ? "bg-surface-hover text-fg"
                : "text-fg-muted hover:text-fg",
            )}
          >
            {v.label}
          </button>
        ))}
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon" variant="ghost" aria-label="Table actions">
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="top">
          <DropdownMenuItem
            icon={<Copy />}
            onSelect={() =>
              void navigator.clipboard
                .writeText(qualified(tab.schema, tab.name))
                .then(() => toast.success("Name copied"))
            }
          >
            Copy name
          </DropdownMenuItem>
          {!isView && (
            <DropdownMenuItem
              icon={<Settings2 />}
              onSelect={() => openTableSheet("edit")}
            >
              Edit table
            </DropdownMenuItem>
          )}
          {!isView && (
            <DropdownMenuItem
              icon={<CopyPlus />}
              onSelect={() => openTableSheet("duplicate")}
            >
              Duplicate table
            </DropdownMenuItem>
          )}
          {tab.kind === "materialized_view" && (
            <DropdownMenuItem
              icon={<RefreshCw />}
              onSelect={() => setAction("refresh")}
            >
              Refresh materialized view…
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            icon={<Pencil />}
            onSelect={() => setAction("rename")}
          >
            Rename…
          </DropdownMenuItem>
          {!isView && (
            <DropdownMenuItem
              icon={<Eraser />}
              onSelect={() => setAction("truncate")}
            >
              Empty table (truncate)…
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            icon={<Trash2 />}
            danger
            onSelect={() => setAction("drop")}
          >
            Drop {kindLabel}…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      {tab.view === "data" ? (
        <div className="min-h-0 flex-1">
          <TableData
            // Following a foreign key here again restarts the view with its filter
            key={JSON.stringify(tab.filters ?? [])}
            database={tab.database}
            schema={tab.schema}
            table={tab.name}
            initialFilters={tab.filters}
            footerRight={footerRight}
            isView={isView}
            toolbarRight={
              tab.kind === "view" ? (
                <SecurityDefinerWarning
                  database={tab.database}
                  schema={tab.schema}
                  view={tab.name}
                  onFix={() => setAction("secure")}
                />
              ) : undefined
            }
          />
        </div>
      ) : (
        <>
          <div className="min-h-0 flex-1">
            {tab.view === "structure" ? (
              <StructureView
                database={tab.database}
                schema={tab.schema}
                table={tab.name}
              />
            ) : (
              <DefinitionView
                database={tab.database}
                schema={tab.schema}
                title={tab.name}
                kind={
                  tab.kind === "view"
                    ? "view"
                    : tab.kind === "materialized_view"
                      ? "materialized_view"
                      : "table"
                }
                name={tab.name}
              />
            )}
          </div>
          <TableFooter right={footerRight} />
        </>
      )}

      {action === "rename" && (
        <RunSqlDialog
          open
          onOpenChange={(open) => !open && setAction(null)}
          title={`Rename ${tab.name}`}
          sql={
            newName.trim() && newName !== tab.name
              ? renameTable(tab.schema, tab.name, newName.trim())
              : "-- type a new name"
          }
          database={tab.database}
          confirmLabel="Rename"
          successMessage={`Renamed to ${newName.trim()}`}
          onDone={() => {
            closeTab(tab.id);
          }}
        >
          <Field label="New name">
            {(p) => (
              <Input
                {...p}
                className="font-mono"
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            )}
          </Field>
        </RunSqlDialog>
      )}
      {action === "refresh" && (
        <RunSqlDialog
          open
          onOpenChange={(open) => !open && setAction(null)}
          title={`Refresh ${tab.name}?`}
          description="Runs the view's query again and replaces its stored rows."
          sql={`REFRESH MATERIALIZED VIEW ${qualified(tab.schema, tab.name)};`}
          database={tab.database}
          confirmLabel="Refresh"
          successMessage={`${tab.name} refreshed`}
        />
      )}
      {action === "secure" && (
        <RunSqlDialog
          open
          onOpenChange={(open) => !open && setAction(null)}
          title="Confirm autofixing view security"
          description={
            <>
              Setting <code className="font-mono">security_invoker=on</code>{" "}
              ensures the view runs with the permissions of the querying user,
              so the RLS policies of the tables it reads apply. Needs PostgreSQL
              15 or newer.
            </>
          }
          sql={`ALTER VIEW ${qualified(tab.schema, tab.name)} SET (security_invoker = on);`}
          database={tab.database}
          confirmLabel="Confirm"
          successMessage={`${tab.name} now runs as the querying user`}
        />
      )}
      {action === "truncate" && (
        <RunSqlDialog
          open
          onOpenChange={(open) => !open && setAction(null)}
          title={`Empty ${tab.name}?`}
          description="Deletes every row. This can't be undone."
          sql={truncateTable(tab.schema, tab.name)}
          database={tab.database}
          confirmLabel="Delete all rows"
          destructive
          successMessage={`${tab.name} emptied`}
        />
      )}
      {action === "drop" && (
        <RunSqlDialog
          open
          onOpenChange={(open) => !open && setAction(null)}
          title={`Drop ${tab.name}?`}
          description={`Permanently deletes the ${kindLabel} and all its data.`}
          sql={dropTable(tab.schema, tab.name, kindLabel, cascade)}
          database={tab.database}
          confirmLabel={`Drop ${kindLabel}`}
          destructive
          successMessage={`${tab.name} dropped`}
          onDone={() => closeTab(tab.id)}
        >
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <Switch checked={cascade} onCheckedChange={setCascade} />
            Also drop objects that depend on it (CASCADE)
          </label>
        </RunSqlDialog>
      )}
    </div>
  );
}

/** A view's warning when it runs as its owner, like Supabase's "Security Definer View". */
function SecurityDefinerWarning({
  database,
  schema,
  view,
  onFix,
}: {
  database: string;
  schema: string;
  view: string;
  onFix: () => void;
}) {
  const structure = useStructure(database, schema, view);
  if (!structure.data || structure.data.securityInvoker) return null;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          size="sm"
          variant="secondary"
          iconLeft={<Unlock />}
          className="border-warning/40 text-warning hover:border-warning/60"
        >
          Security Definer View
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="flex w-[395px] flex-col gap-3 p-4">
        <h3 className="flex items-center gap-2 text-sm font-medium text-fg">
          <Unlock className="size-4" /> Secure your View
        </h3>
        <p className="text-xs text-fg-muted">
          This view runs with the permissions of its owner, not of the user
          querying it. Row Level Security policies on the tables it reads are
          bypassed, so anyone who can query the view sees what the owner sees.
        </p>
        <p className="text-xs text-fg-muted">
          Setting <code className="font-mono text-fg">security_invoker=on</code>{" "}
          makes it respect each user&apos;s permissions and policies.
        </p>
        <Button size="sm" variant="primary" className="w-fit" onClick={onFix}>
          Autofix
        </Button>
      </PopoverContent>
    </Popover>
  );
}

/** The SQL that defines a table or view, read-only, like Supabase's Definition view. */
export function DefinitionView({
  database,
  schema,
  kind,
  name,
  title,
}: {
  database: string;
  schema: string;
  kind: ObjectKind;
  name: string;
  /** Shown as "SQL Definition of …"; the header is hidden without it. */
  title?: string;
}) {
  const { serverId } = useExplorer();
  const { newQuery } = useWorkspace(serverId);
  const definition = useDefinition(database, schema, kind, name);
  if (definition.isPending) {
    return (
      <div className="flex h-full items-center justify-center text-fg-subtle">
        <Spinner />
      </div>
    );
  }
  if (definition.isError)
    return (
      <p className="p-4 text-sm text-danger">
        {describeError(definition.error).message}
      </p>
    );
  return (
    <div className="flex h-full flex-col">
      {title && (
        <div className="flex h-10 shrink-0 items-center gap-2 border-b border-border px-3">
          <p className="text-sm text-fg">
            SQL Definition of <code className="font-mono">{title}</code>
          </p>
          <span className="text-xs text-fg-subtle">(Read only)</span>
          <span className="ml-auto flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              iconLeft={<Copy />}
              onClick={() =>
                void navigator.clipboard
                  .writeText(definition.data)
                  .then(() => toast.success("Definition copied"))
              }
            >
              Copy
            </Button>
            <Button
              size="sm"
              variant="secondary"
              iconLeft={<SquareTerminal />}
              onClick={() => newQuery(database, definition.data)}
            >
              Open in SQL Editor
            </Button>
          </span>
        </div>
      )}
      <div className="relative min-h-0 flex-1">
        {!title && (
          <Button
            size="sm"
            className="absolute top-2 right-4 z-10"
            iconLeft={<Copy />}
            onClick={() =>
              void navigator.clipboard
                .writeText(definition.data)
                .then(() => toast.success("Definition copied"))
            }
          >
            Copy
          </Button>
        )}
        <SqlBlock
          sql={definition.data}
          className="h-full rounded-none border-0"
        />
      </div>
    </div>
  );
}
