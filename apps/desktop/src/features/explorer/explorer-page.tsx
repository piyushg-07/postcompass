import { Button, EmptyState, StatusDot } from "@repo/ui";
import { useHotkey } from "@tanstack/react-hotkeys";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Unplug } from "lucide-react";
import { useAppState } from "../../app/app-state";
import { commands, describeError, unwrap } from "../../lib/ipc";
import { queryKeys } from "../../lib/query";
import { ExplorerProvider } from "./explorer-context";
import { ObjectTree } from "./object-tree";
import { Workspace } from "./workspace";
import { useWorkspaceStore } from "./workspace-store";

/** A connected server: object tree on the left, tabs (tables, queries, diagrams…) on the right. */
export function ExplorerPage({ serverId, onClose }: { serverId: string; onClose: () => void }) {
  const { state } = useAppState();
  const queryClient = useQueryClient();
  const server = state.servers.find((s) => s.id === serverId);

  // The session lives in Rust; this query opens it once and remembers the result
  const connection = useQuery({
    queryKey: queryKeys.connection(serverId),
    queryFn: () => unwrap(commands.openServer(serverId)),
    staleTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const database = useWorkspaceStore((s) => s.workspaces[serverId]?.database) ?? connection.data?.database ?? "postgres";

  useHotkey("Mod+T", () => useWorkspaceStore.getState().newQuery(serverId, database), {
    enabled: connection.isSuccess,
  });
  useHotkey("Mod+W", () => {
    const ws = useWorkspaceStore.getState().workspaces[serverId];
    if (ws?.activeTabId) useWorkspaceStore.getState().closeTab(serverId, ws.activeTabId);
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

  if (!server) return <EmptyState title="Server not found" description="It may have been removed." />;

  const error = connection.isError ? describeError(connection.error) : null;

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-11 shrink-0 items-center justify-between gap-4 border-b border-border px-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="truncate text-sm font-semibold">{server.name}</span>
          {connection.data && (
            <span className="flex items-center gap-2 text-xs text-fg-muted">
              <StatusDot status="running" />
              PostgreSQL {connection.data.serverVersion} · {server.host}:{server.port}
            </span>
          )}
          {connection.isPending && <span className="text-xs text-fg-subtle">Connecting…</span>}
        </div>
        <Button size="sm" iconLeft={<Unplug />} onClick={() => void disconnect()}>
          Disconnect
        </Button>
      </header>

      {error ? (
        <div className="flex flex-1 items-center justify-center">
          <EmptyState
            icon={<Unplug />}
            title="Couldn't open this server"
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
      ) : connection.data ? (
        <ExplorerProvider value={{ serverId, connectionId: connection.data.connectionId }}>
          <div className="flex min-h-0 flex-1">
            <ObjectTree defaultDatabase={connection.data.database} />
            <div className="min-w-0 flex-1">
              <Workspace />
            </div>
          </div>
        </ExplorerProvider>
      ) : null}
    </div>
  );
}
