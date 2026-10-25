import { Button, cn, Dialog, DialogContent, DialogFooter, Field, Input, toast } from "@repo/ui";
import { useQueryClient } from "@tanstack/react-query";
import { open as openFile } from "@tauri-apps/plugin-dialog";
import { FileUp } from "lucide-react";
import { useState } from "react";
import { commands, unwrap } from "../../lib/ipc";
import { queryKeys } from "../../lib/query";
import { suggestIdentifier } from "../../lib/sql";
import { useWorkspaceStore } from "../explorer/workspace-store";
import { connectionIdFor } from "../servers/connection-cache";
import { useBackupDialogs } from "./backup-store";
import { CheckOption, Section, Segmented } from "./form-controls";
import { JobStatus } from "./job-status";
import { useJob } from "./use-job";

type Target = { serverId: string; database: string };

export function RestoreDialog() {
  const target = useBackupDialogs((s) => s.restore);
  // Mounted per opening: a file, name or "replace existing" choice never carries over to another database
  return target ? <RestoreDialogContent target={target} /> : null;
}

function RestoreDialogContent({ target }: { target: Target }) {
  const close = useBackupDialogs((s) => s.close);
  const queryClient = useQueryClient();
  const [path, setPath] = useState<string | null>(null);
  const [mode, setMode] = useState<"new" | "existing">("new");
  const [newName, setNewName] = useState("");
  const [clean, setClean] = useState(false);
  const [noOwner, setNoOwner] = useState(true);
  const { job, log, run, cancel, cancelling } = useJob();
  const busy = job.state === "running";
  const database = mode === "new" ? newName.trim() : target.database;

  const pick = async () => {
    const chosen = await openFile({
      title: "Choose a backup to restore",
      multiple: false,
      directory: false,
      filters: [
        { name: "PostgreSQL backups", extensions: ["dump", "backup", "sql"] },
      ],
    });
    if (typeof chosen !== "string") return;
    setPath(chosen);
    const base =
      chosen
        .split(/[\\/]/)
        .pop()
        ?.replace(/\.(dump|backup|sql)$/i, "") ?? "restored";
    setNewName(
      suggestIdentifier(base.replace(/-\d{4}-\d{2}-\d{2}-\d{4}$/, "")) +
        "_restored",
    );
  };

  const start = () =>
    run(
      (jobId, channel) =>
        unwrap(
          commands.restoreDatabase(
            target.serverId,
            {
              database,
              path: path!,
              createDatabase: mode === "new",
              clean: mode === "existing" && clean,
              noOwner,
            },
            jobId,
            channel,
          ),
        ),
      (result) => {
        // Restored objects (or a new database) show up in the explorer and on the Databases page
        void queryClient.invalidateQueries({
          queryKey: queryKeys.explorer.all(connectionIdFor(target.serverId)),
        });
        if (mode === "new")
          useWorkspaceStore
            .getState()
            .setLocation(target.serverId, { database, schema: null });
        toast.success(`Restored into ${database}`);
        return {
          message: `Restored into ${database} in ${(result.durationMs / 1000).toFixed(1)}s`,
        };
      },
    );

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (open || busy) return;
        close();
      }}
    >
      <DialogContent
        title="Restore a backup"
        description="Load a backup file into a new or existing database."
        className="w-[500px]"
        hideClose={busy}
      >
        {job.state === "idle" ? (
          <div className="flex flex-col gap-5">
            <Section label="Backup file">
              <button
                type="button"
                onClick={() => void pick()}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-card border px-3 py-3 text-left transition-colors hover:bg-surface-hover",
                  path
                    ? "border-border-strong bg-surface"
                    : "border-dashed border-border-strong",
                )}
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-control bg-surface-hover text-fg-muted">
                  <FileUp className="size-4" />
                </span>
                {path ? (
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-mono text-sm text-fg">
                      {path.split(/[\\/]/).pop()}
                    </span>
                    <span className="truncate text-xs text-fg-subtle">
                      {path}
                    </span>
                  </span>
                ) : (
                  <span className="flex flex-1 flex-col">
                    <span className="text-sm text-fg">
                      Choose a backup file
                    </span>
                    <span className="text-xs text-fg-subtle">
                      .dump, .backup or .sql
                    </span>
                  </span>
                )}
                <span className="text-xs text-fg-muted">
                  {path ? "Change" : "Browse"}
                </span>
              </button>
            </Section>
            <Section
              label="Restore into"
              hint={
                mode === "new"
                  ? "Safest: nothing that exists now is touched."
                  : `Adds the backup's objects to ${target.database}.`
              }
            >
              <Segmented
                value={mode}
                onChange={setMode}
                options={[
                  { value: "new", label: "A new database" },
                  {
                    value: "existing",
                    label: <span className="font-mono">{target.database}</span>,
                  },
                ]}
              />
            </Section>
            {mode === "new" ? (
              <Field label="New database name">
                {(p) => (
                  <Input
                    {...p}
                    className="font-mono"
                    placeholder="my_database"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                  />
                )}
              </Field>
            ) : (
              <CheckOption
                checked={clean}
                onChange={setClean}
                title="Replace existing objects"
                description="Drops tables that are in the backup before recreating them (.dump files)."
              />
            )}
            <CheckOption
              checked={noOwner}
              onChange={setNoOwner}
              title="Ignore owners and permissions"
              description="Use this when the backup came from another server."
            />
            <p className="text-xs text-fg-subtle">
              Runs in one transaction: if anything fails, the database is left
              as it was.
            </p>
          </div>
        ) : (
          <JobStatus
            job={job}
            log={log}
            running={`Restoring into ${database}…`}
          />
        )}
        <DialogFooter>
          {job.state === "idle" && (
            <>
              <Button variant="ghost" onClick={close}>
                Cancel
              </Button>
              <Button
                variant={mode === "existing" && clean ? "danger" : "primary"}
                disabled={!path || !database}
                onClick={() => void start()}
              >
                Restore
              </Button>
            </>
          )}
          {busy && (
            <Button variant="danger" loading={cancelling} onClick={cancel}>
              Cancel restore
            </Button>
          )}
          {(job.state === "done" || job.state === "failed") && (
            <Button
              variant="primary"
              onClick={close}
            >
              Done
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
