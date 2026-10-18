import { Badge, Button, Card, ConfirmDialog, IconButton, type Status, StatusBadge, toast } from "@repo/ui";
import { Copy, Eye, EyeOff, FolderOpen, Play, Square, Trash2 } from "lucide-react";
import { useState } from "react";
import { useAppState } from "../../app/app-state";
import type { ManagedServer, ServerStatus } from "../../lib/bindings";
import { connectionString } from "../../lib/format";
import { commands, describeError, unwrap } from "../../lib/ipc";

export function ServerCard({
  server,
  status,
  onStatus,
  onOpen,
  compact = false,
}: {
  server: ManagedServer;
  status: ServerStatus | undefined;
  onStatus: (status: ServerStatus) => void;
  /** Opens the server in the explorer. */
  onOpen: (serverId: string) => void;
  compact?: boolean;
}) {
  const { refresh } = useAppState();
  const [busy, setBusy] = useState<"start" | "stop" | null>(null);
  const [password, setPassword] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [removing, setRemoving] = useState(false);

  const displayStatus: Status = busy === "start" ? "starting" : (status ?? "stopped");
  const running = status === "running";

  const toggle = async () => {
    const action = running ? "stop" : "start";
    setBusy(action);
    try {
      const next = await unwrap(action === "start" ? commands.startServer(server.id) : commands.stopServer(server.id));
      onStatus(next);
      toast.success(action === "start" ? `${server.name} started` : `${server.name} stopped`);
    } catch (e) {
      const { title, message, hint } = describeError(e);
      toast.error(title, { description: hint ? `${message}\n${hint}` : message });
    } finally {
      setBusy(null);
    }
  };

  const withPassword = async (use: (password: string) => void) => {
    try {
      use(password ?? (await unwrap(commands.serverPassword(server.id))));
    } catch (e) {
      toast.error("Couldn't read the password", { description: describeError(e).message });
    }
  };

  const remove = async () => {
    setRemoving(true);
    try {
      await unwrap(commands.uninstallServer(server.id, false));
      toast.success(`${server.name} was removed`);
      setConfirmRemove(false);
      await refresh();
    } catch (e) {
      toast.error("Couldn't remove the server", { description: describeError(e).message });
    } finally {
      setRemoving(false);
    }
  };

  return (
    <Card className="flex flex-col">
      <div className="flex items-start gap-3 p-4">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold text-fg">{server.name}</span>
            <Badge>PostgreSQL {server.version}</Badge>
          </div>
          <StatusBadge
            status={displayStatus}
            label={
              displayStatus === "running"
                ? `Running on ${server.host}:${server.port}`
                : displayStatus === "error"
                  ? "Server files missing"
                  : undefined
            }
          />
        </div>
        {running && (
          <Button size="sm" variant="primary" iconLeft={<FolderOpen />} onClick={() => onOpen(server.id)}>
            Open
          </Button>
        )}
        <Button
          size="sm"
          variant={running ? "secondary" : "primary"}
          loading={busy !== null}
          disabled={status === "error"}
          iconLeft={running ? <Square /> : <Play />}
          onClick={() => void toggle()}
        >
          {running ? "Stop" : "Start"}
        </Button>
      </div>

      {!compact && (
        <div className="flex flex-col gap-2 border-t border-border px-4 py-3">
          <Row label="Connection">
            <span className="truncate font-mono text-xs text-fg-muted">
              {password ? connectionString(server, password) : connectionString(server, "••••••••")}
            </span>
            <IconButton
              size="sm"
              label="Copy connection string"
              icon={<Copy />}
              onClick={() =>
                void withPassword((pw) =>
                  navigator.clipboard
                    .writeText(connectionString(server, pw))
                    .then(() => toast.success("Connection string copied")),
                )
              }
            />
          </Row>
          <Row label="Password">
            <span className="font-mono text-xs text-fg-muted">{password ?? "••••••••••••"}</span>
            <IconButton
              size="sm"
              label={password ? "Hide password" : "Show password"}
              icon={password ? <EyeOff /> : <Eye />}
              onClick={() => (password ? setPassword(null) : void withPassword(setPassword))}
            />
          </Row>
          <Row label="Data folder">
            <span className="truncate font-mono text-xs text-fg-muted" title={server.dataDir}>
              {server.dataDir}
            </span>
          </Row>
          <div className="flex justify-end pt-1">
            <Button size="sm" variant="ghost" iconLeft={<Trash2 />} onClick={() => setConfirmRemove(true)}>
              Remove server
            </Button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmRemove}
        onOpenChange={setConfirmRemove}
        title={`Remove ${server.name}?`}
        description="This stops the server and permanently deletes all of its databases and data."
        confirmText={server.name}
        confirmLabel="Remove server"
        destructive
        loading={removing}
        onConfirm={() => void remove()}
      />
    </Card>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-7 items-center gap-3">
      <span className="w-24 shrink-0 text-xs text-fg-subtle">{label}</span>
      <div className="flex min-w-0 flex-1 items-center gap-1">{children}</div>
    </div>
  );
}
