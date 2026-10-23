import {
  Badge,
  Button,
  ConfirmDialog,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  IconButton,
  toast,
} from "@repo/ui";
import { useQueryClient } from "@tanstack/react-query";
import { Copy, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { useAppState } from "../../app/app-state";
import { useNavigation } from "../../app/navigation";
import type { RemoteConnection } from "../../lib/bindings";
import { commands, describeError, unwrap } from "../../lib/ipc";
import { queryKeys } from "../../lib/query";
import { useWorkspaceStore } from "../explorer/workspace-store";
import { PROVIDER_LOGOS, ProviderLogo } from "./provider-logos";

// ── SSL labels ────────────────────────────────────────────────────────────────

const SSL_LABELS: Record<string, string> = {
  disable: "Not encrypted",
  prefer: "Encrypted if supported",
  require: "Encrypted",
  verify_full: "Encrypted · certificate verified",
};

function remoteConnectionString(rc: RemoteConnection) {
  return `postgresql://${rc.user}:••••••••@${rc.host}:${rc.port}/${encodeURIComponent(rc.database)}`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function RemoteConnectionCard({ remote }: { remote: RemoteConnection }) {
  const { setState } = useAppState();
  const openServer = useNavigation((s) => s.openServer);
  const openRemoteDialog = useNavigation((s) => s.openRemoteDialog);
  const queryClient = useQueryClient();

  const [confirmRemove, setConfirmRemove] = useState(false);
  const [removing, setRemoving] = useState(false);

  const connectionId = `remote:${remote.id}`;
  const isOpen = !!useWorkspaceStore((s) => s.workspaces[connectionId]);

  const forgetConnection = () => {
    queryClient.removeQueries({ queryKey: queryKeys.connection(connectionId) });
    queryClient.removeQueries({ queryKey: queryKeys.explorer.all(connectionId) });
  };

  const copyConnectionString = () =>
    void navigator.clipboard
      .writeText(remoteConnectionString(remote))
      .then(() => toast.success("Connection string copied (password masked)"));

  const handleRemove = async () => {
    const newState = await unwrap(commands.removeRemoteConnection(remote.id));
    forgetConnection();
    setState(newState);
    toast.success(`${remote.name} removed`);
  };

  const meta = PROVIDER_LOGOS[remote.provider] ?? PROVIDER_LOGOS.other;

  return (
    <>
      <div className="group flex flex-col rounded-card border border-border bg-surface transition-colors hover:border-border-strong">
        {/* Card body */}
        <div className="flex flex-1 flex-col gap-3 p-4">
          {/* Top row: provider logo + menu */}
          <div className="flex items-start justify-between">
            <div className="flex size-9 items-center justify-center rounded-control border border-border bg-bg p-1.5">
              <ProviderLogo provider={remote.provider} className="size-full" />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <IconButton size="sm" label="More actions" icon={<MoreHorizontal />} />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem icon={<Pencil />} onSelect={() => openRemoteDialog(remote.id)}>Edit connection</DropdownMenuItem>
                <DropdownMenuItem icon={<Copy />} onSelect={copyConnectionString}>Copy connection string</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem icon={<Trash2 />} danger onSelect={() => setConfirmRemove(true)}>Remove connection…</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Name + host */}
          <div className="flex flex-col gap-0.5">
            <span className="truncate text-sm font-semibold text-fg">{remote.name}</span>
            <span className="truncate text-xs text-fg-muted font-mono">{remote.host}:{remote.port}</span>
          </div>

          {/* Provider badge + SSL */}
          <div className="flex items-center gap-2">
            <Badge>{meta.label}</Badge>
            <span className="text-xs text-fg-subtle">{SSL_LABELS[remote.sslMode] ?? remote.sslMode}</span>
            {isOpen && (
              <span className="ml-auto flex items-center gap-1 text-[10px] font-medium text-success">
                <span className="size-1.5 rounded-full bg-success" />
                Connected
              </span>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 border-t border-border px-4 py-2.5">
          <Button
            size="sm"
            variant="primary"
            className="flex-1"
            // The explorer opens the session (and shows any connection error)
            onClick={() => openServer(connectionId)}
          >
            Open
          </Button>
        </div>
      </div>

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
            .catch((e: unknown) => toast.error("Couldn't remove it", { description: describeError(e).message }))
            .finally(() => setRemoving(false));
        }}
      />
    </>
  );
}
