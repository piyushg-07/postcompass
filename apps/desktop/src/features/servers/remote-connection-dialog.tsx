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
  toast,
} from "@repo/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { open as openFile } from "@tauri-apps/plugin-dialog";
import { Cloud, DatabaseZap, FlaskConical } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useAppState } from "../../app/app-state";
import { useNavigation } from "../../app/navigation";
import { commands, describeError, unwrap } from "../../lib/ipc";
import { closeConnection } from "./connection-cache";
import {
  empty,
  type FormState,
  fromDraft,
  fromExisting,
  isValidPort,
  toRequest,
} from "./remote/form-state";
import { ProviderPicker } from "./remote/provider-picker";
import { providerById } from "./remote/providers";
import { SslPicker } from "./remote/ssl-picker";

// ── Dialog ────────────────────────────────────────────────────────────────────

export function RemoteConnectionDialog() {
  const { state, setState } = useAppState();
  const remoteDialogOpen = useNavigation((s) => s.remoteDialogOpen);
  const editingRemoteId = useNavigation((s) => s.editingRemoteId);
  const remoteDraft = useNavigation((s) => s.remoteDraft);
  const closeRemoteDialog = useNavigation((s) => s.closeRemoteDialog);
  const queryClient = useQueryClient();

  const existing = editingRemoteId
    ? state.remoteConnections.find((r) => r.id === editingRemoteId) ?? null
    : null;

  const [form, setForm] = useState<FormState>(empty());
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [testing, setTesting] = useState(false);
  /** Bumped whenever the dialog (re)opens, so a test that finishes late doesn't report on a new form. */
  const testRun = useRef(0);

  useEffect(() => {
    if (remoteDialogOpen) {
      setForm(existing ? fromExisting(existing) : remoteDraft ? fromDraft(remoteDraft) : empty());
      setTestResult(null);
      setTesting(false);
      testRun.current++;
    }
  }, [remoteDialogOpen, editingRemoteId, remoteDraft]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const selectedProvider = providerById(form.provider);

  const onProviderChange = (id: string) => {
    const p = providerById(id);
    setForm((f) => {
      // Follow the provider's port unless the user typed their own
      const previousDefault = String(providerById(f.provider).defaultPort ?? 5432);
      const port = f.port === previousDefault ? String(p.defaultPort ?? 5432) : f.port;
      return { ...f, provider: id, sslMode: p.defaultSsl, port };
    });
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const req = toRequest(form);
      if (existing) return unwrap(commands.updateRemoteConnection(existing.id, req));
      return unwrap(commands.addRemoteConnection(req));
    },
    onSuccess: (newState) => {
      // The returned snapshot is the new state; no refetch needed
      setState(newState);
      // Rust keeps an open session on the old host / credentials; close it so the next open uses the new ones
      if (existing) void closeConnection(queryClient, `remote:${existing.id}`);
      toast.success(existing ? "Connection updated" : "Remote connection saved");
      closeRemoteDialog();
    },
    onError: (e: unknown) => {
      const { title, message } = describeError(e);
      toast.error(title, { description: message });
    },
  });

  const testConnection = async () => {
    const run = ++testRun.current;
    setTesting(true);
    setTestResult(null);
    try {
      // Password left empty while editing → the saved password is used
      const result = await unwrap(commands.testRemoteConnection(toRequest(form), existing?.id ?? null));
      if (run === testRun.current)
        setTestResult({ ok: true, message: `Connected · PostgreSQL ${result.serverVersion} · ${result.latencyMs} ms` });
    } catch (e) {
      if (run === testRun.current) setTestResult({ ok: false, message: describeError(e).message });
    } finally {
      if (run === testRun.current) setTesting(false);
    }
  };

  const portValid = isValidPort(form.port);
  const valid = form.host.trim().length > 0 && form.user.trim().length > 0 && portValid;
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
            <Field label="Port" className="w-24" error={portValid ? undefined : "1–65535"}>
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
