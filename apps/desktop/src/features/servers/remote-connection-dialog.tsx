/**
 * Add / Edit remote connection dialog.
 *
 * Provider selection is a Supabase-style icon-grid popover:
 * click the trigger → floating panel with provider tiles → click to select.
 *
 * Supports every cloud Postgres flavour:
 *   AWS RDS / Aurora, GCP Cloud SQL, Azure, Cloudflare Hyperdrive,
 *   Supabase, Neon, Railway, Render, and any self-hosted endpoint.
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
import { Check, ChevronDown, Cloud, DatabaseZap, FlaskConical } from "lucide-react";
import { useEffect, useState } from "react";
import { useAppState } from "../../app/app-state";
import { useNavigation } from "../../app/navigation";
import type { RemoteConnection, SslMode } from "../../lib/bindings";
import { commands, describeError, unwrap } from "../../lib/ipc";
import { queryKeys } from "../../lib/query";

// ── Provider definitions ───────────────────────────────────────────────────────

type Provider = {
  id: string;
  label: string;
  shortLabel: string;
  defaultSsl: SslMode;
  hostHint?: string;
  /** SVG path data for the logo mark */
  icon: React.ReactNode;
};

/** Inline SVG brand icons — no external deps, no network requests */
const AwsIcon = () => (
  <svg viewBox="0 0 40 24" fill="none" className="h-5 w-auto">
    <text x="0" y="18" fontSize="13" fontWeight="700" fill="currentColor" fontFamily="monospace">AWS</text>
  </svg>
);
const GcpIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className="size-5">
    <path d="M12 6.5L8.5 3H15.5L12 6.5Z" fill="#EA4335"/>
    <path d="M6.5 18L3 14.5V9.5L6.5 13V18Z" fill="#4285F4"/>
    <path d="M17.5 18L21 14.5V9.5L17.5 13V18Z" fill="#34A853"/>
    <path d="M8.5 21L12 17.5L15.5 21H8.5Z" fill="#FBBC05"/>
    <circle cx="12" cy="12" r="3.5" fill="currentColor" opacity="0.15"/>
  </svg>
);
const AzureIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className="size-5">
    <path d="M13.05 3L7 13.5L11 13.5L6 21H18.5L13.05 3Z" fill="#0078D4"/>
    <path d="M9 3H13.05L18.5 21H14L9 3Z" fill="#50B4E8" opacity="0.6"/>
  </svg>
);
const CloudflareIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className="size-5">
    <path d="M16.5 14.5C17.9 14.5 19 13.4 19 12C19 10.6 17.9 9.5 16.5 9.5C16.3 9.5 16.1 9.52 15.9 9.56C15.5 8.08 14.1 7 12.5 7C10.6 7 9 8.4 9 10.17C9 10.28 9.01 10.39 9.02 10.5C7.86 10.67 7 11.67 7 12.88C7 14.28 8.12 15.4 9.5 15.4L16.5 14.5Z" fill="#F6821F"/>
    <path d="M16.5 14.5L9.5 15.4L9.5 15.5H16.5C17.9 15.5 19 14.4 19 13H16.5V14.5Z" fill="#FBAD41"/>
  </svg>
);
const SupabaseIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className="size-5">
    <path d="M11.9 1.5L3 14.5H13V22.5L21 9.5H11L11.9 1.5Z" fill="#3ECF8E"/>
  </svg>
);
const NeonIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className="size-5">
    <rect width="24" height="24" rx="6" fill="#00E5BF" opacity="0.15"/>
    <path d="M5 7h14v2L13 15v2l6-4v4H5V7Z" fill="#00E5BF"/>
  </svg>
);
const RailwayIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className="size-5">
    <rect x="4" y="4" width="16" height="16" rx="8" fill="currentColor"/>
    <path d="M8 12h8M12 8v8" stroke="white" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);
const RenderIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className="size-5">
    <path d="M4 20L12 4L20 20H4Z" fill="none" stroke="#46E3B7" strokeWidth="2" strokeLinejoin="round"/>
  </svg>
);
const OtherIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className="size-5">
    <rect x="3" y="6" width="18" height="12" rx="2" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M3 10h18" stroke="currentColor" strokeWidth="1.5"/>
    <circle cx="7" cy="14" r="1" fill="currentColor"/>
  </svg>
);

const PROVIDERS: Provider[] = [
  { id: "aws",        label: "AWS RDS / Aurora",              shortLabel: "AWS RDS",    defaultSsl: "require",     hostHint: "e.g. mydb.us-east-1.rds.amazonaws.com", icon: <AwsIcon /> },
  { id: "gcp",        label: "Google Cloud SQL",              shortLabel: "Cloud SQL",  defaultSsl: "require",     hostHint: "e.g. 34.xx.xx.xx (Cloud SQL public IP)", icon: <GcpIcon /> },
  { id: "azure",      label: "Azure Database for PostgreSQL", shortLabel: "Azure DB",   defaultSsl: "require",     hostHint: "e.g. myserver.postgres.database.azure.com", icon: <AzureIcon /> },
  { id: "cloudflare", label: "Cloudflare Hyperdrive",         shortLabel: "Hyperdrive", defaultSsl: "require",     hostHint: "e.g. <UUID>.hyperdrive.io", icon: <CloudflareIcon /> },
  { id: "supabase",   label: "Supabase",                      shortLabel: "Supabase",   defaultSsl: "require",     hostHint: "e.g. db.<ref>.supabase.co", icon: <SupabaseIcon /> },
  { id: "neon",       label: "Neon",                          shortLabel: "Neon",       defaultSsl: "require",     hostHint: "e.g. ep-xxxx.us-east-2.aws.neon.tech", icon: <NeonIcon /> },
  { id: "railway",    label: "Railway",                       shortLabel: "Railway",    defaultSsl: "require",     hostHint: "e.g. roundhouse.proxy.rlwy.net", icon: <RailwayIcon /> },
  { id: "render",     label: "Render",                        shortLabel: "Render",     defaultSsl: "require",     hostHint: "e.g. dpg-xxx.render.com", icon: <RenderIcon /> },
  { id: "other",      label: "Other / Self-hosted",           shortLabel: "PostgreSQL", defaultSsl: "prefer",      icon: <OtherIcon /> },
];

const SSL_OPTIONS: { value: SslMode; label: string; short: string; description: string; color: string }[] = [
  {
    value: "disable",
    label: "Disable",
    short: "No TLS",
    description: "Plain text only. Local / trusted networks.",
    color: "text-fg-muted",
  },
  {
    value: "prefer",
    label: "Prefer",
    short: "TLS preferred",
    description: "Try TLS first, fall back to plain text.",
    color: "text-amber-500",
  },
  {
    value: "require",
    label: "Require",
    short: "TLS required",
    description: "Encrypted, certificate not verified.",
    color: "text-blue-500",
  },
  {
    value: "verify_full",
    label: "Verify Full",
    short: "TLS verified",
    description: "Encrypted + certificate chain checked.",
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
      <PopoverContent className="w-64 p-1.5" align="start">
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
          <span className="flex shrink-0 items-center text-fg-muted">{selected.icon}</span>
          <span className="flex-1 truncate text-left">{selected.label}</span>
          <ChevronDown className={`size-3.5 shrink-0 text-fg-subtle transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[460px] p-3" align="start">
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
                <span className={`${isSelected ? "text-accent" : "text-fg-muted group-hover:text-fg"}`}>
                  {p.icon}
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
}

function empty(provider = PROVIDERS[0]): FormState {
  return {
    name: "",
    provider: provider.id,
    host: "",
    port: "5432",
    user: "postgres",
    password: "",
    database: "postgres",
    sslMode: provider.defaultSsl,
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
  };
}

// ── Dialog ────────────────────────────────────────────────────────────────────

export function RemoteConnectionDialog() {
  const { state, setState } = useAppState();
  const remoteDialogOpen = useNavigation((s) => s.remoteDialogOpen);
  const editingRemoteId = useNavigation((s) => s.editingRemoteId);
  const closeRemoteDialog = useNavigation((s) => s.closeRemoteDialog);

  const existing = editingRemoteId
    ? state.remoteConnections.find((r) => r.id === editingRemoteId) ?? null
    : null;

  const [form, setForm] = useState<FormState>(empty());
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (remoteDialogOpen) {
      setForm(existing ? fromExisting(existing) : empty());
      setTestResult(null);
    }
  }, [remoteDialogOpen, editingRemoteId]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const selectedProvider = PROVIDERS.find((p) => p.id === form.provider) ?? PROVIDERS[PROVIDERS.length - 1];

  const onProviderChange = (id: string) => {
    const p = PROVIDERS.find((pr) => pr.id === id) ?? PROVIDERS[PROVIDERS.length - 1];
    setForm((f) => ({ ...f, provider: id, sslMode: p.defaultSsl }));
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
          password: form.password || (existing ? "will-use-keychain" : ""),
          database: form.database.trim(),
          sslMode: form.sslMode,
          provider: form.provider,
        }),
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
            <Field label="SSL mode" className="flex-1">
              {() => (
                <SslPicker
                  value={form.sslMode}
                  onChange={(v) => set("sslMode", v)}
                />
              )}
            </Field>
          </div>

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
