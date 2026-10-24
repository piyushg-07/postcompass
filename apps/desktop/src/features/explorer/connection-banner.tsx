import { Button } from "@repo/ui";
import { useQueryClient } from "@tanstack/react-query";
import { RefreshCw, WifiOff } from "lucide-react";
import { useEffect, useState } from "react";
import { IpcError } from "../../lib/ipc";
import { queryKeys } from "../../lib/query";

/**
 * A strip under the header when the server stops answering (restart, network drop, sleep), with a
 * Reconnect button. The session reconnects by itself on the next request, so Reconnect just
 * reloads what's on screen. Goes away as soon as anything loads again.
 */
export function ConnectionBanner({
  connectionId,
  name,
}: {
  connectionId: string;
  name: string;
}) {
  const queryClient = useQueryClient();
  const [lost, setLost] = useState(false);
  const [retrying, setRetrying] = useState(false);

  useEffect(
    () =>
      queryClient.getQueryCache().subscribe((event) => {
        if (event.type !== "updated") return;
        const [scope, id] = event.query.queryKey;
        if (scope !== "explorer" || id !== connectionId) return;
        const { status, error } = event.query.state;
        if (
          status === "error" &&
          error instanceof IpcError &&
          error.code === "connection_failed"
        )
          setLost(true);
        else if (status === "success" && event.action.type === "success")
          setLost(false);
      }),
    [queryClient, connectionId],
  );

  if (!lost) return null;

  const reconnect = async () => {
    setRetrying(true);
    await queryClient.refetchQueries({
      queryKey: queryKeys.explorer.all(connectionId),
      type: "active",
    });
    setRetrying(false);
  };

  return (
    <div className="flex shrink-0 items-center gap-3 border-b border-warning/30 bg-warning/10 px-3 py-1.5 text-xs">
      <WifiOff className="size-3.5 shrink-0 text-warning" />
      <span className="text-fg">
        Lost connection to <span className="font-medium">{name}</span>.
        <span className="text-fg-muted"> The server isn't responding.</span>
      </span>
      <Button
        size="sm"
        variant="secondary"
        className="ml-auto"
        iconLeft={
          <RefreshCw className={retrying ? "animate-spin" : undefined} />
        }
        disabled={retrying}
        onClick={() => void reconnect()}
      >
        {retrying ? "Reconnecting…" : "Reconnect"}
      </Button>
    </div>
  );
}
