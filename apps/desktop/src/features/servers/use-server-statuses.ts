import { useCallback, useEffect, useState } from "react";
import type { ServerStatus } from "../../lib/bindings";
import { commands, unwrap } from "../../lib/ipc";

const POLL_MS = 5000;

/** Live status of every managed server, refreshed every few seconds while the window is visible. */
export function useServerStatuses(serverIds: string[]) {
  const [statuses, setStatuses] = useState<Record<string, ServerStatus>>({});
  const key = serverIds.join(",");

  const refresh = useCallback(async () => {
    if (!key) return;
    try {
      const entries = await unwrap(commands.serverStatuses());
      setStatuses(Object.fromEntries(entries.map((e) => [e.id, e.status])));
    } catch {
      // Keep the last known statuses; the next poll retries
    }
  }, [key]);

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  const setStatus = (id: string, status: ServerStatus) => setStatuses((s) => ({ ...s, [id]: status }));

  return { statuses, refresh, setStatus };
}
