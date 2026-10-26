import { useMemo } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  EMPTY_WORKSPACE,
  type NewTab,
  nextQueryNumber,
  rekeyTabs,
  rememberTable,
  type ServerWorkspace,
  type Tab,
  tabId,
} from "./store/workspace-tabs";

export type {
  NewTab,
  ObjectGroup,
  RecentTable,
  Tab,
  TableView,
} from "./store/workspace-tabs";
export {
  type HistoryEntry,
  type SavedQuery,
  useQueryLibrary,
} from "./store/query-library";

interface WorkspaceState {
  workspaces: Record<string, ServerWorkspace>;
  setLocation: (
    serverId: string,
    location: { database?: string | null; schema?: string | null },
  ) => void;
  openTab: (serverId: string, tab: NewTab) => void;
  newQuery: (serverId: string, database: string, sql?: string) => void;
  /** Opens a saved snippet, or switches to the tab that already has it. */
  openSnippet: (
    serverId: string,
    database: string,
    snippet: { id: string; name: string; sql: string },
  ) => void;
  updateTab: (serverId: string, id: string, patch: Partial<Tab>) => void;
  closeTab: (serverId: string, id: string) => void;
  closeOtherTabs: (serverId: string, id: string) => void;
  /** Moves a tab to `index` (its position after the move). */
  moveTab: (serverId: string, id: string, index: number) => void;
  /** Closes tabs for a table that no longer exists (renamed or dropped). */
  closeTabsFor: (serverId: string, predicate: (tab: Tab) => boolean) => void;
  setActive: (serverId: string, id: string) => void;
}

/** Explorer tabs and location per server. Persisted, so open tabs and unsaved SQL survive restarts. */
export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set) => {
      const update = (
        serverId: string,
        change: (ws: ServerWorkspace) => Partial<ServerWorkspace>,
      ) =>
        set((state) => {
          const ws = state.workspaces[serverId] ?? EMPTY_WORKSPACE;
          const patch = change(ws);
          // Nothing changed: keep the state object so subscribers don't re-render
          if (Object.keys(patch).length === 0) return state;
          return {
            workspaces: {
              ...state.workspaces,
              [serverId]: { ...ws, ...patch },
            },
          };
        });

      return {
        workspaces: {},

        setLocation: (serverId, location) =>
          update(serverId, (ws) => ({
            database:
              location.database !== undefined ? location.database : ws.database,
            schema: location.schema !== undefined ? location.schema : ws.schema,
          })),

        openTab: (serverId, tab) =>
          update(serverId, (ws) => {
            const id = tabId(tab, ws.queryCount);
            const existing = ws.tabs.find((t) => t.id === id);
            if (existing) {
              // Re-opening a table on a different view switches the view
              const tabs =
                tab.type === "policies"
                  ? ws.tabs.map((t) =>
                      t.id === id ? ({ ...t, table: tab.table } as Tab) : t,
                    )
                  : tab.type === "table"
                    ? ws.tabs.map((t) =>
                        t.id === id
                          ? ({
                              ...t,
                              view: tab.view,
                              ...(tab.filters ? { filters: tab.filters } : {}),
                            } as Tab)
                          : t,
                      )
                    : ws.tabs;
              return {
                tabs,
                activeTabId: id,
                recentTables: rememberTable(ws, tab),
              };
            }
            return {
              tabs: [...ws.tabs, { ...tab, id } as Tab],
              activeTabId: id,
              recentTables: rememberTable(ws, tab),
            };
          }),

        newQuery: (serverId, database, sql = "") =>
          update(serverId, (ws) => {
            const count = ws.queryCount + 1;
            const tab: Tab = {
              id: tabId({ type: "query", database, title: "", sql }, count),
              type: "query",
              database,
              title: `Query ${nextQueryNumber(ws.tabs)}`,
              sql,
            };
            return {
              tabs: [...ws.tabs, tab],
              activeTabId: tab.id,
              queryCount: count,
            };
          }),

        openSnippet: (serverId, database, snippet) =>
          update(serverId, (ws) => {
            const open = ws.tabs.find(
              (t) => t.type === "query" && t.savedId === snippet.id,
            );
            if (open) return { activeTabId: open.id };
            const count = ws.queryCount + 1;
            const tab: Tab = {
              id: tabId(
                { type: "query", database, title: "", sql: snippet.sql },
                count,
              ),
              type: "query",
              database,
              title: snippet.name,
              sql: snippet.sql,
              savedId: snippet.id,
            };
            return {
              tabs: [...ws.tabs, tab],
              activeTabId: tab.id,
              queryCount: count,
            };
          }),

        updateTab: (serverId, id, patch) =>
          update(serverId, (ws) =>
            // A late update (e.g. an autosave) for a closed tab changes nothing
            ws.tabs.some((t) => t.id === id)
              ? {
                  tabs: ws.tabs.map((t) =>
                    t.id === id ? ({ ...t, ...patch } as Tab) : t,
                  ),
                }
              : {},
          ),

        closeTab: (serverId, id) =>
          update(serverId, (ws) => {
            const index = ws.tabs.findIndex((t) => t.id === id);
            if (index === -1) return {};
            const tabs = ws.tabs.filter((t) => t.id !== id);
            const activeTabId =
              ws.activeTabId === id
                ? (tabs[Math.min(index, tabs.length - 1)]?.id ?? null)
                : ws.activeTabId;
            return { tabs, activeTabId };
          }),

        closeOtherTabs: (serverId, id) =>
          update(serverId, (ws) => {
            const tabs = ws.tabs.filter((t) => t.id === id);
            return { tabs, activeTabId: tabs[0]?.id ?? null };
          }),

        moveTab: (serverId, id, index) =>
          update(serverId, (ws) => {
            const tab = ws.tabs.find((t) => t.id === id);
            if (!tab) return {};
            const tabs = ws.tabs.filter((t) => t.id !== id);
            tabs.splice(Math.max(0, Math.min(index, tabs.length)), 0, tab);
            return { tabs };
          }),

        closeTabsFor: (serverId, predicate) =>
          update(serverId, (ws) => {
            const tabs = ws.tabs.filter((t) => !predicate(t));
            if (tabs.length === ws.tabs.length) return {};
            return {
              tabs,
              activeTabId: tabs.some((t) => t.id === ws.activeTabId)
                ? ws.activeTabId
                : (tabs.at(-1)?.id ?? null),
            };
          }),

        setActive: (serverId, id) =>
          update(serverId, (ws) =>
            ws.tabs.some((t) => t.id === id) ? { activeTabId: id } : {},
          ),
      };
    },
    {
      name: "postcompass-workspaces",
      version: 3,
      migrate: (persisted, version) => {
        const state = persisted as Pick<WorkspaceState, "workspaces">;
        for (const ws of Object.values(state.workspaces ?? {})) {
          // v2: "New table" became a side panel, so drop old create-table tabs
          if (version < 2) {
            ws.tabs = ws.tabs.filter(
              (t) => (t.type as string) !== "create-table",
            );
            if (!ws.tabs.some((t) => t.id === ws.activeTabId))
              ws.activeTabId = ws.tabs.at(-1)?.id ?? null;
          }
          // v3: tab ids no longer join names with dots (they could collide)
          if (version < 3) rekeyTabs(ws);
        }
        return state as WorkspaceState;
      },
    },
  ),
);

const EMPTY_TABS: Tab[] = [];

/**
 * The actions of one server's workspace, bound to it. Stable between renders and subscribes to
 * nothing, so components that only open or close tabs don't re-render on every keystroke in a
 * query tab (prefer this over `useWorkspace` for them).
 */
export function useWorkspaceActions(serverId: string) {
  return useMemo(() => {
    const actions = useWorkspaceStore.getState();
    return {
      setLocation: (location: {
        database?: string | null;
        schema?: string | null;
      }) => actions.setLocation(serverId, location),
      openTab: (tab: NewTab) => actions.openTab(serverId, tab),
      newQuery: (database: string, sql?: string) =>
        actions.newQuery(serverId, database, sql),
      openSnippet: (
        database: string,
        snippet: { id: string; name: string; sql: string },
      ) => actions.openSnippet(serverId, database, snippet),
      updateTab: (id: string, patch: Partial<Tab>) =>
        actions.updateTab(serverId, id, patch),
      closeTab: (id: string) => actions.closeTab(serverId, id),
      closeOtherTabs: (id: string) => actions.closeOtherTabs(serverId, id),
      moveTab: (id: string, index: number) =>
        actions.moveTab(serverId, id, index),
      closeTabsFor: (predicate: (tab: Tab) => boolean) =>
        actions.closeTabsFor(serverId, predicate),
      setActive: (id: string) => actions.setActive(serverId, id),
    };
  }, [serverId]);
}

/** The workspace for one server, with actions bound to it. */
export function useWorkspace(serverId: string) {
  const ws = useWorkspaceStore((s) => s.workspaces[serverId]);
  const actions = useWorkspaceActions(serverId);
  return {
    database: ws?.database ?? null,
    schema: ws?.schema ?? null,
    tabs: ws?.tabs ?? EMPTY_TABS,
    activeTabId: ws?.activeTabId ?? null,
    ...actions,
  };
}
