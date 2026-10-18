import { cn, EmptyState, Kbd, Spinner } from "@repo/ui";
import {
  Blocks,
  Eye,
  FunctionSquare,
  Hash,
  Network,
  Plus,
  Table2,
  TerminalSquare,
  X,
} from "lucide-react";
import { lazy, type MouseEvent, type ReactNode, Suspense } from "react";
import { useExplorer } from "./explorer-context";
import { QueryTab } from "./sql/query-tab";
import { CreateTableTab } from "./tabs/create-table-tab";
import { ExtensionsTab } from "./tabs/extensions-tab";
import { DefinitionView, TableTab } from "./tabs/table-tab";
import { type Tab, useWorkspace } from "./workspace-store";

// React Flow + dagre are only needed for diagrams
const DiagramTab = lazy(() =>
  import("./tabs/diagram-tab").then((m) => ({ default: m.DiagramTab })),
);

function tabLabel(tab: Tab): { icon: ReactNode; label: string; hint?: string } {
  switch (tab.type) {
    case "table":
      return {
        icon:
          tab.kind === "view" || tab.kind === "materialized_view" ? (
            <Eye />
          ) : (
            <Table2 />
          ),
        label: tab.name,
        hint: `${tab.database}.${tab.schema}.${tab.name}`,
      };
    case "query":
      return { icon: <TerminalSquare />, label: tab.title, hint: tab.database };
    case "definition":
      return {
        icon: tab.kind === "function" ? <FunctionSquare /> : <Hash />,
        label: tab.title,
      };
    case "diagram":
      return { icon: <Network />, label: `Diagram · ${tab.schema}` };
    case "extensions":
      return { icon: <Blocks />, label: `Extensions · ${tab.database}` };
    case "create-table":
      return { icon: <Plus />, label: "New table" };
  }
}

/** Tab bar plus the active tab. Inactive tabs stay mounted only for queries (to keep results). */
export function Workspace() {
  const { serverId } = useExplorer();
  const {
    tabs,
    activeTabId,
    setActive,
    closeTab,
    closeOtherTabs,
    newQuery,
    openTab,
    database,
    schema,
  } = useWorkspace(serverId);
  const active = tabs.find((t) => t.id === activeTabId) ?? null;

  const onTabMouseDown = (event: MouseEvent, id: string) => {
    // Middle click closes, like a browser
    if (event.button === 1) {
      event.preventDefault();
      closeTab(id);
    }
  };

  return (
    <div className="flex h-full min-w-0 flex-col">
      <div className="flex h-9 shrink-0 items-end gap-px overflow-x-auto border-b border-border bg-surface px-1">
        {tabs.map((tab) => {
          const { icon, label, hint } = tabLabel(tab);
          const isActive = tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              title={hint}
              onMouseDown={(e) => onTabMouseDown(e, tab.id)}
              onDoubleClick={() => closeOtherTabs(tab.id)}
              className={cn(
                "group relative flex h-8 max-w-52 shrink-0 cursor-pointer items-center gap-1.5 rounded-t-control pr-1 pl-2.5 text-xs [&_svg]:size-3.5",
                isActive
                  ? "bg-bg text-fg"
                  : "text-fg-muted hover:bg-surface-hover/50 hover:text-fg",
              )}
              onClick={() => setActive(tab.id)}
            >
              {isActive && (
                <span className="absolute inset-x-0 top-0 h-0.5 rounded-full bg-accent" />
              )}
              <span className={isActive ? "text-accent" : "text-fg-subtle"}>
                {icon}
              </span>
              <span className="truncate font-mono">{label}</span>
              <button
                type="button"
                aria-label={`Close ${label}`}
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(tab.id);
                }}
                className="ml-0.5 cursor-pointer rounded p-0.5 text-fg-subtle opacity-0 group-hover:opacity-100 hover:bg-surface-hover hover:text-fg"
              >
                <X className="size-3" />
              </button>
            </div>
          );
        })}
        {database && (
          <button
            type="button"
            aria-label="New query"
            title="New query"
            onClick={() => newQuery(database)}
            className="mb-1 ml-1 flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-control text-fg-subtle hover:bg-surface-hover hover:text-fg"
          >
            <Plus className="size-3.5" />
          </button>
        )}
      </div>

      <div className="relative min-h-0 flex-1">
        {/* Query tabs stay mounted so results and editor state survive switching tabs */}
        {tabs
          .filter((t) => t.type === "query")
          .map((t) => (
            <div
              key={t.id}
              className={cn(
                "absolute inset-0",
                t.id !== activeTabId && "hidden",
              )}
            >
              <QueryTab tab={t as Extract<Tab, { type: "query" }>} />
            </div>
          ))}

        {active && active.type !== "query" && (
          <div className="absolute inset-0">
            {active.type === "table" && (
              <TableTab key={active.id} tab={active} />
            )}
            {active.type === "definition" && (
              <DefinitionView
                database={active.database}
                schema={active.schema}
                kind={active.kind}
                name={active.name}
              />
            )}
            {active.type === "diagram" && (
              <Suspense
                fallback={
                  <div className="flex h-full items-center justify-center text-fg-subtle">
                    <Spinner />
                  </div>
                }
              >
                <DiagramTab
                  database={active.database}
                  schema={active.schema}
                  onOpenTable={(name) =>
                    openTab({
                      type: "table",
                      database: active.database,
                      schema: active.schema,
                      name,
                      kind: "table",
                      view: "data",
                    })
                  }
                />
              </Suspense>
            )}
            {active.type === "extensions" && (
              <ExtensionsTab database={active.database} schema={schema} />
            )}
            {active.type === "create-table" && (
              <CreateTableTab
                database={active.database}
                schema={active.schema}
                onCreated={(name) => {
                  closeTab(active.id);
                  openTab({
                    type: "table",
                    database: active.database,
                    schema: active.schema,
                    name,
                    kind: "table",
                    view: "structure",
                  });
                }}
              />
            )}
          </div>
        )}

        {!active && (
          <EmptyState
            className="h-full"
            icon={<Table2 />}
            title="Open a table or start a query"
            description="Pick a table on the left, or write SQL in a new query tab."
            actions={
              database && (
                <button
                  type="button"
                  onClick={() => newQuery(database)}
                  className="flex cursor-pointer items-center gap-2 text-xs text-fg-muted hover:text-fg"
                >
                  <TerminalSquare className="size-3.5" /> New query{" "}
                  <Kbd>Ctrl</Kbd>
                  <Kbd>T</Kbd>
                </button>
              )
            }
          />
        )}
      </div>
    </div>
  );
}
