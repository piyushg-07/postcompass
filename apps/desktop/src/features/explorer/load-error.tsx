import { Button, cn } from "@repo/ui";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { describeError } from "../../lib/ipc";

/** A query that can be run again. */
interface Retryable {
  error: unknown;
  isFetching: boolean;
  refetch: () => unknown;
}

/** What a page shows when its data didn't load: the reason and a Retry button. */
export function LoadError({
  query,
  compact = false,
}: {
  query: Retryable;
  /** A single line, for narrow places like the sidebar. */
  compact?: boolean;
}) {
  const retry = (
    <Button
      size="sm"
      variant="secondary"
      iconLeft={
        <RefreshCw className={cn(query.isFetching && "animate-spin")} />
      }
      disabled={query.isFetching}
      onClick={() => void query.refetch()}
    >
      {query.isFetching ? "Retrying…" : "Retry"}
    </Button>
  );
  const message = describeError(query.error).message;

  if (compact)
    return (
      <div className="flex flex-col items-start gap-2 p-3 text-xs">
        <p className="text-danger">{message}</p>
        {retry}
      </div>
    );
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      <span className="flex size-11 items-center justify-center rounded-card border border-danger/30 bg-danger/5 text-danger">
        <AlertTriangle className="size-5" />
      </span>
      <div className="flex max-w-md flex-col gap-1">
        <h3 className="text-sm font-semibold text-fg">Couldn't load this</h3>
        <p className="text-sm break-words text-fg-muted">{message}</p>
      </div>
      {retry}
    </div>
  );
}
