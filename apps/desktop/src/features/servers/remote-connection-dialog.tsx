/**
 * Add / Edit remote connection dialog.
 *
 * Provider selection is a Supabase-style icon-grid popover:
 * click the trigger → floating panel with provider tiles → click to select.
 *
 * Supports every cloud Postgres flavour:
 *   AWS RDS / Aurora, GCP Cloud SQL, Azure, Cloudflare Hyperdrive, Alibaba Cloud,
 *   Oracle Cloud, DigitalOcean, Heroku Postgres, Neon, Railway, Render, and any
 *   self-hosted endpoint.
 */

import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  Field,
  Input,
  PasswordInput,
  Popover,
  PopoverContent,
  PopoverTrigger,
  toast,
} from "@repo/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { open as openFile } from "@tauri-apps/plugin-dialog";
import { Check, ChevronDown, Cloud, DatabaseZap, FlaskConical } from "lucide-react";
import { useEffect, useState } from "react";
import { useAppState } from "../../app/app-state";
import { useNavigation } from "../../app/navigation";
import type { RemoteConnection, SslMode } from "../../lib/bindings";
import { commands, describeError, unwrap } from "../../lib/ipc";
import { queryKeys } from "../../lib/query";
import { ProviderLogo } from "./provider-logos";

// ── Provider definitions ──────────────────────────────────────────────────────

type Provider = {
  id: string;
  label: string;
  shortLabel: string;
  defaultSsl: SslMode;
  hostHint?: string;
  /** When the provider doesn't listen on 5432. */
  defaultPort?: number;
};

const PROVIDERS: Provider[] = [
  { id: "aws",          label: "AWS RDS / Aurora",              shortLabel: "AWS RDS",      defaultSsl: "require",  hostHint: "e.g. mydb.us-east-1.rds.amazonaws.com" },
  { id: "gcp",          label: "Google Cloud SQL",              shortLabel: "Cloud SQL",    defaultSsl: "require",  hostHint: "e.g. 34.xx.xx.xx (Cloud SQL public IP)" },
  { id: "azure",        label: "Azure Database for PostgreSQL", shortLabel: "Azure DB",     defaultSsl: "require",  hostHint: "e.g. myserver.postgres.database.azure.com" },
  { id: "cloudflare",   label: "Cloudflare Hyperdrive",         shortLabel: "Hyperdrive",   defaultSsl: "require",  hostHint: "e.g. <UUID>.hyperdrive.io" },
  { id: "alibaba",      label: "Alibaba Cloud (RDS / PolarDB)", shortLabel: "Alibaba",      defaultSsl: "require",  hostHint: "e.g. pgm-xxxx.pg.rds.aliyuncs.com" },
  { id: "oracle",       label: "Oracle Cloud (OCI)",            shortLabel: "Oracle",       defaultSsl: "require",  hostHint: "e.g. your DB system's endpoint or private IP" },
  { id: "digitalocean", label: "DigitalOcean",                  shortLabel: "DigitalOcean", defaultSsl: "require",  hostHint: "e.g. db-postgresql-nyc3-12345-do-user-0.db.ondigitalocean.com", defaultPort: 25060 },
  { id: "heroku",       label: "Heroku Postgres",               shortLabel: "Heroku",       defaultSsl: "require",  hostHint: "e.g. ec2-xx-xx-xx-xx.compute-1.amazonaws.com" },
  { id: "neon",         label: "Neon",                          shortLabel: "Neon",         defaultSsl: "require",  hostHint: "e.g. ep-xxxx.us-east-2.aws.neon.tech" },
  { id: "railway",      label: "Railway",                       shortLabel: "Railway",      defaultSsl: "require",  hostHint: "e.g. roundhouse.proxy.rlwy.net" },
  { id: "render",       label: "Render",                        shortLabel: "Render",       defaultSsl: "require",  hostHint: "e.g. dpg-xxx.render.com" },
  { id: "other",        label: "Other / Self-hosted",           shortLabel: "PostgreSQL",   defaultSsl: "prefer" },
];


const SSL_OPTIONS: { value: SslMode; label: string; short: string; description: string; color: string }[] = [
  {
    value: "disable",
    label: "Off",
    short: "Not encrypted",
    description: "No encryption. Only for databases on this computer or a private network you trust.",
    color: "text-fg-muted",
  },
  {
    value: "prefer",
    label: "Prefer",
    short: "Encrypted if supported",
    description: "Encrypts when the server supports it, otherwise connects without encryption.",
    color: "text-amber-500",
  },
  {
    value: "require",
    label: "Require",
    short: "Encrypted",
    description: "Always encrypted. Recommended for cloud databases; the server's certificate isn't checked.",
    color: "text-blue-500",
  },
  {
    value: "verify_full",
    label: "Verify certificate",
    short: "Encrypted + verified",
    description: "Always encrypted, and checks the server really is who it claims to be. Most secure.",
    color: "text-success",
  },
];

// ── SSL icon ──────────────────────────────────────────────────────────────────

function SslIcon({ value, className }: { value: SslMode; className?: string }) {
  if (value === "disable")
    return (
      <svg viewBox="0 0 16 16" fill="none" className={className}>
        <rect x="4" y="7" width="8" height="6" rx="1" stroke="currentColor" strokeWidth="1.3"/>
        <path d="M10 7V5a2 2 0 0 0-4 0" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
        <line x1="3" y1="3" x2="13" y2="13" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
      </svg>
    );
  if (value === "prefer")
    return (
      <svg viewBox="0 0 16 16" fill="none" className={className}>
        <rect x="4" y="7" width="8" height="6" rx="1" stroke="currentColor" strokeWidth="1.3"/>
        <path d="M10 7V5a2 2 0 0 0-4 0v2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
        <circle cx="8" cy="10" r="1" fill="currentColor" opacity="0.4"/>
      </svg>
    );
  if (value === "require")
    return (
      <svg viewBox="0 0 16 16" fill="none" className={className}>
        <rect x="4" y="7" width="8" height="6" rx="1" stroke="currentColor" strokeWidth="1.3"/>
        <path d="M10 7V5a2 2 0 0 0-4 0v2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
        <circle cx="8" cy="10" r="1" fill="currentColor"/>
      </svg>
    );
  // verify_full
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className}>
      <rect x="4" y="7" width="8" height="6" rx="1" stroke="currentColor" strokeWidth="1.3"/>
      <path d="M10 7V5a2 2 0 0 0-4 0v2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
      <path d="M6.5 10.2l1 1L9.5 9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// ── SSL picker ────────────────────────────────────────────────────────────────

function SslPicker({
  value,
  onChange,
}: {
  value: SslMode;
  onChange: (v: SslMode) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = SSL_OPTIONS.find((o) => o.value === value) ?? SSL_OPTIONS[2];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-8 w-full items-center gap-2 rounded-control border border-border-strong bg-bg px-2.5 text-sm text-fg transition-colors hover:border-accent/60 focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/25"
        >
          <SslIcon value={value} className={`size-3.5 shrink-0 ${selected.color}`} />
          <span className="flex-1 truncate text-left">{selected.label}</span>
          <ChevronDown className={`size-3.5 shrink-0 text-fg-subtle transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-1.5" align="start">
        {SSL_OPTIONS.map((opt) => {
          const isSelected = opt.value === value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={`flex w-full items-start gap-3 rounded-control px-3 py-2.5 text-left transition-colors ${
                isSelected
                  ? "bg-accent/10 text-fg"
                  : "text-fg-muted hover:bg-surface-hover hover:text-fg"
              }`}
            >
              <SslIcon value={opt.value} className={`mt-0.5 size-4 shrink-0 ${isSelected ? opt.color : "text-fg-subtle"}`} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-fg">{opt.label}</span>
                  {isSelected && <Check className="size-3.5 shrink-0 text-accent" strokeWidth={2.5} />}
                </div>
                <p className="mt-0.5 text-xs text-fg-subtle leading-snug">{opt.description}</p>
              </div>
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}

// ── Provider picker ───────────────────────────────────────────────────────────

function ProviderPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = PROVIDERS.find((p) => p.id === value) ?? PROVIDERS[PROVIDERS.length - 1];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-8 w-full items-center gap-2.5 rounded-control border border-border-strong bg-bg px-2.5 text-sm text-fg transition-colors hover:border-accent/60 focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/25"
        >
          <span className="flex shrink-0 items-center">
            <ProviderLogo provider={selected.id} className="size-4" />
          </span>
          <span className="flex-1 truncate text-left">{selected.label}</span>
          <ChevronDown className={`size-3.5 shrink-0 text-fg-subtle transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-3" align="start">
        <p className="mb-2.5 px-0.5 text-[11px] font-medium tracking-wide text-fg-subtle uppercase">
          Select a provider
        </p>
        <div className="grid grid-cols-3 gap-1.5">
          {PROVIDERS.map((p) => {
            const isSelected = p.id === value;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  onChange(p.id);
                  setOpen(false);
                }}
                className={`group relative flex flex-col items-start gap-2 rounded-control border px-3 py-2.5 text-left transition-all ${
                  isSelected
                    ? "border-accent bg-accent/8 text-fg"
                    : "border-border bg-bg text-fg-muted hover:border-border-strong hover:bg-surface-hover hover:text-fg"
                }`}
              >
                {/* Check mark */}
                {isSelected && (
                  <span className="absolute top-2 right-2 flex size-4 items-center justify-center rounded-full bg-accent text-white">
                    <Check className="size-2.5" strokeWidth={3} />
                  </span>
                )}
                <span className="flex items-center justify-center">
                  <ProviderLogo provider={p.id} className="size-5" />
                </span>
                <span className="text-xs font-medium leading-tight">{p.shortLabel}</span>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ── Form state ────────────────────────────────────────────────────────────────

interface FormState {
  name: string;
  provider: string;
  host: string;
  port: string;
  user: string;
  password: string;
  database: string;
  sslMode: SslMode;
  caCert: string;
}

function empty(provider = PROVIDERS[0]): FormState {
  return {
    name: "",
    provider: provider.id,
    host: "",
    port: String(provider.defaultPort ?? 5432),
    user: "postgres",
    password: "",
    database: "postgres",
    sslMode: provider.defaultSsl,
    caCert: "",
  };
}

function fromExisting(rc: RemoteConnection): FormState {
  return {
    name: rc.name,
    provider: rc.provider,
    host: rc.host,
    port: String(rc.port),
    user: rc.user,
    password: "",
    database: rc.database,
    sslMode: rc.sslMode,
    caCert: rc.caCert ?? "",
  };
}

// ── Dialog ────────────────────────────────────────────────────────────────────

export function RemoteConnectionDialog() {
  const { state, setState } = useAppState();
  const remoteDialogOpen = useNavigation((s) => s.remoteDialogOpen);
  const editingRemoteId = useNavigation((s) => s.editingRemoteId);
  const remoteDraft = useNavigation((s) => s.remoteDraft);
  const closeRemoteDialog = useNavigation((s) => s.closeRemoteDialog);

  const existing = editingRemoteId
    ? state.remoteConnections.find((r) => r.id === editingRemoteId) ?? null
    : null;

  const [form, setForm] = useState<FormState>(empty());
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (remoteDialogOpen) {
      setForm(
        existing
          ? fromExisting(existing)
          : remoteDraft
            ? { ...empty(PROVIDERS[PROVIDERS.length - 1]), ...remoteDraft, port: String(remoteDraft.port) }
            : empty(),
      );
      setTestResult(null);
    }
  }, [remoteDialogOpen, editingRemoteId, remoteDraft]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const selectedProvider = PROVIDERS.find((p) => p.id === form.provider) ?? PROVIDERS[PROVIDERS.length - 1];

  const onProviderChange = (id: string) => {
    const p = PROVIDERS.find((pr) => pr.id === id) ?? PROVIDERS[PROVIDERS.length - 1];
    setForm((f) => {
      // Follow the provider's port unless the user typed their own
      const previousDefault = String(PROVIDERS.find((pr) => pr.id === f.provider)?.defaultPort ?? 5432);
      const port = f.port === previousDefault ? String(p.defaultPort ?? 5432) : f.port;
      return { ...f, provider: id, sslMode: p.defaultSsl, port };
    });
  };

  const queryClient = useQueryClient();

  const saveMutation = useMutation({
    mutationFn: async () => {
      const req = {
        name: form.name.trim() || `${selectedProvider.label} connection`,
        host: form.host.trim(),
        port: parseInt(form.port, 10) || 5432,
        user: form.user.trim(),
        password: form.password,
        database: form.database.trim(),
        sslMode: form.sslMode,
        caCert: form.sslMode === "verify_full" ? form.caCert.trim() || null : null,
        provider: form.provider,
      };
      if (existing) return unwrap(commands.updateRemoteConnection(existing.id, req));
      return unwrap(commands.addRemoteConnection(req));
    },
    onSuccess: (newState) => {
      setState(newState);
      queryClient.invalidateQueries({ queryKey: queryKeys.appState });
      toast.success(existing ? "Connection updated" : "Remote connection saved");
      closeRemoteDialog();
    },
    onError: (e: unknown) => {
      const { title, message } = describeError(e);
      toast.error(title, { description: message });
    },
  });

  const testConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await unwrap(
        commands.testRemoteConnection({
          name: form.name || "test",
          host: form.host.trim(),
          port: parseInt(form.port, 10) || 5432,
          user: form.user.trim(),
          // Left empty while editing → the saved password is used
          password: form.password,
          database: form.database.trim(),
          sslMode: form.sslMode,
          caCert: form.sslMode === "verify_full" ? form.caCert.trim() || null : null,
          provider: form.provider,
        }, existing?.id ?? null),
      );
      setTestResult({ ok: true, message: `Connected · PostgreSQL ${result.serverVersion} · ${result.latencyMs} ms` });
    } catch (e) {
      const { message } = describeError(e);
      setTestResult({ ok: false, message });
    } finally {
      setTesting(false);
    }
  };

  const valid = form.host.trim().length > 0 && form.user.trim().length > 0;
  const needsPassword = !existing && form.password.length === 0;

  return (
    <Dialog open={remoteDialogOpen} onOpenChange={(open) => !saveMutation.isPending && !open && closeRemoteDialog()}>
      <DialogContent
        title={existing ? "Edit remote connection" : "Add remote connection"}
        description="Connect to any PostgreSQL database on a cloud provider or self-hosted server."
        className="w-[520px]"
        hideClose={saveMutation.isPending}
      >
        <div className="flex flex-col gap-4 py-1">

          {/* Provider picker */}
          <Field label="Provider">
            {() => (
              <ProviderPicker value={form.provider} onChange={onProviderChange} />
            )}
          </Field>

          {/* Display name */}
          <Field label="Display name" hint="How it appears in the sidebar">
            {(fp) => (
              <Input
                {...fp}
                placeholder={`${selectedProvider.label} connection`}
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
              />
            )}
          </Field>

          {/* Host + Port */}
          <div className="flex gap-3">
            <Field label="Host" className="flex-1">
              {(fp) => (
                <Input
                  {...fp}
                  placeholder={selectedProvider.hostHint ?? "hostname or IP"}
                  value={form.host}
                  onChange={(e) => set("host", e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                />
              )}
            </Field>
            <Field label="Port" className="w-24">
              {(fp) => (
                <Input
                  {...fp}
                  type="number"
                  min={1}
                  max={65535}
                  value={form.port}
                  onChange={(e) => set("port", e.target.value)}
                />
              )}
            </Field>
          </div>

          {/* User + Password */}
          <div className="flex gap-3">
            <Field label="Username" className="flex-1">
              {(fp) => (
                <Input
                  {...fp}
                  placeholder="postgres"
                  value={form.user}
                  onChange={(e) => set("user", e.target.value)}
                  autoComplete="username"
                  spellCheck={false}
                />
              )}
            </Field>
            <Field
              label="Password"
              className="flex-1"
              hint={existing ? "Leave blank to keep the saved one" : undefined}
            >
              {(fp) => (
                <PasswordInput
                  {...fp}
                  placeholder={existing ? "••••••••" : "Password"}
                  value={form.password}
                  onChange={(e) => set("password", e.target.value)}
                  autoComplete="current-password"
                />
              )}
            </Field>
          </div>

          {/* Database + SSL */}
          <div className="flex gap-3">
            <Field label="Database" className="flex-1">
              {(fp) => (
                <Input
                  {...fp}
                  placeholder="postgres"
                  value={form.database}
                  onChange={(e) => set("database", e.target.value)}
                  spellCheck={false}
                />
              )}
            </Field>
            <Field label="Encryption (SSL)" className="flex-1">
              {() => (
                <SslPicker
                  value={form.sslMode}
                  onChange={(v) => set("sslMode", v)}
                />
              )}
            </Field>
          </div>

          {form.sslMode === "verify_full" && (
            <Field
              label="CA certificate (optional)"
              hint="Your provider's certificate bundle, e.g. AWS RDS global-bundle.pem or DigitalOcean's ca-certificate.crt. Leave empty to trust only certificates your system already trusts."
            >
              {(fp) => (
                <div className="flex gap-2">
                  <Input
                    {...fp}
                    className="font-mono text-xs"
                    placeholder="C:\path\to\ca-certificate.pem"
                    value={form.caCert}
                    onChange={(e) => set("caCert", e.target.value)}
                    spellCheck={false}
                  />
                  <Button
                    variant="secondary"
                    onClick={() =>
                      void openFile({
                        multiple: false,
                        filters: [{ name: "Certificate", extensions: ["pem", "crt", "cer"] }],
                      }).then((path) => typeof path === "string" && set("caCert", path))
                    }
                  >
                    Browse…
                  </Button>
                </div>
              )}
            </Field>
          )}

          {/* Test result banner */}
          {testResult && (
            <p className={`rounded-control border px-3 py-2 text-xs font-medium ${
              testResult.ok
                ? "border-success/30 bg-success/8 text-success"
                : "border-danger/30 bg-danger/8 text-danger"
            }`}>
              {testResult.ok ? "✓ " : "✗ "}{testResult.message}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            iconLeft={<FlaskConical />}
            loading={testing}
            disabled={!valid || saveMutation.isPending}
            onClick={() => void testConnection()}
          >
            Test connection
          </Button>
          <div className="flex-1" />
          <Button variant="ghost" onClick={closeRemoteDialog} disabled={saveMutation.isPending}>
            Cancel
          </Button>
          <Button
            variant="primary"
            iconLeft={existing ? <Cloud /> : <DatabaseZap />}
            loading={saveMutation.isPending}
            disabled={!valid || (!existing && needsPassword)}
            onClick={() => saveMutation.mutate()}
          >
            {existing ? "Save changes" : "Add connection"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
