import { Button, Skeleton } from "@repo/ui";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Database, Plus } from "lucide-react";
import { useState } from "react";
import { useNavigation } from "../../app/navigation";
import type { ManagedServer } from "../../lib/bindings";
import { formatBytes } from "../../lib/format";
import { commands, describeError, unwrap } from "../../lib/ipc";
import { queryKeys } from "../../lib/query";
import { NewDatabaseDialog } from "../explorer/database-switcher";
import { ExplorerProvider, useDatabases } from "../explorer/explorer-context";
import { useWorkspaceStore } from "../explorer/workspace-store";

/**
 * The databases inside a running server, each opening straight into the table editor,
 * like projects in Supabase. Shares its session with the explorer.
 */
export function DatabaseList({ server }: { server: ManagedServer }) {
  const connection = useQuery({
    queryKey: queryKeys.connection(server.id),
    queryFn: () => unwrap(commands.openServer(server.id)),
    staleTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
  });

  if (connection.isError)
    return <p className="px-4 py-3 text-xs text-danger">{describeError(connection.error).message}</p>;
  if (!connection.data) return <ListSkeleton />;
  return (
    <ExplorerProvider value={{ serverId: server.id, connectionId: connection.data.connectionId }}>
      <Databases server={server} defaultDatabase={connection.data.database} />
    </ExplorerProvider>
  );
}

function Databases({ server, defaultDatabase }: { server: ManagedServer; defaultDatabase: string }) {
  const databases = useDatabases();
  const openServer = useNavigation((s) => s.openServer);
  const [creating, setCreating] = useState(false);

  const open = (database: string) => {
    useWorkspaceStore.getState().setLocation(server.id, { database, schema: null });
    openServer(server.id);
  };

  if (!databases.data) return <ListSkeleton />;
  // Templates exist only to be copied by CREATE DATABASE
  const list = databases.data.filter((d) => d.allowConnections && !d.name.startsWith("template"));

  return (
    <div className="flex flex-col">
      <ul className="flex flex-col">
        {list.map((d) => (
          <li key={d.name}>
            <button
              type="button"
              onClick={() => open(d.name)}
              className="group/db flex h-9 w-full cursor-pointer items-center gap-3 px-4 text-left hover:bg-surface-hover"
            >
              <Database className="size-3.5 shrink-0 text-fg-subtle group-hover/db:text-accent" />
              <span className="min-w-0 flex-1 truncate font-mono text-xs text-fg">{d.name}</span>
              {d.sizeBytes !== null && (
                <span className="shrink-0 font-mono text-[11px] text-fg-subtle">{formatBytes(d.sizeBytes)}</span>
              )}
              <ArrowRight className="size-3.5 shrink-0 text-fg-subtle opacity-0 group-hover/db:opacity-100" />
            </button>
          </li>
        ))}
      </ul>
      <div className="px-2 py-1.5">
        <Button size="sm" variant="ghost" iconLeft={<Plus />} onClick={() => setCreating(true)}>
          New database
        </Button>
      </div>
      <NewDatabaseDialog open={creating} onOpenChange={setCreating} database={defaultDatabase} onCreated={open} />
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="flex flex-col gap-1.5 px-4 py-3">
      <Skeleton className="h-6" />
      <Skeleton className="h-6" />
    </div>
  );
}
