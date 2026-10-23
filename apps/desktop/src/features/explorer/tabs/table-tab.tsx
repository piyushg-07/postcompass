import {
  Button,
  cn,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Spinner,
  toast,
} from "@repo/ui";
import { Copy, SquareTerminal, Unlock } from "lucide-react";
import { useState } from "react";
import type { ObjectKind } from "../../../lib/bindings";
import { qualified } from "../../../lib/sql";
import { TableData, TableFooter } from "../data/table-data";
import { useDefinition, useExplorer, useStructure } from "../explorer-context";
import { RunSqlDialog } from "../run-sql-dialog";
import { SqlBlock } from "../sql/sql-editor";
import { StructureView } from "../structure/structure-view";
import { type Tab, type TableView, useWorkspace } from "../workspace-store";
import { LoadError } from "../load-error";

type TableTabModel = Extract<Tab, { type: "table" }>;

const VIEWS: { id: TableView; label: string }[] = [
  { id: "data", label: "Data" },
  { id: "structure", label: "Structure" },
  { id: "definition", label: "Definition" },
];

/** Like Supabase, views only have data and their SQL definition. */
const VIEW_VIEWS = VIEWS.filter((v) => v.id !== "structure");

type Action = "secure";

export function TableTab({ tab }: { tab: TableTabModel }) {
  const { serverId } = useExplorer();
  const { updateTab } = useWorkspace(serverId);
  const [action, setAction] = useState<Action | null>(null);
  const isView = tab.kind === "view" || tab.kind === "materialized_view";

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
  if (definition.isError) return <LoadError query={definition} />;
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
