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
    schemas: (connectionId: string, database: string) => ["explorer", connectionId, "schemas", database] as const,
    tables: (connectionId: string, database: string, schema: string) =>
      ["explorer", connectionId, "tables", database, schema] as const,
  },
};
