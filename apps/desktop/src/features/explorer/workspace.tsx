import { cn, ContextMenu, ContextMenuTrigger, EmptyState, Kbd, Spinner } from "@repo/ui";
import { Plus, Table2, TerminalSquare, X } from "lucide-react";
import {
  lazy,
  memo,
  type MouseEvent,
  Suspense,
  useEffect,
  useRef,
  useState,
} from "react";
import { useExplorer } from "./explorer-context";
import { PoliciesTab } from "./policies/policies-tab";
import { QueryTab } from "./sql/query-tab";
import { ExtensionsTab } from "./tabs/extensions-tab";
import { ObjectsTab } from "./tabs/objects-tab";
import { DefinitionView, TableTab } from "./tabs/table-tab";
import { type Tab, useWorkspace } from "./workspace-store";
import { TabMenu, tabLabel } from "./workspace-ui/tab-menu";

// Query tabs all stay mounted; an edit only replaces the edited tab's object, so the others
// skip re-rendering while you type
const KeptQueryTab = memo(QueryTab);

// React Flow + dagre are only needed for diagrams
const DiagramTab = lazy(() =>
  import("./tabs/diagram-tab").then((m) => ({ default: m.DiagramTab })),
);

/** Tab bar plus the active tab. Inactive tabs stay mounted only for queries (to keep results). */
export function Workspace() {
  const { serverId } = useExplorer();
  const {
    tabs,
    activeTabId,
    setActive,
    closeTab,
    closeOtherTabs,
    closeTabsFor,
    moveTab,
    newQuery,
    openTab,
    database,
    schema,
  } = useWorkspace(serverId);
  const active = tabs.find((t) => t.id === activeTabId) ?? null;
  const tabBar = useRef<HTMLDivElement>(null);

  // Keep the active tab visible when it's opened or picked from the sidebar
  useEffect(() => {
    if (!activeTabId) return;
    tabBar.current
      ?.querySelector(`[data-tab-id="${CSS.escape(activeTabId)}"]`)
      ?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activeTabId, tabs.length]);

  /** The tab being dragged and the gap it would drop into (x inside the tab bar). */
  const [drag, setDrag] = useState<{ id: string; x: number } | null>(null);
  // A drag ends with a click on the tab; this stops that click from switching tabs
  const dragged = useRef(false);

  const onTabMouseDown = (event: MouseEvent, id: string) => {
    // Middle click closes, like a browser
    if (event.button === 1) {
      event.preventDefault();
      closeTab(id);
      return;
    }
    const bar = tabBar.current;
    if (event.button !== 0 || !bar) return;
    if ((event.target as HTMLElement).closest("button")) return;
    const startX = event.clientX;
    dragged.current = false;
    let target: number | null = null;

    const move = (e: globalThis.MouseEvent) => {
      if (target === null && Math.abs(e.clientX - startX) < 5) return;
      dragged.current = true;
      document.body.style.cursor = "grabbing";
      const others = [
        ...bar.querySelectorAll<HTMLElement>("[data-tab-id]"),
      ].filter((el) => el.dataset.tabId !== id);
      const barLeft = bar.getBoundingClientRect().left - bar.scrollLeft;
      // Drop before the first tab whose middle is right of the pointer
      let index = others.length;
      for (let i = 0; i < others.length; i++) {
        const r = others[i]!.getBoundingClientRect();
        if (e.clientX < r.left + r.width / 2) {
          index = i;
          break;
        }
      }
      target = index;
      const edge =
        index < others.length
          ? others[index]!.getBoundingClientRect().left
          : (others.at(-1)?.getBoundingClientRect().right ?? startX);
      setDrag({ id, x: edge - barLeft });
    };
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      document.body.style.cursor = "";
      setDrag(null);
      if (target !== null) moveTab(id, target);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  return (
    <div className="flex h-full min-w-0 flex-col overflow-clip">
      {/* No visible scrollbar: in a fixed-height bar it eats into the height and pushes the tabs
          up under the header. Scroll with the mouse wheel instead. */}
      <div
        ref={tabBar}
        onWheel={(e) => {
          if (e.deltaY && tabBar.current) tabBar.current.scrollLeft += e.deltaY;
        }}
        className="relative flex h-9 shrink-0 items-end gap-px overflow-x-auto overflow-y-hidden border-b border-border bg-surface px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {drag && (
          <span
            className="pointer-events-none absolute top-1.5 bottom-1.5 z-10 w-0.5 -translate-x-1/2 rounded-full bg-accent"
            style={{ left: drag.x }}
          />
        )}
        {tabs.map((tab) => {
          const { icon, label } = tabLabel(tab);
          const isActive = tab.id === activeTabId;
          return (
            <ContextMenu key={tab.id}>
              <ContextMenuTrigger asChild>
                <div
                  data-tab-id={tab.id}
                  onMouseDown={(e) => onTabMouseDown(e, tab.id)}
                  className={cn(
                    "group relative flex h-8 max-w-52 shrink-0 cursor-pointer items-center select-none gap-1.5 rounded-t-control pr-1 pl-2.5 text-xs [&_svg]:size-3.5",
                    isActive
                      ? "bg-bg text-fg"
                      : "text-fg-muted hover:bg-surface-hover/50 hover:text-fg",
                    drag?.id === tab.id && "opacity-50",
                  )}
                  onClick={() => {
                    if (!dragged.current) setActive(tab.id);
                    dragged.current = false;
                  }}
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
                    className="ml-0.5 cursor-pointer rounded p-0.5 text-fg-subtle opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 hover:bg-surface-hover hover:text-fg"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              </ContextMenuTrigger>
              <TabMenu
                tab={tab}
                onClose={() => closeTab(tab.id)}
                onCloseOthers={() => closeOtherTabs(tab.id)}
                onCloseRight={() => {
                  const right = new Set(
                    tabs.slice(tabs.indexOf(tab) + 1).map((t) => t.id),
                  );
                  closeTabsFor((t) => right.has(t.id));
                }}
                onCloseAll={() => closeTabsFor(() => true)}
                onDuplicate={
                  tab.type === "query"
                    ? () => newQuery(tab.database, tab.sql)
                    : undefined
                }
                onView={
                  tab.type === "table"
                    ? (view) => openTab({ ...tab, view })
                    : undefined
                }
                isLast={tabs.indexOf(tab) === tabs.length - 1}
                isOnly={tabs.length === 1}
              />
            </ContextMenu>
          );
        })}
        {database && (
          <button
            type="button"
            aria-label="New query"
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
              <KeptQueryTab tab={t as Extract<Tab, { type: "query" }>} />
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
            {active.type === "objects" && (
              <ObjectsTab
                key={active.id}
                database={active.database}
                schema={active.schema}
                group={active.group}
              />
            )}
            {active.type === "extensions" && (
              <ExtensionsTab database={active.database} schema={schema} />
            )}
            {active.type === "policies" && (
              <PoliciesTab
                key={`${active.id}:${active.table ?? ""}`}
                database={active.database}
                schema={active.schema}
                focusTable={active.table}
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
