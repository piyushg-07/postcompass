import {
  Button,
  Field,
  Input,
  LogViewer,
  Select,
  PasswordInput,
  Progress,
  Switch,
  TaskSteps,
  type TaskStepState,
  toast,
} from "@repo/ui";
import { useDebouncedValue } from "@tanstack/react-pacer";
import { useQuery } from "@tanstack/react-query";
import { Channel } from "@tauri-apps/api/core";
import { AlertTriangle, CheckCircle2, ChevronDown, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type {
  InstallEvent,
  InstallStep,
  ManagedServer,
} from "../../lib/bindings";
import { useAppState } from "../../app/app-state";
import { formatMb, generatePassword, platformLabel } from "../../lib/format";
import { commands, describeError, isCancelled, unwrap } from "../../lib/ipc";
import { queryKeys } from "../../lib/query";

const STEP_LABELS: Record<InstallStep, string> = {
  check_system: "Checking system",
  download: "Downloading PostgreSQL",
  verify: "Verifying checksum",
  extract: "Extracting files",
  initialize: "Setting up the server",
  start: "Starting the server",
  connect: "Connecting",
};
const STEP_ORDER = Object.keys(STEP_LABELS) as InstallStep[];
/** Only needed when the version isn't on this computer yet. */
const DOWNLOAD_STEPS = new Set<InstallStep>(["download", "verify", "extract"]);

interface FormValues {
  name: string;
  version: string;
  port: number;
  password: string;
  autoStart: boolean;
  /** Created once the server runs; empty means only the built-in `postgres` database. */
  database: string;
  /** The version is already on this computer, so nothing is downloaded. */
  installed: boolean;
}

/** A name other than the built-in `postgres`, which the setup creates for you. */
const isNewDatabase = (name: string) =>
  name.trim() !== "" && name.trim() !== "postgres";

/** A plain database name: letters, digits and underscores, so it never needs quoting. */
const DATABASE_NAME = /^[a-z_][a-z0-9_]{0,62}$/;

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
  const [phase, setPhase] = useState<Phase>({ kind: "form" });
  const [values, setValues] = useState<FormValues | null>(null);
  const progress = useInstallProgress();
  const stage = phase.kind === "form" ? "form" : "progress";
  useEffect(() => onStageChange?.(stage), [stage, onStageChange]);

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
      onBusyChange?.(false);
    }
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
          <Button variant="ghost" onClick={() => void commands.cancelInstall()}>
            {values?.installed ? "Cancel" : "Cancel install"}
          </Button>
        </div>
      )}

      {phase.kind === "failed" && (
        <div className="flex flex-col gap-3 rounded-card border border-danger/30 bg-danger/5 p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" />
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="text-sm font-medium text-fg">{phase.title}</span>
              <span className="text-xs break-words whitespace-pre-wrap text-fg-muted">
                {phase.message}
              </span>
              {phase.hint && (
                <span className="text-xs text-fg">{phase.hint}</span>
              )}
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
                  .writeText(
                    `${phase.title}\n${phase.message}\n\n${progress.log.join("\n")}`,
                  )
                  .then(() => toast.success("Error details copied"))
              }
            >
              Copy details
            </Button>
            <Button
              size="sm"
              variant="primary"
              onClick={() => setPhase({ kind: "form" })}
            >
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
              <span className="text-sm font-medium text-fg">
                PostgreSQL {phase.server.version} is running
              </span>
              <span className="font-mono text-xs text-fg-muted">
                {phase.server.host}:{phase.server.port} · user{" "}
                {phase.server.superuser}
              </span>
              {values && isNewDatabase(values.database) && (
                <span className="text-xs text-fg-muted">
                  Database{" "}
                  <span className="font-mono text-fg">
                    {values.database.trim()}
                  </span>{" "}
                  is ready to use.
                </span>
              )}
              <span className="text-xs text-fg-subtle">
                The password is saved in your system keychain.
              </span>
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              size="sm"
              variant="primary"
              onClick={() => onInstalled(phase.server)}
            >
              Continue
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Details({
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

/* ── Progress state ───────────────────────────────────────────────────── */

function useInstallProgress() {
  const [states, setStates] = useState<
    Partial<Record<InstallStep, { state: TaskStepState; detail?: string }>>
  >({});
  const [download, setDownload] = useState<{
    downloaded: number;
    total: number | null;
  } | null>(null);
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
        setStates((s) => ({
          ...s,
          [event.step]: { state, detail: event.detail ?? undefined },
        }));
        break;
      }
      case "download":
        setDownload({ downloaded: event.downloaded ?? 0, total: event.total });
        break;
      case "log":
        setLog((l) =>
          l.length > 500 ? [...l.slice(-400), event.line] : [...l, event.line],
        );
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
  const [values, setValues] = useState<FormValues>(
    initial ?? {
      name: "",
      version: "",
      port: 5432,
      password: generatePassword(),
      autoStart: true,
      database: "postgres",
      installed: false,
    },
  );
  const nameTouched = useRef(Boolean(initial));
  const [advanced, setAdvanced] = useState(false);
  // "Local PostgreSQL 18", or "… (2)" when that name is already taken
  const { state, info } = useAppState();
  const platform = platformLabel(info.os, info.arch);
  const defaultName = (version: string) => {
    const base = `Local PostgreSQL ${version.split(".")[0]}`;
    const taken = new Set(state.servers.map((x) => x.name));
    let name = base;
    for (let n = 2; taken.has(name); n++) name = `${base} (${n})`;
    return name;
  };

  const versionsQuery = useQuery({
    queryKey: queryKeys.runtimeVersions("postgres"),
    queryFn: () => unwrap(commands.runtimeVersions("postgres")),
    staleTime: Infinity,
  });
  const suggestedPort = useQuery({
    queryKey: queryKeys.suggestedPort("postgres"),
    queryFn: () => unwrap(commands.suggestPort("postgres")),
    enabled: !initial,
    staleTime: 0,
  });
  const versions = versionsQuery.data ?? [];

  // Fill in defaults once the options arrive
  useEffect(() => {
    if (!versionsQuery.data) return;
    setValues((v) => {
      const version =
        v.version ||
        versionsQuery.data.find((x) => x.recommended)?.version ||
        versionsQuery.data[0]?.version ||
        "";
      return {
        ...v,
        version,
        name: nameTouched.current ? v.name : defaultName(version),
      };
    });
  }, [versionsQuery.data]);
  useEffect(() => {
    if (suggestedPort.data)
      setValues((v) => ({ ...v, port: suggestedPort.data }));
  }, [suggestedPort.data]);
  useEffect(() => {
    const error = versionsQuery.error ?? suggestedPort.error;
    if (error)
      toast.error("Couldn't load install options", {
        description: describeError(error).message,
      });
  }, [versionsQuery.error, suggestedPort.error]);

  // Live port check, debounced so typing doesn't fire a check per keystroke
  const portValid =
    Number.isInteger(values.port) &&
    values.port >= 1024 &&
    values.port <= 65535;
  const [debouncedPort] = useDebouncedValue(values.port, { wait: 250 });
  const portCheck = useQuery({
    queryKey: ["port-free", debouncedPort],
    queryFn: () => commands.isPortFree(debouncedPort),
    enabled: portValid && debouncedPort === values.port,
    staleTime: 0,
    gcTime: 0,
  });
  const portFree =
    portValid && debouncedPort === values.port && portCheck.isSuccess
      ? portCheck.data
      : null;

  const set = <K extends keyof FormValues>(key: K, value: FormValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  const portError = !portValid
    ? "Use a port between 1024 and 65535"
    : portFree === false
      ? `Port ${values.port} is in use. Try ${values.port + 1}.`
      : undefined;
  const passwordError =
    values.password.length < 8 ? "At least 8 characters" : undefined;
  const nameError = values.name.trim() ? undefined : "Give the server a name";
  const databaseError =
    values.database.trim() && !DATABASE_NAME.test(values.database.trim())
      ? "Lowercase letters, numbers and _ only, starting with a letter"
      : undefined;
  const canSubmit =
    Boolean(values.version) &&
    !portError &&
    !passwordError &&
    !nameError &&
    !databaseError &&
    portFree === true;
  const selected = versions.find((v) => v.version === values.version);
  // Already on this computer: nothing to download, just a new server
  const installed = selected?.installed === true;
  const database = values.database.trim();

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (canSubmit) onSubmit({ ...values, installed });
      }}
    >
      {/* No prebuilt binaries for this OS / chip, so there's nothing to pick */}
      {versionsQuery.isSuccess && versions.length === 0 && (
        <div className="flex items-start gap-2.5 rounded-card border border-warning/40 bg-warning/10 px-3.5 py-3 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
          <p className="text-fg-muted">
            <span className="font-medium text-fg">PostgreSQL can't be installed on {platform} yet.</span> Supported
            systems are Windows (x64), macOS and Linux (x64 / ARM64). You can still connect to an existing server
            with <span className="text-fg">Add remote connection</span>.
          </p>
        </div>
      )}

      <Field
        label="Version"
        hint={
          installed
            ? "Already installed"
            : selected?.downloadMb
              ? `${selected.downloadMb} MB download for ${platform}`
              : undefined
        }
      >
        {(p) => (
          <Select
            {...p}
            value={values.version}
            onValueChange={(version) => {
              setValues((v) => ({
                ...v,
                version,
                name: nameTouched.current ? v.name : defaultName(version),
              }));
            }}
            options={versions.map((v) => ({
              value: v.version,
              label: `PostgreSQL ${v.version}`,
              hint: v.installed
                ? "installed"
                : v.recommended
                  ? "recommended"
                  : undefined,
            }))}
          />
        )}
      </Field>

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

      <div className="grid grid-cols-[1fr_9rem] gap-3">
        <Field
          label="Database"
          error={databaseError}
          hint={
            databaseError
              ? undefined
              : isNewDatabase(database)
                ? "Created for you"
                : "Built in"
          }
        >
          {(p) => (
            <Input
              {...p}
              className="font-mono"
              spellCheck={false}
              placeholder="postgres"
              value={values.database}
              onChange={(e) => set("database", e.target.value.toLowerCase())}
            />
          )}
        </Field>
        <Field
          label="Port"
          error={portError}
          hint={portFree ? "Available" : undefined}
        >
          {(p) => (
            <Input
              {...p}
              type="number"
              inputMode="numeric"
              className="font-mono [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              value={Number.isNaN(values.port) ? "" : values.port}
              onChange={(e) => set("port", e.target.valueAsNumber)}
            />
          )}
        </Field>
      </div>

      <Field
        label="Password"
        error={passwordError}
        hint="For user postgres. Saved in your system keychain."
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

      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={() => setAdvanced((o) => !o)}
          aria-expanded={advanced}
          className="flex w-fit cursor-pointer items-center gap-1 text-xs text-fg-muted hover:text-fg"
        >
          <ChevronDown
            className={`size-3.5 transition-transform ${advanced ? "" : "-rotate-90"}`}
          />
          Advanced
        </button>
        {advanced && (
          <label className="flex cursor-pointer items-center justify-between gap-3 rounded-card border border-border bg-surface px-3 py-2.5">
            <span className="flex flex-col">
              <span className="text-sm text-fg">Start with PostCompass</span>
              <span className="text-xs text-fg-muted">
                Runs the server whenever the app is open.
              </span>
            </span>
            <Switch
              checked={values.autoStart}
              onCheckedChange={(checked) => set("autoStart", checked)}
            />
          </label>
        )}
      </div>

      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button variant="ghost" onClick={onCancel}>
            {cancelLabel}
          </Button>
        )}
        <Button type="submit" variant="primary" disabled={!canSubmit}>
          {installed ? "Create server" : "Install PostgreSQL"}
        </Button>
      </div>
    </form>
  );
}
