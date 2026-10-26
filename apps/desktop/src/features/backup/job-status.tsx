import { cn, LogViewer } from "@repo/ui";
import { AlertTriangle, CheckCircle2, ChevronRight } from "lucide-react";
import { useState } from "react";
import type { Job } from "./use-job";

export function JobStatus({
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
