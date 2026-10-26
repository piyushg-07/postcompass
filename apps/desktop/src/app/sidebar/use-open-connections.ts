import { useMemo } from "react";
import { useAppState } from "../app-state";
import { useNavigation } from "../navigation";

export interface OpenConnection {
  id: string;
  name: string;
  detail: string;
  /** Cloud provider, or null for a local server. */
  provider: string | null;
}

/** Connections kept in the sidebar, skipping any that were removed since. */
export function useOpenConnections(): OpenConnection[] {
  const { state } = useAppState();
  const openServerIds = useNavigation((s) => s.openServerIds);

  return useMemo(
    () =>
      openServerIds.flatMap<OpenConnection>((id) => {
        if (id.startsWith("remote:")) {
          const remote = state.remoteConnections.find(
            (r) => r.id === id.replace(/^remote:/, ""),
          );
          return remote
            ? [
                {
                  id,
                  name: remote.name,
                  detail: remote.database,
                  provider: remote.provider,
                },
              ]
            : [];
        }
        const server = state.servers.find((x) => x.id === id);
        return server
          ? [
              {
                id,
                name: server.name,
                detail: `localhost:${server.port}`,
                provider: null,
              },
            ]
          : [];
      }),
    [openServerIds, state.remoteConnections, state.servers],
  );
}
