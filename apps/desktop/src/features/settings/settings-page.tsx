import { Badge, Card, Switch, toast } from "@repo/ui";
import { User } from "lucide-react";
import type { ReactNode } from "react";
import appIcon from "../../../app-icon.svg";
import { useAppState } from "../../app/app-state";
import { PageHeader } from "../../app/page";
import type { Profile, Role } from "../../lib/bindings";
import { platformLabel } from "../../lib/format";
import { commands, describeError, unwrap } from "../../lib/ipc";

const ROLE_LABELS: Record<Role, string> = {
  developer: "Developer",
  analyst: "Data / Analyst",
  dba: "Database admin",
  student: "Student",
  other: "Other",
};

export function SettingsPage() {
  const { state, info, setState } = useAppState();

  const saveSettings = async (stopServersOnQuit: boolean) => {
    try {
      setState(await unwrap(commands.updateSettings({ ...state.settings, stopServersOnQuit })));
    } catch (e) {
      toast.error("Couldn't save settings", { description: describeError(e).message });
    }
  };

  return (
    <div className="flex max-w-3xl flex-col gap-12">
      <PageHeader title="Settings" />

      {state.profile && (
        <Section title="Profile">
          <ProfileCard profile={state.profile} />
        </Section>
      )}

      <Section title="General">
        <ToggleRow
          title="Stop databases when PostCompass quits"
          description="Frees memory on exit. Turn off to keep them running in the background."
        >
          <Switch
            checked={state.settings.stopServersOnQuit}
            onCheckedChange={(checked) => void saveSettings(checked)}
            aria-label="Stop local databases when PostCompass quits"
          />
        </ToggleRow>
        <ToggleRow
          title={
            <span className="flex items-center gap-2">
              Usage stats
              <Badge>Coming soon</Badge>
            </span>
          }
          description="Anonymous stats to help improve PostCompass. Never your data or queries."
          muted
        >
          <Switch checked={false} disabled aria-label="Usage stats (coming soon)" />
        </ToggleRow>
      </Section>

      <Section title="About">
        <div className="flex items-center gap-4 px-6 py-5">
          <img src={appIcon} alt="" width={44} height={44} draggable={false} />
          <div className="flex flex-col gap-1">
            <span className="flex items-baseline gap-px text-lg text-fg">
              <span className="font-brand font-bold tracking-tighter">Post</span>
              <span className="bg-linear-to-r from-accent to-[#7ee7b8] bg-clip-text pr-0.5 font-serif text-[1.3rem] leading-none text-transparent italic">
                Compass
              </span>
            </span>
            <span className="font-mono text-xs text-fg-muted">v{info.version}</span>
          </div>
        </div>
        <InfoRow label="Platform">{platformLabel(info.os, info.arch)}</InfoRow>
        <InfoRow label="Supports">{info.supportedDatabases.map((db) => db.displayName).join(", ")}</InfoRow>
      </Section>
    </div>
  );
}

function ProfileCard({ profile }: { profile: Profile }) {
  const name = profile.name?.trim();
  const since = profile.completedAt
    ? new Date(profile.completedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
    : null;
  return (
    <div className="flex items-center gap-4 px-6 py-5">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent-muted text-base font-semibold text-accent ring-1 ring-accent/30 [&_svg]:size-5">
        {name ? name[0]!.toUpperCase() : <User />}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="truncate text-base font-medium text-fg">{name || "No name set"}</span>
        <span className="text-xs text-fg-muted">
          {ROLE_LABELS[profile.role]}
          {since && ` · Set up ${since}`}
        </span>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-sm font-semibold text-fg">{title}</h2>
      <Card className="divide-y divide-border overflow-hidden p-0">{children}</Card>
    </section>
  );
}

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[180px_1fr] items-center gap-6 px-6 py-4 text-sm">
      <span className="text-fg-subtle">{label}</span>
      <span className="min-w-0 text-fg-muted">{children}</span>
    </div>
  );
}

function ToggleRow({
  title,
  description,
  muted,
  children,
}: {
  title: ReactNode;
  description: string;
  muted?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-6 px-6 py-5">
      <div className={muted ? "flex flex-col gap-1 opacity-60" : "flex flex-col gap-1"}>
        <span className="text-sm font-medium text-fg">{title}</span>
        <span className="text-xs text-fg-muted">{description}</span>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
