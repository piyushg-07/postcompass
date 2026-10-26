import { Button, LogViewer, toast } from "@repo/ui";
import { AlertTriangle, CheckCircle2, ChevronDown, Copy } from "lucide-react";
import { useEffect, useState } from "react";
import type { ManagedServer } from "../../../lib/bindings";

/** The installer's log, tucked away until asked for (or something failed). */
export function Details({
  lines,
  defaultOpen,
}: {
  lines: string[];
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  useEffect(() => {
    if (defaultOpen) setOpen(true);
  }, [defaultOpen]);

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-fit cursor-pointer items-center gap-1 text-xs text-fg-muted hover:text-fg"
        aria-expanded={open}
      >
        <ChevronDown
          className={`size-3.5 transition-transform ${open ? "" : "-rotate-90"}`}
        />
        {open ? "Hide details" : "Show details"}
      </button>
      {open && <LogViewer lines={lines} />}
    </div>
  );
}

export function FailedPanel({
  title,
  message,
  hint,
  log,
  onRetry,
}: {
  title: string;
  message: string;
  hint?: string;
  log: string[];
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-card border border-danger/30 bg-danger/5 p-3">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" />
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-sm font-medium text-fg">{title}</span>
          <span className="text-xs break-words whitespace-pre-wrap text-fg-muted">
            {message}
          </span>
          {hint && <span className="text-xs text-fg">{hint}</span>}
          <span className="text-xs text-fg-subtle">
            Nothing was left behind. You can safely try again.
          </span>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button
          variant="ghost"
          size="sm"
          iconLeft={<Copy />}
          onClick={() =>
            void navigator.clipboard
              .writeText(`${title}\n${message}\n\n${log.join("\n")}`)
              .then(
                () => toast.success("Error details copied"),
                () => toast.error("Couldn't copy the details"),
              )
          }
        >
          Copy details
        </Button>
        <Button size="sm" variant="primary" onClick={onRetry}>
          Try again
        </Button>
      </div>
    </div>
  );
}

export function DonePanel({
  server,
  database,
  onContinue,
}: {
  server: ManagedServer;
  /** The database created for the user, if any. */
  database: string | null;
  onContinue: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-card border border-accent/30 bg-accent-muted p-3">
      <div className="flex items-start gap-2">
        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium text-fg">
            PostgreSQL {server.version} is running
          </span>
          <span className="font-mono text-xs text-fg-muted">
            {server.host}:{server.port} · user {server.superuser}
          </span>
          {database && (
            <span className="text-xs text-fg-muted">
              Database <span className="font-mono text-fg">{database}</span> is
              ready to use.
            </span>
          )}
          <span className="text-xs text-fg-subtle">
            The password is saved in your system keychain.
          </span>
        </div>
      </div>
      <div className="flex justify-end">
        <Button size="sm" variant="primary" onClick={onContinue}>
          Continue
        </Button>
      </div>
    </div>
  );
}
