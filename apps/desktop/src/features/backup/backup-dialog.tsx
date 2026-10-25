import { Button, Dialog, DialogContent, DialogFooter, toast } from "@repo/ui";
import { save as saveFile } from "@tauri-apps/plugin-dialog";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { FolderOpen } from "lucide-react";
import { useState } from "react";
import type { BackupContent, BackupFormat } from "../../lib/bindings";
import { formatBytes } from "../../lib/format";
import { commands, unwrap } from "../../lib/ipc";
import { useBackupDialogs } from "./backup-store";
import { CheckOption, Section, Segmented } from "./form-controls";
import { JobStatus } from "./job-status";
import { useJob } from "./use-job";

type Target = { serverId: string; database: string };

/** Local time as 2024-05-01-1830, for default backup file names. */
function timestamp() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
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
  // Mounted per opening, so every backup starts from a fresh form
  return target ? <BackupDialogContent target={target} /> : null;
}

function BackupDialogContent({ target }: { target: Target }) {
  const close = useBackupDialogs((s) => s.close);
  const [format, setFormat] = useState<BackupFormat>("custom");
  const [content, setContent] = useState<BackupContent>("all");
  const [noOwner, setNoOwner] = useState(true);
  const { job, log, run, cancel, cancelling } = useJob();
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
            <Button variant="danger" loading={cancelling} onClick={cancel}>
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
                onClick={close}
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
