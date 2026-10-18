import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ObjectKind, TableKind } from "../../lib/bindings";

export type TableView = "data" | "structure" | "definition";

export type Tab =
  | { id: string; type: "table"; database: string; schema: string; name: string; kind: TableKind; view: TableView }
  | { id: string; type: "query"; database: string; title: string; sql: string }
  | { id: string; type: "definition"; database: string; schema: string; kind: ObjectKind; name: string; title: string }
  | { id: string; type: "diagram"; database: string; schema: string }
  | { id: string; type: "extensions"; database: string }
  | { id: string; type: "create-table"; database: string; schema: string };

/** Tab without an id; ids are derived so opening the same object twice focuses the existing tab. */
export type NewTab = Tab extends infer T ? (T extends Tab ? Omit<T, "id"> : never) : never;

interface ServerWorkspace {
  database: string | null;
  schema: string | null;
  tabs: Tab[];
  activeTabId: string | null;
  /** Counter for "Query 1", "Query 2" … */
  queryCount: number;
}

const EMPTY: ServerWorkspace = { database: null, schema: null, tabs: [], activeTabId: null, queryCount: 0 };

function tabId(tab: NewTab, queryCount: number) {
  switch (tab.type) {
    case "table":
      return `table:${tab.database}.${tab.schema}.${tab.name}`;
    case "definition":
      return `def:${tab.database}.${tab.schema}.${tab.kind}.${tab.name}`;
    case "diagram":
      return `diagram:${tab.database}.${tab.schema}`;
    case "extensions":
      return `extensions:${tab.database}`;
    case "create-table":
      return `create-table:${tab.database}.${tab.schema}`;
    case "query":
      return `query:${queryCount}:${Date.now()}`;
  }
}

interface WorkspaceState {
  workspaces: Record<string, ServerWorkspace>;
  setLocation: (serverId: string, location: { database?: string | null; schema?: string | null }) => void;
  openTab: (serverId: string, tab: NewTab) => void;
  newQuery: (serverId: string, database: string, sql?: string) => void;
  updateTab: (serverId: string, id: string, patch: Partial<Tab>) => void;
  closeTab: (serverId: string, id: string) => void;
  closeOtherTabs: (serverId: string, id: string) => void;
  /** Closes tabs for a table that no longer exists (renamed or dropped). */
  closeTabsFor: (serverId: string, predicate: (tab: Tab) => boolean) => void;
  setActive: (serverId: string, id: string) => void;
}

/** Explorer tabs and location per server. Persisted, so open tabs and unsaved SQL survive restarts. */
export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set) => {
      const update = (serverId: string, change: (ws: ServerWorkspace) => Partial<ServerWorkspace>) =>
        set((state) => {
          const ws = state.workspaces[serverId] ?? EMPTY;
          return { workspaces: { ...state.workspaces, [serverId]: { ...ws, ...change(ws) } } };
        });

      return {
        workspaces: {},

        setLocation: (serverId, location) =>
          update(serverId, (ws) => ({
            database: location.database !== undefined ? location.database : ws.database,
            schema: location.schema !== undefined ? location.schema : ws.schema,
          })),

        openTab: (serverId, tab) =>
          update(serverId, (ws) => {
            const id = tabId(tab, ws.queryCount);
            const existing = ws.tabs.find((t) => t.id === id);
            if (existing) {
              // Re-opening a table on a different view switches the view
              const tabs =
                tab.type === "table"
                  ? ws.tabs.map((t) => (t.id === id ? ({ ...t, view: tab.view } as Tab) : t))
                  : ws.tabs;
              return { tabs, activeTabId: id };
            }
            return { tabs: [...ws.tabs, { ...tab, id } as Tab], activeTabId: id };
          }),

        newQuery: (serverId, database, sql = "") =>
          update(serverId, (ws) => {
            const count = ws.queryCount + 1;
            const tab: Tab = { id: tabId({ type: "query", database, title: "", sql }, count), type: "query", database, title: `Query ${count}`, sql };
            return { tabs: [...ws.tabs, tab], activeTabId: tab.id, queryCount: count };
          }),

        updateTab: (serverId, id, patch) =>
          update(serverId, (ws) => ({
            tabs: ws.tabs.map((t) => (t.id === id ? ({ ...t, ...patch } as Tab) : t)),
          })),

        closeTab: (serverId, id) =>
          update(serverId, (ws) => {
            const index = ws.tabs.findIndex((t) => t.id === id);
            const tabs = ws.tabs.filter((t) => t.id !== id);
            const activeTabId =
              ws.activeTabId === id ? (tabs[Math.min(index, tabs.length - 1)]?.id ?? null) : ws.activeTabId;
            return { tabs, activeTabId };
          }),

        closeOtherTabs: (serverId, id) =>
          update(serverId, (ws) => ({ tabs: ws.tabs.filter((t) => t.id === id), activeTabId: id })),

        closeTabsFor: (serverId, predicate) =>
          update(serverId, (ws) => {
            const tabs = ws.tabs.filter((t) => !predicate(t));
            return {
              tabs,
              activeTabId: tabs.some((t) => t.id === ws.activeTabId) ? ws.activeTabId : (tabs.at(-1)?.id ?? null),
            };
          }),

        setActive: (serverId, id) => update(serverId, () => ({ activeTabId: id })),
      };
    },
    { name: "postcompass-workspaces", version: 1 },
  ),
);

const EMPTY_TABS: Tab[] = [];

/** The workspace for one server, with actions bound to it. */
export function useWorkspace(serverId: string) {
  const ws = useWorkspaceStore((s) => s.workspaces[serverId]);
  const actions = useWorkspaceStore.getState();
  return {
    database: ws?.database ?? null,
    schema: ws?.schema ?? null,
    tabs: ws?.tabs ?? EMPTY_TABS,
    activeTabId: ws?.activeTabId ?? null,
    setLocation: (location: { database?: string | null; schema?: string | null }) =>
      actions.setLocation(serverId, location),
    openTab: (tab: NewTab) => actions.openTab(serverId, tab),
    newQuery: (database: string, sql?: string) => actions.newQuery(serverId, database, sql),
    updateTab: (id: string, patch: Partial<Tab>) => actions.updateTab(serverId, id, patch),
    closeTab: (id: string) => actions.closeTab(serverId, id),
    closeOtherTabs: (id: string) => actions.closeOtherTabs(serverId, id),
    closeTabsFor: (predicate: (tab: Tab) => boolean) => actions.closeTabsFor(serverId, predicate),
    setActive: (id: string) => actions.setActive(serverId, id),
  };
}

export interface HistoryEntry {
  sql: string;
  database: string;
  at: number;
  durationMs: number;
  ok: boolean;
}

export interface SavedQuery {
  id: string;
  name: string;
  sql: string;
}

interface QueryLibraryState {
  history: Record<string, HistoryEntry[]>;
  saved: Record<string, SavedQuery[]>;
  addHistory: (serverId: string, entry: HistoryEntry) => void;
  clearHistory: (serverId: string) => void;
  saveQuery: (serverId: string, name: string, sql: string) => void;
  deleteSaved: (serverId: string, id: string) => void;
}

const MAX_HISTORY = 200;

/** Query history and saved queries per server. Persisted. */
export const useQueryLibrary = create<QueryLibraryState>()(
  persist(
    (set) => ({
      history: {},
      saved: {},
      addHistory: (serverId, entry) =>
        set((s) => {
          const list = s.history[serverId] ?? [];
          // Re-running the same SQL moves it to the top instead of duplicating it
          const rest = list.filter((h) => h.sql !== entry.sql || h.database !== entry.database);
          return { history: { ...s.history, [serverId]: [entry, ...rest].slice(0, MAX_HISTORY) } };
        }),
      clearHistory: (serverId) => set((s) => ({ history: { ...s.history, [serverId]: [] } })),
      saveQuery: (serverId, name, sql) =>
        set((s) => ({
          saved: {
            ...s.saved,
            [serverId]: [{ id: `${Date.now()}`, name, sql }, ...(s.saved[serverId] ?? [])],
          },
        })),
      deleteSaved: (serverId, id) =>
        set((s) => ({ saved: { ...s.saved, [serverId]: (s.saved[serverId] ?? []).filter((q) => q.id !== id) } })),
    }),
    { name: "postcompass-queries", version: 1 },
  ),
);
