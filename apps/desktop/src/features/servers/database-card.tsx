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
  type Status,
  StatusDot,
  toast,
} from "@repo/ui";
import { useQueryClient } from "@tanstack/react-query";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import {
  Copy,
  Database,
  Eye,
  EyeOff,
  FolderOpen,
  MoreHorizontal,
  Play,
  Square,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { useAppState } from "../../app/app-state";
import { useNavigation } from "../../app/navigation";
import type { ManagedServer, ServerStatus } from "../../lib/bindings";
import { connectionString } from "../../lib/format";
import { commands, describeError, unwrap } from "../../lib/ipc";
import { queryKeys } from "../../lib/query";
import { useWorkspaceStore } from "../explorer/workspace-store";

const STATUS_TEXT: Record<Status, string> = {
  running: "Running",
  starting: "Starting…",
  stopped: "Stopped",
  error: "Files missing",
};

/** Start/stop, password, removal: everything a database card or row can do. */
function useDatabaseActions(
  server: ManagedServer,
  status: ServerStatus | undefined,
  onStatus: (s: ServerStatus) => void,
) {
  const { refresh } = useAppState();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [password, setPassword] = useState<string | null>(null);
  const running = status === "running";
  // Use the database the user last browsed, since "postgres" may have been renamed
  const database =
    useWorkspaceStore((s) => s.workspaces[server.id]?.database) ?? "postgres";

  /** The session closes when the database stops; drop the cached one so the explorer reconnects. */
  const forgetConnection = () => {
    queryClient.removeQueries({ queryKey: queryKeys.connection(server.id) });
    queryClient.removeQueries({
      queryKey: queryKeys.explorer.all(`server:${server.id}`),
    });
  };

  const toggle = async () => {
    setBusy(true);
    try {
      const next = await unwrap(
        running
          ? commands.stopServer(server.id)
          : commands.startServer(server.id),
      );
      onStatus(next);
      if (!running) toast.success(`${server.name} is running`);
      else {
        forgetConnection();
        toast.success(`${server.name} stopped`);
      }
    } catch (e) {
      const { title, message, hint } = describeError(e);
      toast.error(title, {
        description: hint ? `${message}\n${hint}` : message,
      });
    } finally {
      setBusy(false);
    }
  };

  const withPassword = async (use: (password: string) => void) => {
    try {
      use(password ?? (await unwrap(commands.serverPassword(server.id))));
    } catch (e) {
      toast.error("Couldn't read the password", {
        description: describeError(e).message,
      });
    }
  };

  const copyConnectionString = () =>
    void withPassword((pw) =>
      navigator.clipboard
        .writeText(connectionString(server, pw, database))
        .then(() => toast.success("Connection string copied")),
    );

  const togglePassword = () =>
    password ? setPassword(null) : void withPassword(setPassword);

  const remove = async () => {
    await unwrap(commands.uninstallServer(server.id, false));
    forgetConnection();
    toast.success(`${server.name} was removed`);
    await refresh();
  };

  const displayStatus: Status =
    busy && !running ? "starting" : (status ?? "stopped");
  return {
    busy,
    running,
    password,
    database,
    displayStatus,
    toggle,
    copyConnectionString,
    togglePassword,
    remove,
  };
}

/** Full card for the Databases page. */
export function DatabaseCard({
  server,
  status,
  onStatus,
}: {
  server: ManagedServer;
  status: ServerStatus | undefined;
  onStatus: (status: ServerStatus) => void;
}) {
  const openServer = useNavigation((s) => s.openServer);
  const actions = useDatabaseActions(server, status, onStatus);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [removing, setRemoving] = useState(false);

  return (
    <Card className="group flex flex-col transition-colors hover:border-border-strong">
      <div className="flex items-start gap-3 p-4">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-control border border-border bg-bg text-fg-muted">
          <Database className="size-4" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold text-fg">
              {server.name}
            </span>
            <Badge>PostgreSQL {server.version}</Badge>
          </div>
          <span className="flex items-center gap-2 text-xs text-fg-muted">
            <StatusDot status={actions.displayStatus} />
            {STATUS_TEXT[actions.displayStatus]}
            <span className="text-fg-subtle">·</span>
            <span className="font-mono">
              {server.host}:{server.port}
            </span>
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {actions.running ? (
            <>
              <Button
                size="sm"
                variant="primary"
                onClick={() => openServer(server.id)}
              >
                Open
              </Button>
              <Button
                size="sm"
                iconLeft={<Square />}
                loading={actions.busy}
                onClick={() => void actions.toggle()}
              >
                Stop
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              variant="primary"
              iconLeft={<Play />}
              loading={actions.busy}
              disabled={status === "error"}
              onClick={() => void actions.toggle()}
            >
              Start
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <IconButton
                size="sm"
                label="More actions"
                icon={<MoreHorizontal />}
              />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                icon={<Copy />}
                onSelect={actions.copyConnectionString}
              >
                Copy connection string
              </DropdownMenuItem>
              <DropdownMenuItem
                icon={<FolderOpen />}
                onSelect={() => void revealItemInDir(server.dataDir)}
              >
                Show data folder
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                icon={<Trash2 />}
                danger
                onSelect={() => setConfirmRemove(true)}
              >
                Remove database…
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-border px-4 py-2.5">
        <span className="min-w-0 flex-1 truncate font-mono text-xs text-fg-muted">
          {connectionString(server, actions.password, actions.database)}
        </span>
        <IconButton
          size="sm"
          label={actions.password ? "Hide password" : "Show password"}
          icon={actions.password ? <EyeOff /> : <Eye />}
          onClick={actions.togglePassword}
        />
        <IconButton
          size="sm"
          label="Copy connection string"
          icon={<Copy />}
          onClick={actions.copyConnectionString}
        />
      </div>

      <ConfirmDialog
        open={confirmRemove}
        onOpenChange={setConfirmRemove}
        title={`Remove ${server.name}?`}
        description="This stops it and permanently deletes all of its data. Back it up first if you might need it."
        confirmText={server.name}
        confirmLabel="Remove database"
        destructive
        loading={removing}
        onConfirm={() => {
          setRemoving(true);
          actions
            .remove()
            .then(() => setConfirmRemove(false))
            .catch((e: unknown) =>
              toast.error("Couldn't remove it", {
                description: describeError(e).message,
              }),
            )
            .finally(() => setRemoving(false));
        }}
      />
    </Card>
  );
}

/** Compact row for Home. */
export function DatabaseRow({
  server,
  status,
  onStatus,
}: {
  server: ManagedServer;
  status: ServerStatus | undefined;
  onStatus: (status: ServerStatus) => void;
}) {
  const openServer = useNavigation((s) => s.openServer);
  const actions = useDatabaseActions(server, status, onStatus);

  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <StatusDot status={actions.displayStatus} />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium text-fg">
          {server.name}
        </span>
        <span className="truncate text-xs text-fg-subtle">
          PostgreSQL {server.version} ·{" "}
          <span className="font-mono">
            {server.host}:{server.port}
          </span>{" "}
          · {STATUS_TEXT[actions.displayStatus].toLowerCase()}
        </span>
      </div>
      {actions.running ? (
        <Button
          size="sm"
          variant="primary"
          onClick={() => openServer(server.id)}
        >
          Open
        </Button>
      ) : (
        <Button
          size="sm"
          iconLeft={<Play />}
          loading={actions.busy}
          disabled={status === "error"}
          onClick={() => void actions.toggle()}
        >
          Start
        </Button>
      )}
    </li>
  );
}
