import { Button, Card, Separator, Switch, toast } from "@repo/ui";
import type { ReactNode } from "react";
import { useAppState } from "../../app/app-state";
import { PageHeader } from "../../app/page";
import { commands, describeError, unwrap } from "../../lib/ipc";

export function SettingsPage() {
  const { state, info, setState } = useAppState();

  const save = async (stopServersOnQuit: boolean) => {
    try {
      setState(await unwrap(commands.updateSettings({ ...state.settings, stopServersOnQuit })));
    } catch (e) {
      toast.error("Couldn't save settings", { description: describeError(e).message });
    }
  };

  const rerunOnboarding = async () => {
    try {
      setState(await unwrap(commands.resetOnboarding()));
    } catch (e) {
      toast.error("Couldn't reset onboarding", { description: describeError(e).message });
    }
  };

  return (
    <>
      <PageHeader title="Settings" />

      <Card>
        <SettingRow
          title="Stop servers when PostCompass quits"
          description="Servers you installed with PostCompass stop when you close the app. Turn off to keep them running in the background."
        >
          <Switch
            checked={state.settings.stopServersOnQuit}
            onCheckedChange={(checked) => void save(checked)}
            aria-label="Stop servers when PostCompass quits"
          />
        </SettingRow>
        <Separator />
        <SettingRow title="Onboarding" description="Go through the welcome steps again. Your servers are kept.">
          <Button size="sm" onClick={() => void rerunOnboarding()}>
            Run again
          </Button>
        </SettingRow>
      </Card>

      <Card className="p-4">
        <h2 className="mb-3 text-sm font-semibold">About</h2>
        <dl className="grid grid-cols-[120px_1fr] gap-y-1.5 text-xs">
          <dt className="text-fg-subtle">Version</dt>
          <dd className="font-mono text-fg-muted">{info.version}</dd>
          <dt className="text-fg-subtle">Platform</dt>
          <dd className="font-mono text-fg-muted">
            {info.os} · {info.arch}
          </dd>
          <dt className="text-fg-subtle">Databases</dt>
          <dd className="text-fg-muted">{info.supportedDatabases.map((db) => db.displayName).join(", ")}</dd>
        </dl>
      </Card>
    </>
  );
}

function SettingRow({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6 p-4">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm text-fg">{title}</span>
        <span className="text-xs text-fg-muted">{description}</span>
      </div>
      {children}
    </div>
  );
}
