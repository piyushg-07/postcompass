import { Card, Switch, toast } from "@repo/ui";
import { Info, Keyboard, Settings2 } from "lucide-react";
import type { ReactNode } from "react";
import { useAppState } from "../../app/app-state";
import { commands, describeError, unwrap } from "../../lib/ipc";


const SHORTCUTS = [
  { keys: ["Ctrl", "K"],          label: "Open command palette" },
  { keys: ["Ctrl", "Shift", "D"], label: "Go to Databases" },
  { keys: ["Ctrl", "Shift", "E"], label: "Go to Explorer" },
  { keys: ["Ctrl", "Shift", "H"], label: "Go to Home" },
];

export function SettingsPage() {
  const { state, info, setState } = useAppState();

  const save = async (stopServersOnQuit: boolean) => {
    try {
      setState(await unwrap(commands.updateSettings({ ...state.settings, stopServersOnQuit })));
    } catch (e) {
      toast.error("Couldn't save settings", { description: describeError(e).message });
    }
  };

  return (
    <div className="flex flex-col gap-8">

      {/* ── Page header ───────────────────────────────────────────────── */}
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-fg">Settings</h1>
        <p className="mt-0.5 text-sm text-fg-muted">Configure PostCompass behaviour.</p>
      </div>

      {/* ── General ───────────────────────────────────────────────────── */}
      <Section icon={<Settings2 className="size-3.5" />} title="General">
        <SettingRow
          title="Stop databases when PostCompass quits"
          description="Frees memory by stopping local databases on exit. Disable to keep them running in the background."
        >
          <Switch
            checked={state.settings.stopServersOnQuit}
            onCheckedChange={(checked) => void save(checked)}
            aria-label="Stop local databases when PostCompass quits"
          />
        </SettingRow>
      </Section>

      {/* ── Keyboard shortcuts ────────────────────────────────────────── */}
      <Section icon={<Keyboard className="size-3.5" />} title="Keyboard shortcuts">
        <div className="flex flex-col divide-y divide-border">
          {SHORTCUTS.map(({ keys, label }) => (
            <div key={label} className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-fg-muted">{label}</span>
              <div className="flex items-center gap-1">
                {keys.map((k) => (
                  <kbd
                    key={k}
                    className="inline-flex h-6 min-w-6 items-center justify-center rounded border border-border-strong bg-surface px-1.5 font-mono text-[11px] text-fg-muted"
                  >
                    {k}
                  </kbd>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ── About ─────────────────────────────────────────────────────── */}
      <Section icon={<Info className="size-3.5" />} title="About">
        <div className="grid grid-cols-[140px_1fr] gap-y-3 px-4 py-3 text-sm">
          <span className="text-fg-subtle">Version</span>
          <span className="font-mono text-fg-muted">{info.version}</span>
          <span className="text-fg-subtle">Platform</span>
          <span className="font-mono text-fg-muted">{info.os} · {info.arch}</span>
          <span className="text-fg-subtle">PostgreSQL</span>
          <span className="text-fg-muted">
            {info.supportedDatabases.map((db) => db.displayName).join(", ")}
          </span>
        </div>
      </Section>

    </div>
  );
}

// ── Section wrapper ────────────────────────────────────────────────────────────

function Section({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="text-fg-subtle">{icon}</span>
        <h2 className="text-sm font-semibold text-fg">{title}</h2>
      </div>
      <div className="h-px bg-border" />
      <Card className="overflow-hidden p-0">
        {children}
      </Card>
    </section>
  );
}

// ── Setting row ────────────────────────────────────────────────────────────────

function SettingRow({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-6 px-4 py-3.5">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium text-fg">{title}</span>
        <span className="text-xs text-fg-muted">{description}</span>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
