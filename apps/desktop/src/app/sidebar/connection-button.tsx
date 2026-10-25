import { cn, Tooltip } from "@repo/ui";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import {
  LocalServerLogo,
  ProviderLogo,
} from "../../features/servers/provider-logos";
import type { OpenedConnection } from "../../lib/bindings";
import { queryKeys } from "../../lib/query";

/**
 * One open connection in the sidebar: its logo (the PostgreSQL elephant, or the cloud provider's),
 * a dot while connected, and × on hover to disconnect.
 */
export function ConnectionButton({
  id,
  name,
  detail,
  provider,
  active,
  collapsed,
  onOpen,
  onClose,
}: {
  id: string;
  name: string;
  detail: string;
  /** Cloud provider, or null for a local server. */
  provider: string | null;
  active: boolean;
  collapsed: boolean;
  onOpen: () => void;
  onClose: () => void;
}) {
  // Reads the explorer's cached session without opening one
  const connection = useQuery<OpenedConnection>({
    queryKey: queryKeys.connection(id),
    enabled: false,
  });
  const connected = connection.data !== undefined;
  const logo =
    provider === null ? (
      <LocalServerLogo status={connected ? "running" : undefined} />
    ) : (
      <span className="relative inline-flex shrink-0">
        <ProviderLogo provider={provider} className="size-4" />
        {connected && (
          <span className="absolute -right-0.5 -bottom-0.5 size-1.5 rounded-full bg-accent ring-2 ring-surface" />
        )}
      </span>
    );

  const button = (
    <div
      className={cn(
        "group/conn relative flex h-8 w-full items-center rounded-control text-sm transition-colors",
        active
          ? "bg-surface-hover text-fg"
          : "text-fg-muted hover:bg-surface-hover/60 hover:text-fg",
      )}
    >
      {active && (
        <span className="absolute top-1.5 bottom-1.5 left-0 w-0.5 rounded-full bg-accent" />
      )}
      <button
        type="button"
        onClick={onOpen}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex h-full min-w-0 flex-1 cursor-pointer items-center gap-2.5",
          collapsed ? "justify-center" : "pl-2.5",
        )}
      >
        {logo}
        {collapsed ? (
          <span className="sr-only">{name}</span>
        ) : (
          <span className="flex min-w-0 flex-1 flex-col text-left leading-tight">
            <span className="truncate whitespace-nowrap">{name}</span>
          </span>
        )}
      </button>
      <button
        type="button"
        aria-label={`Disconnect ${name}`}
        onClick={onClose}
        className={cn(
          "flex size-5 shrink-0 cursor-pointer items-center justify-center rounded text-fg-subtle opacity-0 group-hover/conn:opacity-100 hover:bg-surface-raised hover:text-fg focus-visible:opacity-100",
          collapsed
            ? "absolute -top-1 -right-1 size-4 rounded-full border border-border-strong bg-surface-raised"
            : "mr-1.5",
        )}
      >
        <X className="size-3" />
      </button>
    </div>
  );
  return (
    <Tooltip
      side="right"
      content={
        <span className="flex flex-col">
          <span>{name}</span>
          <span className="font-mono text-[11px] text-fg-muted">{detail}</span>
        </span>
      }
    >
      {button}
    </Tooltip>
  );
}
