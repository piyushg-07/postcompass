import {
  Button,
  Checkbox,
  cn,
  Dialog,
  DialogContent,
  DialogFooter,
  Field,
  Input,
  LogViewer,
  toast,
} from "@repo/ui";
import { useQueryClient } from "@tanstack/react-query";
import { Channel } from "@tauri-apps/api/core";
import { open as openFile, save as saveFile } from "@tauri-apps/plugin-dialog";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  FileUp,
  FolderOpen,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import type { BackupContent, BackupFormat } from "../../lib/bindings";
import { formatBytes } from "../../lib/format";
import { commands, describeError, isCancelled, unwrap } from "../../lib/ipc";
import { queryKeys } from "../../lib/query";
import { suggestIdentifier } from "../../lib/sql";
import { useWorkspaceStore } from "../explorer/workspace-store";
import { useBackupDialogs } from "./backup-store";

type Job =
  | { state: "idle" }
  | { state: "running"; id: string }
  | { state: "done"; message: string; path?: string }
  | { state: "failed"; title: string; message: string };

function timestamp() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

/** Runs a backup/restore job with a live log and cancel. */
function useJob() {
  const [job, setJob] = useState<Job>({ state: "idle" });
  const [log, setLog] = useState<string[]>([]);

  const run = async <T,>(
    start: (jobId: string, channel: Channel<string>) => Promise<T>,
    onDone: (result: T) => { message: string; path?: string },
  ) => {
    const id = crypto.randomUUID();
    const channel = new Channel<string>();
    channel.onmessage = (line) =>
      setLog((l) =>
        l.length > 2000 ? [...l.slice(-1500), line] : [...l, line],
      );
    setLog([]);
    setJob({ state: "running", id });
    try {
      setJob({ state: "done", ...onDone(await start(id, channel)) });
    } catch (e) {
      if (isCancelled(e))
        setJob({
          state: "failed",
          title: "Cancelled",
          message: "Nothing was changed.",
        });
      else setJob({ state: "failed", ...describeError(e) });
    }
  };

  const cancel = () =>
    job.state === "running" && void commands.cancelJob(job.id);
  const reset = () => {
    setJob({ state: "idle" });
    setLog([]);
  };
  return { job, log, run, cancel, reset };
}

function JobStatus({
  job,
  log,
  running,
}: {
  job: Job;
  log: string[];
  /** e.g. "Backing up piyushgres…" */
  running: string;
}) {
  // The log is tucked away unless something went wrong
  const [showLog, setShowLog] = useState(false);
  const logOpen = showLog || job.state === "failed";
  return (
    <div className="flex flex-col gap-3">
      {job.state === "running" && (
        <div className="flex items-center gap-3 rounded-card border border-border bg-surface px-4 py-3">
          <span className="size-4 shrink-0 animate-spin rounded-full border-2 border-accent/25 border-t-accent" />
          <span className="text-sm text-fg">{running}</span>
        </div>
      )}
      {job.state === "done" && (
        <div className="flex flex-col items-center gap-2 rounded-card border border-accent/30 bg-accent-muted px-4 py-5 text-center">
          <CheckCircle2 className="size-7 text-accent" />
          <span className="text-sm font-medium text-fg">{job.message}</span>
          {job.path && (
            <span className="max-w-full truncate font-mono text-xs text-fg-muted">
              {job.path}
            </span>
          )}
        </div>
      )}
      {job.state === "failed" && (
        <div className="flex items-start gap-2.5 rounded-card border border-danger/30 bg-danger/5 px-4 py-3 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" />
          <div className="flex min-w-0 flex-col gap-1">
            <span className="font-medium text-fg">{job.title}</span>
            <span className="text-xs break-words whitespace-pre-wrap text-fg-muted">
              {job.message}
            </span>
          </div>
        </div>
      )}
      {job.state !== "failed" && (
        <button
          type="button"
          onClick={() => setShowLog((v) => !v)}
          className="flex w-fit cursor-pointer items-center gap-1 text-xs text-fg-subtle hover:text-fg"
        >
          <ChevronRight
            className={cn(
              "size-3.5 transition-transform",
              logOpen && "rotate-90",
            )}
          />
          {logOpen ? "Hide details" : "Show details"}
        </button>
      )}
      {logOpen && (
        <LogViewer
          lines={log}
          emptyText="Waiting for output…"
          className="max-h-48"
        />
      )}
    </div>
  );
}

/** A labelled group of options in the form. */
function Section({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-fg-muted">{label}</span>
      {children}
      {hint && <p className="text-xs text-fg-subtle">{hint}</p>}
    </div>
  );
}

/** Two or three side-by-side choices, like a toggle group. */
function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: ReactNode }[];
}) {
  return (
    <div
      className="grid gap-1 rounded-control border border-border-strong bg-bg p-1"
      style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "h-7 cursor-pointer truncate rounded px-2 text-sm transition-colors",
            value === o.value
              ? "bg-surface-hover text-fg shadow-sm"
              : "text-fg-muted hover:text-fg",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** A checkbox with a title and a muted line under it. */
function CheckOption({
  checked,
  onChange,
  title,
  description,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  title: string;
  description: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5">
      <Checkbox
        className="mt-0.5"
        checked={checked}
        onCheckedChange={(c) => onChange(c === true)}
      />
      <span className="flex flex-col gap-0.5">
        <span className="text-sm text-fg">{title}</span>
        <span className="text-xs text-fg-subtle">{description}</span>
      </span>
    </label>
  );
}

const FORMAT_HINTS: Record<BackupFormat, string> = {
  custom: "Smaller, and you can restore all of it or just some tables.",
  plain: "Plain SQL you can read and edit in any text editor.",
};

const CONTENT_HINTS: Record<BackupContent, string> = {
  all: "Tables, views and functions together with their rows.",
  schema_only: "Only how the database is built, without any rows.",
  data_only: "Only the rows, for a database that already has the tables.",
};

export function BackupDialog() {
  const target = useBackupDialogs((s) => s.backup);
  const close = useBackupDialogs((s) => s.close);
  const [format, setFormat] = useState<BackupFormat>("custom");
  const [content, setContent] = useState<BackupContent>("all");
  const [noOwner, setNoOwner] = useState(true);
  const { job, log, run, cancel, reset } = useJob();

  if (!target) return null;
  const busy = job.state === "running";

  const start = async () => {
    const extension = format === "custom" ? "dump" : "sql";
    const path = await saveFile({
      title: "Save backup",
      defaultPath: `${target.database}-${timestamp()}.${extension}`,
      filters: [
        format === "custom"
          ? { name: "PostgreSQL backup", extensions: ["dump", "backup"] }
          : { name: "SQL script", extensions: ["sql"] },
      ],
    });
    if (!path) return;
    await run(
      (jobId, channel) =>
        unwrap(
          commands.backupDatabase(
            target.serverId,
            { database: target.database, path, format, content, noOwner },
            jobId,
            channel,
          ),
        ),
      (result) => {
        toast.success("Backup saved", {
          description: formatBytes(result.sizeBytes),
        });
        return {
          message: `Backup saved · ${formatBytes(result.sizeBytes)} in ${(result.durationMs / 1000).toFixed(1)}s`,
          path: result.path,
        };
      },
    );
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (open || busy) return;
        reset();
        close();
      }}
    >
      <DialogContent
        title={
          <>
            Back up <span className="font-mono">{target.database}</span>
          </>
        }
        description="Save a copy of the database to a file. You'll pick where next."
        className="w-[500px]"
        hideClose={busy}
      >
        {job.state === "idle" ? (
          <div className="flex flex-col gap-5">
            <Section label="Format" hint={FORMAT_HINTS[format]}>
              <Segmented
                value={format}
                onChange={setFormat}
                options={[
                  { value: "custom", label: "Compressed (.dump)" },
                  { value: "plain", label: "SQL script (.sql)" },
                ]}
              />
            </Section>
            <Section label="Include" hint={CONTENT_HINTS[content]}>
              <Segmented
                value={content}
                onChange={setContent}
                options={[
                  { value: "all", label: "Everything" },
                  { value: "schema_only", label: "Structure only" },
                  { value: "data_only", label: "Data only" },
                ]}
              />
            </Section>
            <CheckOption
              checked={noOwner}
              onChange={setNoOwner}
              title="Leave out owners and permissions"
              description="Makes the backup easy to restore on another server."
            />
          </div>
        ) : (
          <JobStatus
            job={job}
            log={log}
            running={`Backing up ${target.database}…`}
          />
        )}
        <DialogFooter>
          {job.state === "idle" && (
            <>
              <Button variant="ghost" onClick={close}>
                Cancel
              </Button>
              <Button variant="primary" onClick={() => void start()}>
                Back up…
              </Button>
            </>
          )}
          {busy && (
            <Button variant="danger" onClick={cancel}>
              Cancel backup
            </Button>
          )}
          {(job.state === "done" || job.state === "failed") && (
            <>
              {job.state === "done" && job.path && (
                <Button
                  variant="ghost"
                  iconLeft={<FolderOpen />}
                  onClick={() => void revealItemInDir(job.path!)}
                >
                  Show in folder
                </Button>
              )}
              <Button
                variant="primary"
                onClick={() => {
                  reset();
                  close();
                }}
              >
                Done
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function RestoreDialog() {
  const target = useBackupDialogs((s) => s.restore);
  const close = useBackupDialogs((s) => s.close);
  const queryClient = useQueryClient();
  const [path, setPath] = useState<string | null>(null);
  const [mode, setMode] = useState<"new" | "existing">("new");
  const [newName, setNewName] = useState("");
  const [clean, setClean] = useState(false);
  const [noOwner, setNoOwner] = useState(true);
  const { job, log, run, cancel, reset } = useJob();

  if (!target) return null;
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
        const connection = queryClient.getQueryData<{ connectionId: string }>(
          queryKeys.connection(target.serverId),
        );
        if (connection)
          void queryClient.invalidateQueries({
            queryKey: queryKeys.explorer.all(connection.connectionId),
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
        reset();
        setPath(null);
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
            <Button variant="danger" onClick={cancel}>
              Cancel restore
            </Button>
          )}
          {(job.state === "done" || job.state === "failed") && (
            <Button
              variant="primary"
              onClick={() => {
                reset();
                setPath(null);
                close();
              }}
            >
              Done
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
