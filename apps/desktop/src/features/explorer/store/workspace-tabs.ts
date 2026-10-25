import type { FilterSpec, ObjectKind, TableKind } from "../../../lib/bindings";

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

export interface ServerWorkspace {
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

export const EMPTY_WORKSPACE: ServerWorkspace = {
  database: null,
  schema: null,
  tabs: [],
  activeTabId: null,
  queryCount: 0,
};

export function rememberTable(
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
export function nextQueryNumber(tabs: Tab[]) {
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

/**
 * The id a tab gets. Parts are JSON-encoded so names containing dots can't collide
 * (schema `a.b` + table `c` vs schema `a` + table `b.c`).
 */
export function tabId(tab: NewTab, queryCount: number) {
  const key = (...parts: string[]) => JSON.stringify(parts);
  switch (tab.type) {
    case "table":
      return `table:${key(tab.database, tab.schema, tab.name)}`;
    case "definition":
      return `def:${key(tab.database, tab.schema, tab.kind, tab.name)}`;
    case "diagram":
      return `diagram:${key(tab.database, tab.schema)}`;
    case "extensions":
      return `extensions:${key(tab.database)}`;
    case "policies":
      return `policies:${key(tab.database, tab.schema)}`;
    case "objects":
      return `objects:${key(tab.database, tab.schema, tab.group)}`;
    case "query":
      return `query:${queryCount}:${Date.now()}`;
  }
}

/**
 * v3 store migration: re-derives ids made by the old dotted format, merging tabs that now turn
 * out to be the same object. Query tab ids aren't derived from names, so they're kept.
 */
export function rekeyTabs(ws: ServerWorkspace) {
  const renamed = new Map<string, string>();
  const tabs: Tab[] = [];
  for (const t of ws.tabs) {
    const id = t.type === "query" ? t.id : tabId(t as NewTab, 0);
    renamed.set(t.id, id);
    if (!tabs.some((x) => x.id === id)) tabs.push({ ...t, id } as Tab);
  }
  ws.tabs = tabs;
  ws.activeTabId =
    (ws.activeTabId && renamed.get(ws.activeTabId)) ??
    tabs.at(-1)?.id ??
    null;
}
