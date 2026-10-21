import { Button, EmptyState, StatusDot } from "@repo/ui";
import { useHotkey } from "@tanstack/react-hotkeys";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, Cloud, Unplug } from "lucide-react";
import { useAppState } from "../../app/app-state";
import { commands, describeError, unwrap } from "../../lib/ipc";
import { queryKeys } from "../../lib/query";
import { ConnectButton } from "./connect-dialog";
import { CreateTableSheet } from "./create-table-sheet";
import { DatabaseSwitcher } from "./database-switcher";
import { ExplorerProvider } from "./explorer-context";
import { ObjectTree } from "./object-tree";
import { Workspace } from "./workspace";
import { useWorkspaceStore } from "./workspace-store";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** True when `serverId` refers to a user-added remote connection (`remote:<id>`). */
function isRemoteId(serverId: string) {
  return serverId.startsWith("remote:");
}

/** Strip the `remote:` prefix to get the raw remote-connection id used in app-state. */
function rawRemoteId(serverId: string) {
  return serverId.replace(/^remote:/, "");
}

// ── Component ─────────────────────────────────────────────────────────────────

/** A connected server: object tree on the left, tabs (tables, queries, diagrams…) on the right. */
export function ExplorerPage({
  serverId,
  onClose,
}: {
  serverId: string;
  onClose: () => void;
}) {
  const { state } = useAppState();
  const queryClient = useQueryClient();

  const remote = isRemoteId(serverId)
    ? state.remoteConnections.find((r) => r.id === rawRemoteId(serverId)) ?? null
    : null;

  const server = isRemoteId(serverId)
    ? null
    : state.servers.find((s) => s.id === serverId) ?? null;

  // ── Connection query — opens the session if not already open ────────────────
  const connection = useQuery({
    queryKey: queryKeys.connection(serverId),
    queryFn: () =>
      isRemoteId(serverId)
        ? unwrap(commands.openRemoteConnection(rawRemoteId(serverId)))
        : unwrap(commands.openServer(serverId)),
    staleTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const database =
    useWorkspaceStore((s) => s.workspaces[serverId]?.database) ??
    connection.data?.database ??
    "postgres";
  const schema = useWorkspaceStore((s) => s.workspaces[serverId]?.schema);

  useHotkey(
    "Mod+T",
    () => useWorkspaceStore.getState().newQuery(serverId, database),
    { enabled: connection.isSuccess },
  );
  useHotkey("Mod+W", () => {
    const ws = useWorkspaceStore.getState().workspaces[serverId];
    if (ws?.activeTabId)
      useWorkspaceStore.getState().closeTab(serverId, ws.activeTabId);
  });

  const disconnect = async () => {
    const id = connection.data?.connectionId;
    if (id) {
      await commands.closeConnection(id);
      queryClient.removeQueries({ queryKey: queryKeys.explorer.all(id) });
    }
    queryClient.removeQueries({ queryKey: queryKeys.connection(serverId) });
    onClose();
  };

  // ── Guard: server / remote must exist in state ──────────────────────────────
  if (!server && !remote) {
    return (
      <EmptyState
        title="Database not found"
        description="It may have been removed."
      />
    );
  }

  // ── Display label & subtitle ───────────────────────────────────────────────
  const displayName = server?.name ?? remote?.name ?? "Remote database";
  const displaySubtitle = connection.data
    ? server
      ? `PostgreSQL ${connection.data.serverVersion} · ${server.host}:${server.port}`
      : remote
      ? `PostgreSQL ${connection.data.serverVersion} · ${remote.host}:${remote.port}`
      : undefined
    : undefined;

  const error = connection.isError ? describeError(connection.error) : null;

  const header = (
    <header className="flex h-11 shrink-0 items-center justify-between gap-4 border-b border-border px-3">
      <nav aria-label="Location" className="flex min-w-0 items-center gap-1 text-sm">
        <span
          className="flex shrink-0 items-center gap-2 px-1 text-fg-muted"
          title={displaySubtitle}
        >
          {remote ? (
            <Cloud className="size-3.5 text-accent" />
          ) : (
            <StatusDot status={connection.data ? "running" : "starting"} />
          )}
          <span className="max-w-48 truncate">{displayName}</span>
        </span>
        {connection.data && (
          <>
            <ChevronRight className="size-3.5 shrink-0 text-fg-subtle" />
            <DatabaseSwitcher defaultDatabase={connection.data.database} />
            {schema && (
              <>
                <ChevronRight className="size-3.5 shrink-0 text-fg-subtle" />
                <span className="truncate px-1 font-mono text-fg-muted">{schema}</span>
              </>
            )}
          </>
        )}
        {connection.isPending && <span className="px-2 text-xs text-fg-subtle">Connecting…</span>}
      </nav>
      <div className="flex shrink-0 items-center gap-2">
        {connection.data && server && <ConnectButton server={server} database={database} />}
        <Button size="sm" variant="ghost" iconLeft={<Unplug />} onClick={() => void disconnect()}>
          Disconnect
        </Button>
      </div>
    </header>
  );

  if (connection.data)
    return (
      <ExplorerProvider value={{ serverId, connectionId: connection.data.connectionId }}>
        <div className="flex h-full flex-col overflow-clip">
          {header}
          <div className="flex min-h-0 flex-1 overflow-clip">
            <ObjectTree defaultDatabase={connection.data.database} />
            <div className="min-w-0 flex-1">
              <Workspace />
            </div>
          </div>
        </div>
        <CreateTableSheet />
      </ExplorerProvider>
    );

  return (
    <div className="flex h-full flex-col">
      {header}
      {error && (
        <div className="flex flex-1 items-center justify-center">
          <EmptyState
            icon={<Unplug />}
            title="Couldn't open this database"
            description={error.hint ? `${error.message}. ${error.hint}` : error.message}
            actions={
              <>
                <Button onClick={onClose}>Back</Button>
                <Button variant="primary" loading={connection.isFetching} onClick={() => void connection.refetch()}>
                  Try again
                </Button>
              </>
            }
          />
        </div>
      )}
    </div>
  );
}
