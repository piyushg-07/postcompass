import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { FilterSpec, ObjectKind, TableKind } from "../../lib/bindings";

export type TableView = "data" | "structure" | "definition";

/** The list pages in the sidebar's "Database" section. */
export type ObjectGroup = "functions" | "triggers" | "enums" | "sequences";

export type Tab =
  | {
      id: string;
      type: "table";
      database: string;
      schema: string;
      name: string;
      kind: TableKind;
      view: TableView;
      /** Filters to start with, e.g. when following a foreign key. */
      filters?: FilterSpec[];
    }
  | {
      id: string;
      type: "query";
      database: string;
      title: string;
      sql: string;
      /** The saved snippet this tab edits; saving updates it in place. */
      savedId?: string;
    }
  | {
      id: string;
      type: "definition";
      database: string;
      schema: string;
      kind: ObjectKind;
      name: string;
      title: string;
    }
  | { id: string; type: "diagram"; database: string; schema: string }
  | { id: string; type: "extensions"; database: string }
  | {
      id: string;
      type: "policies";
      database: string;
      schema: string;
      /** The table to scroll to, when opened from a table's structure. */
      table?: string;
    }
  | {
      id: string;
      type: "objects";
      database: string;
      schema: string;
      group: ObjectGroup;
    };

/** Tab without an id; ids are derived so opening the same object twice focuses the existing tab. */
export type NewTab = Tab extends infer T
  ? T extends Tab
    ? Omit<T, "id">
    : never
  : never;

export interface RecentTable {
  database: string;
  schema: string;
  name: string;
  kind: TableKind;
  at: number;
}

interface ServerWorkspace {
  database: string | null;
  schema: string | null;
  tabs: Tab[];
  activeTabId: string | null;
  /** Counter for "Query 1", "Query 2" … */
  queryCount: number;
  /** Recently opened tables, newest first; kept even after their tab is closed. */
  recentTables?: RecentTable[];
}

const MAX_RECENT_TABLES = 10;

const EMPTY: ServerWorkspace = {
  database: null,
  schema: null,
  tabs: [],
  activeTabId: null,
  queryCount: 0,
};

function rememberTable(
  ws: ServerWorkspace,
  tab: NewTab,
): RecentTable[] | undefined {
  if (tab.type !== "table") return ws.recentTables;
  const entry: RecentTable = {
    database: tab.database,
    schema: tab.schema,
    name: tab.name,
    kind: tab.kind,
    at: Date.now(),
  };
  const rest = (ws.recentTables ?? []).filter(
    (t) =>
      !(
        t.database === entry.database &&
        t.schema === entry.schema &&
        t.name === entry.name
      ),
  );
  return [entry, ...rest].slice(0, MAX_RECENT_TABLES);
}

/** The lowest "Query N" not taken by an open tab, so closing tabs frees their numbers. */
function nextQueryNumber(tabs: Tab[]) {
  const taken = new Set(
    tabs.flatMap((t) => {
      const m = t.type === "query" ? /^Query (\d+)$/.exec(t.title) : null;
      return m ? [Number(m[1])] : [];
    }),
  );
  let n = 1;
  while (taken.has(n)) n++;
  return n;
}

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
    case "policies":
      return `policies:${tab.database}.${tab.schema}`;
    case "objects":
      return `objects:${tab.database}.${tab.schema}.${tab.group}`;
    case "query":
      return `query:${queryCount}:${Date.now()}`;
  }
}

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
          const ws = state.workspaces[serverId] ?? EMPTY;
          return {
            workspaces: {
              ...state.workspaces,
              [serverId]: { ...ws, ...change(ws) },
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
          update(serverId, (ws) => ({
            tabs: ws.tabs.map((t) =>
              t.id === id ? ({ ...t, ...patch } as Tab) : t,
            ),
          })),

        closeTab: (serverId, id) =>
          update(serverId, (ws) => {
            const index = ws.tabs.findIndex((t) => t.id === id);
            const tabs = ws.tabs.filter((t) => t.id !== id);
            const activeTabId =
              ws.activeTabId === id
                ? (tabs[Math.min(index, tabs.length - 1)]?.id ?? null)
                : ws.activeTabId;
            return { tabs, activeTabId };
          }),

        closeOtherTabs: (serverId, id) =>
          update(serverId, (ws) => ({
            tabs: ws.tabs.filter((t) => t.id === id),
            activeTabId: id,
          })),

        closeTabsFor: (serverId, predicate) =>
          update(serverId, (ws) => {
            const tabs = ws.tabs.filter((t) => !predicate(t));
            return {
              tabs,
              activeTabId: tabs.some((t) => t.id === ws.activeTabId)
                ? ws.activeTabId
                : (tabs.at(-1)?.id ?? null),
            };
          }),

        setActive: (serverId, id) =>
          update(serverId, () => ({ activeTabId: id })),
      };
    },
    {
      name: "postcompass-workspaces",
      version: 2,
      // v2: "New table" became a side panel, so drop old create-table tabs
      migrate: (persisted, version) => {
        const state = persisted as Pick<WorkspaceState, "workspaces">;
        if (version < 2) {
          for (const ws of Object.values(state.workspaces ?? {})) {
            ws.tabs = ws.tabs.filter(
              (t) => (t.type as string) !== "create-table",
            );
            if (!ws.tabs.some((t) => t.id === ws.activeTabId))
              ws.activeTabId = ws.tabs.at(-1)?.id ?? null;
          }
        }
        return state as WorkspaceState;
      },
    },
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
    closeTabsFor: (predicate: (tab: Tab) => boolean) =>
      actions.closeTabsFor(serverId, predicate),
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
  /** Folder name; none means it sits at the top level. */
  folder?: string;
  favorite?: boolean;
}

interface QueryLibraryState {
  history: Record<string, HistoryEntry[]>;
  saved: Record<string, SavedQuery[]>;
  /** Folders per server, including empty ones. */
  folders: Record<string, string[]>;
  addHistory: (serverId: string, entry: HistoryEntry) => void;
  clearHistory: (serverId: string) => void;
  saveQuery: (
    serverId: string,
    name: string,
    sql: string,
    folder?: string,
  ) => string;
  updateSaved: (
    serverId: string,
    id: string,
    patch: Partial<Omit<SavedQuery, "id">>,
  ) => void;
  deleteSaved: (serverId: string, id: string) => void;
  addFolder: (serverId: string, name: string) => void;
  renameFolder: (serverId: string, from: string, to: string) => void;
  /** Deletes the folder; its queries move to the top level. */
  deleteFolder: (serverId: string, name: string) => void;
}

const MAX_HISTORY = 200;

/** Query history and saved queries per server. Persisted. */
export const useQueryLibrary = create<QueryLibraryState>()(
  persist(
    (set) => ({
      history: {},
      saved: {},
      folders: {},
      addHistory: (serverId, entry) =>
        set((s) => {
          const list = s.history[serverId] ?? [];
          // Re-running the same SQL moves it to the top instead of duplicating it
          const rest = list.filter(
            (h) => h.sql !== entry.sql || h.database !== entry.database,
          );
          return {
            history: {
              ...s.history,
              [serverId]: [entry, ...rest].slice(0, MAX_HISTORY),
            },
          };
        }),
      clearHistory: (serverId) =>
        set((s) => ({ history: { ...s.history, [serverId]: [] } })),
      saveQuery: (serverId, name, sql, folder) => {
        const id = `${Date.now()}`;
        set((s) => ({
          saved: {
            ...s.saved,
            [serverId]: [
              { id, name, sql, folder: folder || undefined },
              ...(s.saved[serverId] ?? []),
            ],
          },
        }));
        return id;
      },
      updateSaved: (serverId, id, patch) =>
        set((s) => ({
          saved: {
            ...s.saved,
            [serverId]: (s.saved[serverId] ?? []).map((q) =>
              q.id === id ? { ...q, ...patch } : q,
            ),
          },
        })),
      addFolder: (serverId, name) =>
        set((s) => {
          const list = s.folders[serverId] ?? [];
          return list.includes(name)
            ? s
            : { folders: { ...s.folders, [serverId]: [...list, name] } };
        }),
      renameFolder: (serverId, from, to) =>
        set((s) => ({
          folders: {
            ...s.folders,
            [serverId]: (s.folders[serverId] ?? []).map((f) =>
              f === from ? to : f,
            ),
          },
          saved: {
            ...s.saved,
            [serverId]: (s.saved[serverId] ?? []).map((q) =>
              q.folder === from ? { ...q, folder: to } : q,
            ),
          },
        })),
      deleteFolder: (serverId, name) =>
        set((s) => ({
          folders: {
            ...s.folders,
            [serverId]: (s.folders[serverId] ?? []).filter((f) => f !== name),
          },
          saved: {
            ...s.saved,
            [serverId]: (s.saved[serverId] ?? []).map((q) =>
              q.folder === name ? { ...q, folder: undefined } : q,
            ),
          },
        })),
      deleteSaved: (serverId, id) =>
        set((s) => ({
          saved: {
            ...s.saved,
            [serverId]: (s.saved[serverId] ?? []).filter((q) => q.id !== id),
          },
        })),
    }),
    {
      name: "postcompass-queries",
      version: 2,
      // v1 had no folders; saved queries stay as they were
      migrate: (state) =>
        ({ folders: {}, ...(state as object) }) as QueryLibraryState,
    },
  ),
);
