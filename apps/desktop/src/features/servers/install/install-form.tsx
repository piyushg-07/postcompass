import {
  Button,
  Field,
  Input,
  PasswordInput,
  Select,
  Switch,
  toast,
} from "@repo/ui";
import { useDebouncedValue } from "@tanstack/react-pacer";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useAppState } from "../../../app/app-state";
import { generatePassword, platformLabel } from "../../../lib/format";
import { commands, describeError, unwrap } from "../../../lib/ipc";
import { queryKeys } from "../../../lib/query";

export interface FormValues {
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
export const isNewDatabase = (name: string) =>
  name.trim() !== "" && name.trim() !== "postgres";

/** A plain database name: letters, digits and underscores, so it never needs quoting. */
const DATABASE_NAME = /^[a-z_][a-z0-9_]{0,62}$/;

/** Options form: version, name, database, port, password. */
export function InstallForm({
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
