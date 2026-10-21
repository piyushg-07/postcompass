/**
 * Card for a saved remote connection on the Databases page.
 *
 * Shows provider badge, host:port, SSL mode, and lets the user:
 *   • Open the connection in the explorer
 *   • Edit the connection details
 *   • Copy the connection string
 *   • Delete the connection
 */

import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  IconButton,
  toast,
} from "@repo/ui";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Cloud,
  Copy,
  ExternalLink,
  MoreHorizontal,
  Pencil,
  Trash2,
  Unplug,
} from "lucide-react";
import { useState } from "react";
import { useAppState } from "../../app/app-state";
import { useNavigation } from "../../app/navigation";
import type { RemoteConnection } from "../../lib/bindings";
import { commands, describeError, unwrap } from "../../lib/ipc";
import { queryKeys } from "../../lib/query";
import { useWorkspaceStore } from "../explorer/workspace-store";

// ── Provider display ──────────────────────────────────────────────────────────

const PROVIDER_LABELS: Record<string, string> = {
  aws:        "AWS RDS",
  gcp:        "Cloud SQL",
  azure:      "Azure",
  cloudflare: "Hyperdrive",
  supabase:   "Supabase",
  neon:       "Neon",
  railway:    "Railway",
  render:     "Render",
  other:      "PostgreSQL",
};

const SSL_LABELS: Record<string, string> = {
  disable:     "No TLS",
  prefer:      "TLS preferred",
  require:     "TLS required",
  verify_full: "TLS verified",
};

function providerLabel(id: string) {
  return PROVIDER_LABELS[id] ?? id;
}

// ── Connection string ─────────────────────────────────────────────────────────

function remoteConnectionString(rc: RemoteConnection, password: string | null) {
  const secret = password === null ? "••••••••" : encodeURIComponent(password);
  return `postgresql://${rc.user}:${secret}@${rc.host}:${rc.port}/${encodeURIComponent(rc.database)}`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function RemoteConnectionCard({ remote }: { remote: RemoteConnection }) {
  const { setState } = useAppState();
  const openServer = useNavigation((s) => s.openServer);
  const openRemoteDialog = useNavigation((s) => s.openRemoteDialog);
  const queryClient = useQueryClient();

  const [confirmRemove, setConfirmRemove] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [busy, setBusy] = useState(false);

  // Session id mirrors what the Rust side generates with `remote_connection_id(id)`
  const connectionId = `remote:${remote.id}`;

  // Check if there's an open session for this remote connection
  const connectionQuery = useQuery({
    queryKey: queryKeys.remoteConnection(remote.id),
    queryFn: async () => {
      // We don't have a direct "is open?" command; track via open action.
      return null as null;
    },
    staleTime: Infinity,
    enabled: false,
  });
  const isOpen = !!useWorkspaceStore(
    (s) => s.workspaces[connectionId],
  );

  const forgetConnection = () => {
    queryClient.removeQueries({ queryKey: queryKeys.remoteConnection(remote.id) });
    queryClient.removeQueries({ queryKey: queryKeys.explorer.all(connectionId) });
  };

  const handleOpen = async () => {
    setBusy(true);
    try {
      await unwrap(commands.openRemoteConnection(remote.id));
      openServer(connectionId);
    } catch (e) {
      const { title, message, hint } = describeError(e);
      toast.error(title, { description: hint ? `${message}\n${hint}` : message });
    } finally {
      setBusy(false);
    }
  };

  const copyConnectionString = () => {
    void navigator.clipboard
      .writeText(remoteConnectionString(remote, null))
      .then(() => toast.success("Connection string copied (password masked)"));
  };

  const handleRemove = async () => {
    const newState = await unwrap(commands.removeRemoteConnection(remote.id));
    forgetConnection();
    setState(newState);
    toast.success(`${remote.name} removed`);
  };

  return (
    <>
      <Card className="group flex flex-col transition-colors hover:border-border-strong">
        <div className="flex items-start gap-3 p-4">
          {/* Icon */}
          <div className="flex size-9 shrink-0 items-center justify-center rounded-control border border-border bg-bg text-fg-muted">
            <Cloud className="size-4" />
          </div>

          {/* Name + badges */}
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="truncate text-sm font-semibold text-fg">{remote.name}</span>
              <Badge>{providerLabel(remote.provider)}</Badge>
              <Badge variant="outline">{SSL_LABELS[remote.sslMode] ?? remote.sslMode}</Badge>
            </div>
            <span className="flex items-center gap-1.5 text-xs text-fg-muted">
              <span className="font-mono">{remote.host}:{remote.port}</span>
              <span className="text-fg-subtle">·</span>
              <span>{remote.user}@{remote.database}</span>
            </span>
          </div>

          {/* Actions */}
          <div className="flex shrink-0 items-center gap-1.5">
            <Button
              size="sm"
              variant="primary"
              iconLeft={<ExternalLink />}
              loading={busy}
              onClick={() => void handleOpen()}
            >
              Open
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <IconButton size="sm" label="More actions" icon={<MoreHorizontal />} />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem icon={<Pencil />} onSelect={() => openRemoteDialog(remote.id)}>
                  Edit connection
                </DropdownMenuItem>
                <DropdownMenuItem icon={<Copy />} onSelect={copyConnectionString}>
                  Copy connection string
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  icon={<Trash2 />}
                  danger
                  onSelect={() => setConfirmRemove(true)}
                >
                  Remove connection…
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Connection string footer */}
        <div className="flex items-center gap-2 border-t border-border px-4 py-2.5">
          <span className="min-w-0 flex-1 truncate font-mono text-xs text-fg-muted">
            {remoteConnectionString(remote, null)}
          </span>
          <IconButton
            size="sm"
            label="Copy connection string"
            icon={<Copy />}
            onClick={copyConnectionString}
          />
        </div>
      </Card>

      <ConfirmDialog
        open={confirmRemove}
        onOpenChange={setConfirmRemove}
        title={`Remove "${remote.name}"?`}
        description="This removes the saved connection and its password from the OS keychain. Your remote database is not affected."
        confirmLabel="Remove connection"
        destructive
        loading={removing}
        onConfirm={() => {
          setRemoving(true);
          handleRemove()
            .then(() => setConfirmRemove(false))
            .catch((e: unknown) =>
              toast.error("Couldn't remove it", { description: describeError(e).message }),
            )
            .finally(() => setRemoving(false));
        }}
      />
    </>
  );
}
