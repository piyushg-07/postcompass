import { Button, Progress, TaskSteps, toast } from "@repo/ui";
import { useQueryClient } from "@tanstack/react-query";
import { Channel } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";
import type { InstallEvent, ManagedServer } from "../../lib/bindings";
import { formatMb } from "../../lib/format";
import { commands, describeError, isCancelled, unwrap } from "../../lib/ipc";
import { queryKeys } from "../../lib/query";
import { type FormValues, InstallForm, isNewDatabase } from "./install/install-form";
import { Details, DonePanel, FailedPanel } from "./install/install-panels";
import { DOWNLOAD_STEPS, useInstallProgress } from "./install/use-install-progress";

type Phase =
  | { kind: "form" }
  | { kind: "installing" }
  | { kind: "failed"; title: string; message: string; hint?: string }
  | { kind: "done"; server: ManagedServer };

/**
 * Full install experience: options form → live progress → success or failure with rollback.
 * Used in onboarding and on the Servers page.
 */
export function InstallFlow({
  onInstalled,
  onCancel,
  onBusyChange,
  onStageChange,
  cancelLabel = "Cancel",
}: {
  onInstalled: (server: ManagedServer) => void;
  onCancel?: () => void;
  /** True while an install is running, so containers can block closing. */
  onBusyChange?: (busy: boolean) => void;
  /** Whether the form or the progress is showing, so containers can adapt their header. */
  onStageChange?: (stage: "form" | "progress") => void;
  cancelLabel?: string;
}) {
  const queryClient = useQueryClient();
  const [phase, setPhase] = useState<Phase>({ kind: "form" });
  const [values, setValues] = useState<FormValues | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const progress = useInstallProgress();
  const stage = phase.kind === "form" ? "form" : "progress";
  useEffect(() => onStageChange?.(stage), [stage, onStageChange]);

  const install = async (form: FormValues) => {
    setValues(form);
    progress.reset();
    setCancelling(false);
    setPhase({ kind: "installing" });
    onBusyChange?.(true);

    const channel = new Channel<InstallEvent>();
    channel.onmessage = progress.handle;
    try {
      const server = await unwrap(
        commands.installServer(
          "postgres",
          {
            version: form.version,
            port: form.port,
            password: form.password,
            autoStart: form.autoStart,
            dataDir: null,
            name: form.name.trim(),
            database: isNewDatabase(form.database)
              ? form.database.trim()
              : null,
          },
          channel,
        ),
      );
      // The server exists now, even if the dialog is closed without pressing Continue
      void queryClient.invalidateQueries({ queryKey: queryKeys.appState });
      void queryClient.invalidateQueries({ queryKey: queryKeys.serverStatuses });
      setPhase({ kind: "done", server });
      toast.success("PostgreSQL is running", {
        description: `${server.name} on port ${server.port}`,
      });
    } catch (e) {
      if (isCancelled(e)) {
        // Nothing was installed when the version was already here; only the new server was undone
        toast.info(form.installed ? "Setup cancelled" : "Install cancelled", {
          description: form.installed
            ? "The new server was removed. PostgreSQL itself is untouched."
            : "Everything was cleaned up.",
        });
        setPhase({ kind: "form" });
      } else {
        setPhase({ kind: "failed", ...describeError(e) });
      }
    } finally {
      // A download may have landed (the version now counts as installed), cached forever otherwise
      void queryClient.invalidateQueries({
        queryKey: queryKeys.runtimeVersions("postgres"),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.detection("postgres"),
      });
      onBusyChange?.(false);
    }
  };

  const cancel = () => {
    setCancelling(true);
    // If the request itself fails, let the user try again
    commands.cancelInstall().catch(() => setCancelling(false));
  };

  if (phase.kind === "form") {
    return (
      <InstallForm
        initial={values}
        onSubmit={install}
        onCancel={onCancel}
        cancelLabel={cancelLabel}
      />
    );
  }

  // An installed version skips the download steps entirely, so don't list them
  const steps = progress.steps.filter(
    (step) =>
      step.state !== "skipped" &&
      !(values?.installed && DOWNLOAD_STEPS.has(step.id)),
  );

  return (
    <div className="flex flex-col gap-4">
      {values && phase.kind !== "done" && (
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium text-fg">
            {phase.kind === "failed" ? "Couldn't set up" : "Setting up"}{" "}
            {values.name.trim()}
          </span>
          <span className="font-mono text-xs text-fg-subtle">
            PostgreSQL {values.version} · port {values.port}
            {` · database ${values.database.trim() || "postgres"}`}
          </span>
        </div>
      )}
      <div className="rounded-card border border-border bg-surface px-4 py-3.5">
        <TaskSteps steps={steps} />
      </div>
      {progress.download &&
        phase.kind === "installing" &&
        progress.activeStep === "download" && (
          <div className="flex flex-col gap-1.5">
            <Progress
              label="Download progress"
              value={
                progress.download.total
                  ? (progress.download.downloaded / progress.download.total) *
                    100
                  : undefined
              }
            />
            <span className="font-mono text-xs text-fg-subtle">
              {formatMb(progress.download.downloaded)}
              {progress.download.total
                ? ` / ${formatMb(progress.download.total)}`
                : ""}
            </span>
          </div>
        )}

      <Details lines={progress.log} defaultOpen={phase.kind === "failed"} />

      {phase.kind === "installing" && (
        <div className="flex justify-end">
          <Button variant="ghost" loading={cancelling} onClick={cancel}>
            {values?.installed ? "Cancel" : "Cancel install"}
          </Button>
        </div>
      )}

      {phase.kind === "failed" && (
        <FailedPanel
          title={phase.title}
          message={phase.message}
          hint={phase.hint}
          log={progress.log}
          onRetry={() => setPhase({ kind: "form" })}
        />
      )}

      {phase.kind === "done" && (
        <DonePanel
          server={phase.server}
          database={
            values && isNewDatabase(values.database)
              ? values.database.trim()
              : null
          }
          onContinue={() => onInstalled(phase.server)}
        />
      )}
    </div>
  );
}
