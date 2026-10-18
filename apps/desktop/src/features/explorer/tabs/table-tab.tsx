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
  Spinner,
  Switch,
  toast,
} from "@repo/ui";
import { Copy, Eraser, MoreHorizontal, Pencil, TerminalSquare, Trash2 } from "lucide-react";
import { useState } from "react";
import type { ObjectKind } from "../../../lib/bindings";
import { describeError } from "../../../lib/ipc";
import { dropTable, qualified, renameTable, truncateTable } from "../../../lib/sql";
import { TableData } from "../data/table-data";
import { useDefinition, useExplorer } from "../explorer-context";
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

type Action = "rename" | "truncate" | "drop";

export function TableTab({ tab }: { tab: TableTabModel }) {
  const { serverId } = useExplorer();
  const { updateTab, newQuery, closeTab } = useWorkspace(serverId);
  const [action, setAction] = useState<Action | null>(null);
  const [newName, setNewName] = useState(tab.name);
  const [cascade, setCascade] = useState(false);
  const isView = tab.kind === "view" || tab.kind === "materialized_view";
  const kindLabel = tab.kind === "view" ? "view" : tab.kind === "materialized_view" ? "materialized view" : "table";

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-10 shrink-0 items-center gap-1 border-b border-border px-2">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => updateTab(tab.id, { view: v.id })}
            className={cn(
              "relative h-10 cursor-pointer px-3 text-xs transition-colors",
              tab.view === v.id ? "text-fg" : "text-fg-muted hover:text-fg",
            )}
          >
            {v.label}
            {tab.view === v.id && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-accent" />}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            iconLeft={<TerminalSquare />}
            onClick={() => newQuery(tab.database, `SELECT *\nFROM ${qualified(tab.schema, tab.name)}\nLIMIT 100;`)}
          >
            Query
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" aria-label="Table actions">
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                icon={<Copy />}
                onSelect={() =>
                  void navigator.clipboard.writeText(qualified(tab.schema, tab.name)).then(() => toast.success("Name copied"))
                }
              >
                Copy name
              </DropdownMenuItem>
              <DropdownMenuItem icon={<Pencil />} onSelect={() => setAction("rename")}>
                Rename…
              </DropdownMenuItem>
              {!isView && (
                <DropdownMenuItem icon={<Eraser />} onSelect={() => setAction("truncate")}>
                  Empty table (truncate)…
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem icon={<Trash2 />} danger onSelect={() => setAction("drop")}>
                Drop {kindLabel}…
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="min-h-0 flex-1">
        {tab.view === "data" && <TableData database={tab.database} schema={tab.schema} table={tab.name} />}
        {tab.view === "structure" && <StructureView database={tab.database} schema={tab.schema} table={tab.name} />}
        {tab.view === "definition" && (
          <DefinitionView
            database={tab.database}
            schema={tab.schema}
            kind={tab.kind === "view" ? "view" : tab.kind === "materialized_view" ? "materialized_view" : "table"}
            name={tab.name}
          />
        )}
      </div>

      {action === "rename" && (
        <RunSqlDialog
          open
          onOpenChange={(open) => !open && setAction(null)}
          title={`Rename ${tab.name}`}
          sql={newName.trim() && newName !== tab.name ? renameTable(tab.schema, tab.name, newName.trim()) : "-- type a new name"}
          database={tab.database}
          confirmLabel="Rename"
          successMessage={`Renamed to ${newName.trim()}`}
          onDone={() => {
            closeTab(tab.id);
          }}
        >
          <Field label="New name">
            {(p) => <Input {...p} className="font-mono" autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} />}
          </Field>
        </RunSqlDialog>
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

export function DefinitionView({
  database,
  schema,
  kind,
  name,
}: {
  database: string;
  schema: string;
  kind: ObjectKind;
  name: string;
}) {
  const definition = useDefinition(database, schema, kind, name);
  if (definition.isPending) {
    return (
      <div className="flex h-full items-center justify-center text-fg-subtle">
        <Spinner />
      </div>
    );
  }
  if (definition.isError) return <p className="p-4 text-sm text-danger">{describeError(definition.error).message}</p>;
  return (
    <div className="relative h-full">
      <Button
        size="sm"
        className="absolute top-2 right-4 z-10"
        iconLeft={<Copy />}
        onClick={() => void navigator.clipboard.writeText(definition.data).then(() => toast.success("Definition copied"))}
      >
        Copy
      </Button>
      <SqlBlock sql={definition.data} className="h-full rounded-none border-0" />
    </div>
  );
}
