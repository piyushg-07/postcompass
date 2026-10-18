import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, type ReactNode, useContext } from "react";
import type { ExecuteResult, ObjectKind, SqlError } from "../../lib/bindings";
import { commands, unwrap } from "../../lib/ipc";
import { queryKeys } from "../../lib/query";

interface ExplorerValue {
  serverId: string;
  connectionId: string;
}

const ExplorerContext = createContext<ExplorerValue | null>(null);

export function ExplorerProvider({ value, children }: { value: ExplorerValue; children: ReactNode }) {
  return <ExplorerContext.Provider value={value}>{children}</ExplorerContext.Provider>;
}

export function useExplorer() {
  const value = useContext(ExplorerContext);
  if (!value) throw new Error("useExplorer must be used inside ExplorerProvider");
  return value;
}

/* ── Queries ──────────────────────────────────────────────────────────── */

export function useDatabases() {
  const { connectionId } = useExplorer();
  return useQuery({
    queryKey: queryKeys.explorer.databases(connectionId),
    queryFn: () => unwrap(commands.listDatabases(connectionId)),
  });
}

export function useSchemas(database: string | null) {
  const { connectionId } = useExplorer();
  return useQuery({
    queryKey: queryKeys.explorer.schemas(connectionId, database ?? ""),
    queryFn: () => unwrap(commands.listSchemas(connectionId, database!)),
    enabled: database !== null,
  });
}

export function useTables(database: string | null, schema: string | null) {
  const { connectionId } = useExplorer();
  return useQuery({
    queryKey: queryKeys.explorer.tables(connectionId, database ?? "", schema ?? ""),
    queryFn: () => unwrap(commands.listTables(connectionId, database!, schema!)),
    enabled: database !== null && schema !== null,
  });
}

export function useSchemaObjects(database: string | null, schema: string | null) {
  const { connectionId } = useExplorer();
  return useQuery({
    queryKey: queryKeys.explorer.objects(connectionId, database ?? "", schema ?? ""),
    queryFn: () => unwrap(commands.schemaObjects(connectionId, database!, schema!)),
    enabled: database !== null && schema !== null,
  });
}

export function useStructure(database: string, schema: string, table: string) {
  const { connectionId } = useExplorer();
  return useQuery({
    queryKey: queryKeys.explorer.structure(connectionId, database, schema, table),
    queryFn: () => unwrap(commands.tableStructure(connectionId, database, schema, table)),
  });
}

export function useDefinition(database: string, schema: string, kind: ObjectKind, name: string) {
  const { connectionId } = useExplorer();
  return useQuery({
    queryKey: queryKeys.explorer.definition(connectionId, database, schema, kind, name),
    queryFn: () => unwrap(commands.objectDefinition(connectionId, database, schema, kind, name)),
  });
}

/** Tables, columns and relations of a schema. Also feeds SQL autocomplete. */
export function useSchemaGraph(database: string | null, schema: string | null) {
  const { connectionId } = useExplorer();
  return useQuery({
    queryKey: queryKeys.explorer.graph(connectionId, database ?? "", schema ?? ""),
    queryFn: () => unwrap(commands.schemaGraph(connectionId, database!, schema!)),
    enabled: database !== null && schema !== null,
    staleTime: 60_000,
  });
}

export function useExtensions(database: string) {
  const { connectionId } = useExplorer();
  return useQuery({
    queryKey: queryKeys.explorer.extensions(connectionId, database),
    queryFn: () => unwrap(commands.listExtensions(connectionId, database)),
  });
}

/* ── Running schema changes ───────────────────────────────────────────── */

/** Thrown when SQL the app generated is rejected by the server. */
export class SqlRunError extends Error {
  readonly sqlError: SqlError;
  constructor(sqlError: SqlError) {
    super([sqlError.message, sqlError.detail, sqlError.hint].filter(Boolean).join(" · "));
    this.name = "SqlRunError";
    this.sqlError = sqlError;
  }
}

export function newRunId() {
  return crypto.randomUUID();
}

/**
 * Runs SQL the app generated (schema changes, database management) and refreshes what it affects.
 * By default everything cached for `database` is refreshed; schema changes are rare and cheap to reload.
 */
export function useRunSql() {
  const { connectionId } = useExplorer();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ sql, database }: { sql: string; database: string; refreshAll?: boolean }) => {
      const result: ExecuteResult = await unwrap(commands.executeSql(connectionId, database, sql, newRunId()));
      if (result.error) throw new SqlRunError(result.error);
      return result;
    },
    onSuccess: (_result, { database, refreshAll }) =>
      queryClient.invalidateQueries({
        queryKey: refreshAll ? queryKeys.explorer.all(connectionId) : queryKeys.explorer.database(connectionId, database),
      }),
  });
}
