import {
  Button,
  Field,
  Input,
  LogViewer,
  NativeSelect,
  PasswordInput,
  Progress,
  Switch,
  TaskSteps,
  type TaskStepState,
  toast,
} from "@repo/ui";
import { Channel } from "@tauri-apps/api/core";
import { AlertTriangle, CheckCircle2, ChevronDown, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { InstallEvent, InstallStep, ManagedServer, RuntimeVersion } from "../../lib/bindings";
import { formatMb, generatePassword } from "../../lib/format";
import { commands, describeError, isCancelled, unwrap } from "../../lib/ipc";

const STEP_LABELS: Record<InstallStep, string> = {
  check_system: "Checking system",
  download: "Downloading PostgreSQL",
  verify: "Verifying checksum",
  extract: "Extracting files",
  initialize: "Setting up database",
  start: "Starting server",
  connect: "Connecting",
};
const STEP_ORDER = Object.keys(STEP_LABELS) as InstallStep[];

interface FormValues {
  name: string;
  version: string;
  port: number;
  password: string;
  autoStart: boolean;
}

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
  cancelLabel = "Cancel",
}: {
  onInstalled: (server: ManagedServer) => void;
  onCancel?: () => void;
  /** True while an install is running, so containers can block closing. */
  onBusyChange?: (busy: boolean) => void;
  cancelLabel?: string;
}) {
  const [phase, setPhase] = useState<Phase>({ kind: "form" });
  const [values, setValues] = useState<FormValues | null>(null);
  const progress = useInstallProgress();

  const install = async (form: FormValues) => {
    setValues(form);
    progress.reset();
    setPhase({ kind: "installing" });
    onBusyChange?.(true);

    const channel = new Channel<InstallEvent>();
    channel.onmessage = progress.handle;
    try {
      const server = await unwrap(
        commands.installServer(
          "postgres",
          { ...form, dataDir: null, name: form.name.trim() },
          channel,
        ),
      );
      setPhase({ kind: "done", server });
      toast.success("PostgreSQL is running", { description: `${server.name} on port ${server.port}` });
    } catch (e) {
      if (isCancelled(e)) {
        toast.info("Install cancelled", { description: "Everything was cleaned up." });
        setPhase({ kind: "form" });
      } else {
        setPhase({ kind: "failed", ...describeError(e) });
      }
    } finally {
      onBusyChange?.(false);
    }
  };

  if (phase.kind === "form") {
    return <InstallForm initial={values} onSubmit={install} onCancel={onCancel} cancelLabel={cancelLabel} />;
  }

  return (
    <div className="flex flex-col gap-4">
      <TaskSteps steps={progress.steps} />
      {progress.download && phase.kind === "installing" && progress.activeStep === "download" && (
        <div className="flex flex-col gap-1.5">
          <Progress
            label="Download progress"
            value={progress.download.total ? (progress.download.downloaded / progress.download.total) * 100 : undefined}
          />
          <span className="font-mono text-xs text-fg-subtle">
            {formatMb(progress.download.downloaded)}
            {progress.download.total ? ` / ${formatMb(progress.download.total)}` : ""}
          </span>
        </div>
      )}

      <Details lines={progress.log} defaultOpen={phase.kind === "failed"} />

      {phase.kind === "installing" && (
        <div className="flex justify-end">
          <Button variant="ghost" onClick={() => void commands.cancelInstall()}>
            Cancel install
          </Button>
        </div>
      )}

      {phase.kind === "failed" && (
        <div className="flex flex-col gap-3 rounded-card border border-danger/30 bg-danger/5 p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" />
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="text-sm font-medium text-fg">{phase.title}</span>
              <span className="text-xs break-words whitespace-pre-wrap text-fg-muted">{phase.message}</span>
              {phase.hint && <span className="text-xs text-fg">{phase.hint}</span>}
              <span className="text-xs text-fg-subtle">Nothing was left behind. You can safely try again.</span>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              iconLeft={<Copy />}
              onClick={() =>
                void navigator.clipboard
                  .writeText(`${phase.title}\n${phase.message}\n\n${progress.log.join("\n")}`)
                  .then(() => toast.success("Error details copied"))
              }
            >
              Copy details
            </Button>
            <Button size="sm" variant="primary" onClick={() => setPhase({ kind: "form" })}>
              Try again
            </Button>
          </div>
        </div>
      )}

      {phase.kind === "done" && (
        <div className="flex flex-col gap-3 rounded-card border border-accent/30 bg-accent-muted p-3">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-accent" />
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium text-fg">PostgreSQL {phase.server.version} is running</span>
              <span className="font-mono text-xs text-fg-muted">
                {phase.server.host}:{phase.server.port} · user {phase.server.superuser}
              </span>
              <span className="text-xs text-fg-subtle">The password is saved in your system keychain.</span>
            </div>
          </div>
          <div className="flex justify-end">
            <Button size="sm" variant="primary" onClick={() => onInstalled(phase.server)}>
              Continue
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Details({ lines, defaultOpen }: { lines: string[]; defaultOpen: boolean }) {
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
        <ChevronDown className={`size-3.5 transition-transform ${open ? "" : "-rotate-90"}`} />
        {open ? "Hide details" : "Show details"}
      </button>
      {open && <LogViewer lines={lines} />}
    </div>
  );
}

/* ── Progress state ───────────────────────────────────────────────────── */

function useInstallProgress() {
  const [states, setStates] = useState<Partial<Record<InstallStep, { state: TaskStepState; detail?: string }>>>({});
  const [download, setDownload] = useState<{ downloaded: number; total: number | null } | null>(null);
  const [log, setLog] = useState<string[]>([]);

  const handle = (event: InstallEvent) => {
    switch (event.type) {
      case "step": {
        const state: TaskStepState =
          event.state === "active"
            ? "active"
            : event.state === "done"
              ? "done"
              : event.state === "skipped"
                ? "skipped"
                : "error";
        setStates((s) => ({ ...s, [event.step]: { state, detail: event.detail ?? undefined } }));
        break;
      }
      case "download":
        setDownload({ downloaded: event.downloaded ?? 0, total: event.total });
        break;
      case "log":
        setLog((l) => (l.length > 500 ? [...l.slice(-400), event.line] : [...l, event.line]));
        break;
    }
  };

  const reset = () => {
    setStates({});
    setDownload(null);
    setLog([]);
  };

  const steps = STEP_ORDER.map((id) => ({
    id,
    label: STEP_LABELS[id],
    state: states[id]?.state ?? ("pending" as const),
    detail: states[id]?.detail,
  }));
  const activeStep = STEP_ORDER.find((id) => states[id]?.state === "active");

  return { steps, download, log, handle, reset, activeStep };
}

/* ── Options form ─────────────────────────────────────────────────────── */

function InstallForm({
  initial,
  onSubmit,
  onCancel,
  cancelLabel,
}: {
  initial: FormValues | null;
  onSubmit: (values: FormValues) => void;
  onCancel?: () => void;
  cancelLabel: string;
}) {
  const [versions, setVersions] = useState<RuntimeVersion[]>([]);
  const [values, setValues] = useState<FormValues>(
    initial ?? { name: "", version: "", port: 5432, password: generatePassword(), autoStart: true },
  );
  const [portFree, setPortFree] = useState<boolean | null>(null);
  const nameTouched = useRef(Boolean(initial));

  useEffect(() => {
    Promise.all([unwrap(commands.runtimeVersions("postgres")), initial ? null : unwrap(commands.suggestPort("postgres"))])
      .then(([versions, port]) => {
        setVersions(versions);
        setValues((v) => {
          const version = v.version || versions.find((x) => x.recommended)?.version || versions[0]?.version || "";
          return {
            ...v,
            version,
            port: port ?? v.port,
            name: nameTouched.current ? v.name : `Local PostgreSQL ${version.split(".")[0]}`,
          };
        });
      })
      .catch((e: unknown) => toast.error("Couldn't load install options", { description: describeError(e).message }));
  }, [initial]);

  // Live port check, debounced
  useEffect(() => {
    setPortFree(null);
    if (!Number.isInteger(values.port) || values.port < 1024 || values.port > 65535) return;
    const timer = setTimeout(() => void commands.isPortFree(values.port).then(setPortFree), 250);
    return () => clearTimeout(timer);
  }, [values.port]);

  const set = <K extends keyof FormValues>(key: K, value: FormValues[K]) => setValues((v) => ({ ...v, [key]: value }));

  const portError =
    !Number.isInteger(values.port) || values.port < 1024 || values.port > 65535
      ? "Use a port between 1024 and 65535"
      : portFree === false
        ? `Port ${values.port} is in use. Try ${values.port + 1}.`
        : undefined;
  const passwordError = values.password.length < 8 ? "At least 8 characters" : undefined;
  const nameError = values.name.trim() ? undefined : "Give the server a name";
  const canSubmit = Boolean(values.version) && !portError && !passwordError && !nameError && portFree === true;
  const selected = versions.find((v) => v.version === values.version);

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (canSubmit) onSubmit(values);
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Version" hint={selected?.downloadMb ? `About ${selected.downloadMb} MB download` : undefined}>
          {(p) => (
            <NativeSelect
              {...p}
              value={values.version}
              onChange={(e) => {
                const version = e.target.value;
                setValues((v) => ({
                  ...v,
                  version,
                  name: nameTouched.current ? v.name : `Local PostgreSQL ${version.split(".")[0]}`,
                }));
              }}
            >
              {versions.map((v) => (
                <option key={v.version} value={v.version}>
                  PostgreSQL {v.version}
                  {v.recommended ? " (recommended)" : ""}
                </option>
              ))}
            </NativeSelect>
          )}
        </Field>
        <Field label="Port" error={portError} hint={portFree ? "Available" : undefined}>
          {(p) => (
            <Input
              {...p}
              type="number"
              inputMode="numeric"
              className="font-mono"
              value={Number.isNaN(values.port) ? "" : values.port}
              onChange={(e) => set("port", e.target.valueAsNumber)}
            />
          )}
        </Field>
      </div>

      <Field label="Name" error={nameError}>
        {(p) => (
          <Input
            {...p}
            value={values.name}
            onChange={(e) => {
              nameTouched.current = true;
              set("name", e.target.value);
            }}
          />
        )}
      </Field>

      <Field
        label="Password for user postgres"
        error={passwordError}
        hint="Generated for you and saved in your system keychain."
      >
        {(p) => (
          <PasswordInput
            {...p}
            value={values.password}
            onChange={(e) => set("password", e.target.value)}
            onGenerate={() => set("password", generatePassword())}
          />
        )}
      </Field>

      <label className="flex cursor-pointer items-center justify-between gap-3 rounded-card border border-border bg-surface px-3 py-2.5">
        <span className="flex flex-col">
          <span className="text-sm text-fg">Start with PostCompass</span>
          <span className="text-xs text-fg-muted">Starts the server automatically when you open the app.</span>
        </span>
        <Switch checked={values.autoStart} onCheckedChange={(checked) => set("autoStart", checked)} />
      </label>

      <p className="text-xs text-fg-subtle">
        Installed in PostCompass's own folder, listening only on this computer (127.0.0.1). No admin rights needed.
      </p>

      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button variant="ghost" onClick={onCancel}>
            {cancelLabel}
          </Button>
        )}
        <Button type="submit" variant="primary" disabled={!canSubmit}>
          Install PostgreSQL
        </Button>
      </div>
    </form>
  );
}
