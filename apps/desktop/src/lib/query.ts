import { QueryClient } from "@tanstack/react-query";
import type { DatabaseKind } from "./bindings";
import { IpcError } from "./ipc";

/** Errors where retrying cannot help, so we fail fast and show the message. */
const NO_RETRY = new Set(["auth_failed", "not_found", "invalid_input", "unsupported", "secrets"]);

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Local IPC is cheap, but avoid refetch storms when switching screens
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: (failureCount, error) =>
        !(error instanceof IpcError && NO_RETRY.has(error.code)) && failureCount < 1,
      refetchOnWindowFocus: true,
    },
    mutations: { retry: false },
  },
});

/**
 * Every query key in one place, so invalidation is predictable:
 * `queryClient.invalidateQueries({ queryKey: queryKeys.explorer.all(connectionId) })`.
 */
export const queryKeys = {
  appState: ["app-state"] as const,
  appInfo: ["app-info"] as const,
  serverStatuses: ["servers", "statuses"] as const,
  detection: (kind: DatabaseKind) => ["detection", kind] as const,
  runtimeVersions: (kind: DatabaseKind) => ["runtime-versions", kind] as const,
  suggestedPort: (kind: DatabaseKind) => ["suggested-port", kind] as const,
  connection: (serverId: string) => ["connection", serverId] as const,
  explorer: {
    all: (connectionId: string) => ["explorer", connectionId] as const,
    databases: (connectionId: string) => ["explorer", connectionId, "databases"] as const,
    /** Everything inside one database; invalidate after schema changes. */
    database: (connectionId: string, database: string) => ["explorer", connectionId, "db", database] as const,
    schemas: (connectionId: string, database: string) => ["explorer", connectionId, "db", database, "schemas"] as const,
    tables: (connectionId: string, database: string, schema: string) =>
      ["explorer", connectionId, "db", database, "tables", schema] as const,
    objects: (connectionId: string, database: string, schema: string) =>
      ["explorer", connectionId, "db", database, "objects", schema] as const,
    graph: (connectionId: string, database: string, schema: string) =>
      ["explorer", connectionId, "db", database, "graph", schema] as const,
    extensions: (connectionId: string, database: string) =>
      ["explorer", connectionId, "db", database, "extensions"] as const,
    /** Everything about one table. */
    table: (connectionId: string, database: string, schema: string, table: string) =>
      ["explorer", connectionId, "db", database, "table", schema, table] as const,
    structure: (connectionId: string, database: string, schema: string, table: string) =>
      ["explorer", connectionId, "db", database, "table", schema, table, "structure"] as const,
    rows: (connectionId: string, database: string, schema: string, table: string, request: unknown) =>
      ["explorer", connectionId, "db", database, "table", schema, table, "rows", request] as const,
    definition: (connectionId: string, database: string, schema: string, kind: string, name: string) =>
      ["explorer", connectionId, "db", database, "definition", schema, kind, name] as const,
  },
};
