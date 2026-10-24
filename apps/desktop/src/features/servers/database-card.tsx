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
  type Status,
  StatusDot,
  toast,
} from "@repo/ui";
import { useQueryClient } from "@tanstack/react-query";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import {
  Copy,
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
import { LocalServerLogo } from "./provider-logos";
import { commands, describeError, unwrap } from "../../lib/ipc";
import { queryKeys } from "../../lib/query";
import { useWorkspaceStore } from "../explorer/workspace-store";
import { DatabaseList } from "./database-list";

const STATUS_TEXT: Record<Status, string> = {
  running: "Running",
  starting: "Starting…",
  stopped: "Stopped",
  error: "Error",
};

const STATUS_COLOR: Record<Status, string> = {
  running: "text-success",
  starting: "text-warning",
  stopped: "text-fg-subtle",
  error: "text-danger",
};

/** Start/stop, password, removal: everything a database card can do. */
function useDatabaseActions(
  server: ManagedServer,
  status: ServerStatus | undefined,
  onStatus: (s: ServerStatus) => void,
) {
  const { refresh } = useAppState();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [password] = useState<string | null>(null);
  const running = status === "running";
  const database =
    useWorkspaceStore((s) => s.workspaces[server.id]?.database) ?? "postgres";

  const forgetConnection = () => {
    queryClient.removeQueries({ queryKey: queryKeys.connection(server.id) });
    queryClient.removeQueries({ queryKey: queryKeys.explorer.all(`server:${server.id}`) });
  };

  const toggle = async () => {
    setBusy(true);
    try {
      const next = await unwrap(running ? commands.stopServer(server.id) : commands.startServer(server.id));
      onStatus(next);
      if (!running) toast.success(`${server.name} is running`);
      else { forgetConnection(); toast.success(`${server.name} stopped`); }
    } catch (e) {
      const { title, message, hint } = describeError(e);
      toast.error(title, { description: hint ? `${message}\n${hint}` : message });
    } finally {
      setBusy(false);
    }
  };

  const withPassword = async (use: (pw: string) => void) => {
    try { use(password ?? (await unwrap(commands.serverPassword(server.id)))); }
    catch (e) { toast.error("Couldn't read the password", { description: describeError(e).message }); }
  };

  const copyConnectionString = () =>
    void withPassword((pw) =>
      navigator.clipboard.writeText(connectionString(server, pw, database))
        .then(() => toast.success("Connection string copied")),
    );

  const remove = async () => {
    await unwrap(commands.uninstallServer(server.id, false));
    forgetConnection();
    toast.success(`${server.name} was removed`);
    await refresh();
  };

  const displayStatus: Status = busy && !running ? "starting" : (status ?? "stopped");
  return { busy, running, password, database, displayStatus, toggle, copyConnectionString, remove };
}

// ── DatabaseCard (grid tile) ──────────────────────────────────────────────────

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
  const st = actions.displayStatus;

  return (
    <>
      <div className="group flex flex-col rounded-card border border-border bg-surface transition-colors hover:border-border-strong">
        {/* Card body */}
        <div className="flex flex-1 flex-col gap-3 p-4">
          {/* Top row: icon + menu */}
          <div className="flex items-start justify-between">
            <div className="flex size-9 items-center justify-center rounded-control border border-border bg-bg">
              <LocalServerLogo className="size-5" />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <IconButton size="sm" label="More actions" icon={<MoreHorizontal />} />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem icon={<Copy />} onSelect={actions.copyConnectionString}>Copy connection string</DropdownMenuItem>
                <DropdownMenuItem icon={<FolderOpen />} onSelect={() => void revealItemInDir(server.dataDir)}>Show data folder</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem icon={<Trash2 />} danger onSelect={() => setConfirmRemove(true)}>Remove database…</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Name + version */}
          <div className="flex flex-col gap-0.5">
            <span className="truncate text-sm font-semibold text-fg">{server.name}</span>
            <span className="text-xs text-fg-muted font-mono">{server.host}:{server.port}</span>
          </div>

          {/* Status + version badge */}
          <div className="flex items-center gap-2">
            <StatusDot status={st} />
            <span className={`text-xs ${STATUS_COLOR[st]}`}>{STATUS_TEXT[st]}</span>
            <Badge className="ml-auto">PG {server.version}</Badge>
          </div>
        </div>

        {/* Inline db list when running */}
        {actions.running && (
          <div className="border-t border-border">
            <p className="px-4 pt-2 pb-1 text-[10px] font-medium uppercase tracking-widest text-fg-subtle">Databases</p>
            <DatabaseList server={server} />
          </div>
        )}

        {/* Footer actions */}
        <div className="flex items-center gap-2 border-t border-border px-4 py-2.5">
          {actions.running ? (
            <>
              <Button size="sm" variant="primary" className="flex-1" onClick={() => openServer(server.id)}>Open</Button>
              <Button size="sm" iconLeft={<Square />} loading={actions.busy} onClick={() => void actions.toggle()}>Stop</Button>
            </>
          ) : (
            <Button size="sm" variant="primary" iconLeft={<Play />} loading={actions.busy} disabled={status === "error"} className="flex-1" onClick={() => void actions.toggle()}>Start</Button>
          )}
        </div>
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
          actions.remove()
            .then(() => setConfirmRemove(false))
            .catch((e: unknown) => toast.error("Couldn't remove it", { description: describeError(e).message }))
            .finally(() => setRemoving(false));
        }}
      />
    </>
  );
}

// ── DatabaseRow (compact row on Home page) ────────────────────────────────────

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
      <LocalServerLogo status={actions.displayStatus} />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium text-fg">{server.name}</span>
        <span className="truncate text-xs text-fg-subtle">
          PostgreSQL {server.version} · <span className="font-mono">{server.host}:{server.port}</span> · {STATUS_TEXT[actions.displayStatus].toLowerCase()}
        </span>
      </div>
      {actions.running ? (
        <Button size="sm" variant="primary" onClick={() => openServer(server.id)}>Open</Button>
      ) : (
        <Button size="sm" iconLeft={<Play />} loading={actions.busy} disabled={status === "error"} onClick={() => void actions.toggle()}>Start</Button>
      )}
    </li>
  );
}
