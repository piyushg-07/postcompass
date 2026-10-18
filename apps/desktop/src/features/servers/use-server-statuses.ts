import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ServerStatus } from "../../lib/bindings";
import { commands, unwrap } from "../../lib/ipc";
import { queryKeys } from "../../lib/query";

const POLL_MS = 5000;

/**
 * Live status of every managed server. One shared query, so Home and Servers never poll twice;
 * polling pauses while the window is hidden.
 */
export function useServerStatuses(serverIds: string[]) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: queryKeys.serverStatuses,
    queryFn: async () => {
      const entries = await unwrap(commands.serverStatuses());
      return Object.fromEntries(entries.map((e) => [e.id, e.status])) as Record<string, ServerStatus>;
    },
    enabled: serverIds.length > 0,
    refetchInterval: POLL_MS,
    staleTime: 0,
  });

  /** Apply a status a command just returned, without waiting for the next poll. */
  const setStatus = (id: string, status: ServerStatus) =>
    queryClient.setQueryData<Record<string, ServerStatus>>(queryKeys.serverStatuses, (prev) => ({
      ...prev,
      [id]: status,
    }));

  return { statuses: query.data ?? {}, setStatus };
}
