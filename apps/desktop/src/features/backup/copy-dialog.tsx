import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  Field,
  Input,
  Select,
  toast,
} from "@repo/ui";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowDown, HardDrive } from "lucide-react";
import { useState } from "react";
import { useAppState } from "../../app/app-state";
import { useNavigation } from "../../app/navigation";
import type { ManagedServer, RemoteConnection } from "../../lib/bindings";
import { commands, unwrap } from "../../lib/ipc";
import { queryKeys } from "../../lib/query";
import { suggestIdentifier } from "../../lib/sql";
import { useWorkspaceStore } from "../explorer/workspace-store";
import { connectionIdFor } from "../servers/connection-cache";
import { ProviderLogo } from "../servers/provider-logos";
import { useServerStatuses } from "../servers/use-server-statuses";
import { useBackupDialogs } from "./backup-store";
import { Section, Segmented } from "./form-controls";
import { JobStatus } from "./job-status";
import { useJob } from "./use-job";

const major = (version: string) => Number.parseInt(version, 10) || 0;

export function CopyToLocalDialog() {
  const source = useBackupDialogs((s) => s.copy);
  const { state } = useAppState();
  const remote = state.remoteConnections.find((r) => r.id === source?.remoteId);
  // Mounted per opening, so a name or choice never carries over to another database
  return source && remote ? (
    <CopyDialogContent
      key={`${remote.id}/${source.database}`}
      remote={remote}
      sourceDatabase={source.database}
      servers={state.servers}
    />
  ) : null;
}

function CopyDialogContent({
  remote,
  sourceDatabase,
  servers,
}: {
  remote: RemoteConnection;
  /** The connection's default database, or the one open in the explorer. */
  sourceDatabase: string;
  servers: ManagedServer[];
}) {
  const close = useBackupDialogs((s) => s.close);
  const queryClient = useQueryClient();
  const { statuses, setStatus } = useServerStatuses(servers.map((s) => s.id));
  // The newest version first: it can read any cloud server that an older one can
  const [serverId, setServerId] = useState(
    () =>
      [...servers].sort((a, b) => major(b.version) - major(a.version))[0]?.id ??
      "",
  );
  const [name, setName] = useState(() =>
    suggestIdentifier(`${sourceDatabase}_copy`),
  );
  const [content, setContent] = useState<"all" | "schema">("all");
  const { job, log, run, cancel, cancelling } = useJob();
  const busy = job.state === "running";
  const server = servers.find((s) => s.id === serverId);
  const database = name.trim();

  const start = () =>
    run(
      async (jobId, channel) => {
        // A stopped server is started first; the copy needs it running
        if (statuses[serverId] !== "running")
          setStatus(serverId, await unwrap(commands.startServer(serverId)));
        return unwrap(
          commands.copyToLocal(
            remote.id,
            serverId,
            {
              sourceDatabase,
              database,
              schemaOnly: content === "schema",
            },
            jobId,
            channel,
          ),
        );
      },
      (result) => {
        // The new database shows up in the explorer and on the Databases page
        void queryClient.invalidateQueries({
          queryKey: queryKeys.explorer.all(connectionIdFor(serverId)),
        });
        toast.success(`Copied into ${database}`);
        const seconds = (result.durationMs / 1000).toFixed(1);
        return {
          message:
            result.skipped > 0
              ? `Copied into ${database} in ${seconds}s · ${result.skipped} object(s) skipped, see details`
              : `Copied into ${database} in ${seconds}s`,
        };
      },
    );

  const openCopy = () => {
    useWorkspaceStore
      .getState()
      .setLocation(serverId, { database, schema: null });
    useNavigation.getState().openServer(serverId);
    close();
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (open || busy) return;
        close();
      }}
    >
      <DialogContent
        title="Copy to local"
        description="Make a copy of a cloud database on this computer to debug safely."
        className="w-[500px]"
        hideClose={busy}
      >
        {servers.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-border-strong px-4 py-6 text-center">
            <HardDrive className="size-6 text-fg-subtle" />
            <span className="text-sm text-fg">
              You need a local PostgreSQL server to copy into.
            </span>
            <Button
              size="sm"
              variant="primary"
              onClick={() => {
                close();
                useNavigation.getState().startInstall();
              }}
            >
              Install PostgreSQL
            </Button>
          </div>
        ) : job.state === "idle" ? (
          <div className="flex flex-col gap-5">
            {/* From → into */}
            <div className="flex flex-col items-center gap-1.5">
              <div className="flex w-full items-center gap-3 rounded-card border border-border bg-surface px-3 py-2.5">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-control border border-border bg-bg p-1.5">
                  <ProviderLogo provider={remote.provider} className="size-full" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm text-fg">{remote.name}</span>
                  <span className="truncate font-mono text-xs text-fg-subtle">
                    {sourceDatabase} · {remote.host}
                  </span>
                </span>
                <span className="text-xs text-fg-subtle">read only</span>
              </div>
              <ArrowDown className="size-4 text-fg-subtle" />
              <Select
                value={serverId}
                onValueChange={setServerId}
                options={servers.map((s) => ({
                  value: s.id,
                  label: s.name,
                  hint: `PostgreSQL ${major(s.version)} · ${statuses[s.id] === "running" ? "running" : "stopped"}`,
                }))}
              />
            </div>
            <Field label="New database name">
              {(p) => (
                <Input
                  {...p}
                  className="font-mono"
                  placeholder="my_database_copy"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              )}
            </Field>
            <Section
              label="What to copy"
              hint={
                content === "all"
                  ? "Every table with its rows. Large databases take a while."
                  : "Tables, views and functions without rows. Fast, and no production data on this computer."
              }
            >
              <Segmented
                value={content}
                onChange={setContent}
                options={[
                  { value: "all", label: "Structure and data" },
                  { value: "schema", label: "Structure only" },
                ]}
              />
            </Section>
            {server && statuses[serverId] !== "running" && (
              <p className="text-xs text-fg-subtle">
                {server.name} is stopped; it starts when the copy begins.
              </p>
            )}
          </div>
        ) : (
          <JobStatus
            job={job}
            log={log}
            running={`Copying ${sourceDatabase} into ${database}…`}
          />
        )}
        <DialogFooter>
          {servers.length > 0 && job.state === "idle" && (
            <>
              <Button variant="ghost" onClick={close}>
                Cancel
              </Button>
              <Button
                variant="primary"
                disabled={!server || !database}
                onClick={() => void start()}
              >
                Copy
              </Button>
            </>
          )}
          {busy && (
            <Button variant="danger" loading={cancelling} onClick={cancel}>
              Cancel copy
            </Button>
          )}
          {job.state === "done" && (
            <>
              <Button variant="ghost" onClick={close}>
                Done
              </Button>
              <Button variant="primary" onClick={openCopy}>
                Open {database}
              </Button>
            </>
          )}
          {job.state === "failed" && (
            <Button variant="primary" onClick={close}>
              Done
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
