import { Dialog, DialogContent } from "@repo/ui";
import { Cloud, Database, HardDrive } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { useAppState } from "../../app/app-state";
import { useNavigation } from "../../app/navigation";
import { DatabaseCard } from "./database-card";
import { InstallFlow } from "./install-flow";
import { RemoteConnectionCard } from "./remote-connection-card";
import { RemoteConnectionDialog } from "./remote-connection-dialog";
import { useServerStatuses } from "./use-server-statuses";

export function DatabasesPage() {
  const { state, refresh } = useAppState();
  const installOpen = useNavigation((s) => s.installDialogOpen);
  const setInstallOpen = useNavigation((s) => s.setInstallDialogOpen);
  const openRemoteDialog = useNavigation((s) => s.openRemoteDialog);
  const { statuses, setStatus } = useServerStatuses(
    state.servers.map((s) => s.id),
  );
  const [installing, setInstalling] = useState(false);

  return (
    <div className="flex flex-col gap-10">
      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-fg">
          Databases
        </h1>
        <p className="text-sm text-fg-muted">
          Local and cloud PostgreSQL in one place.
        </p>
      </div>

      {/* ── Local databases ──────────────────────────────────────────────── */}
      <SectionGroup
        icon={<HardDrive />}
        title="Local"
        count={state.servers.length}
      >
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
          {state.servers.map((server) => (
            <DatabaseCard
              key={server.id}
              server={server}
              status={statuses[server.id]}
              onStatus={(s) => setStatus(server.id, s)}
            />
          ))}
          {/* Add new tile */}
          <NewTile
            icon={<Database />}
            label="New local database"
            onClick={() => setInstallOpen(true)}
          />
        </div>
      </SectionGroup>

      {/* ── Remote connections ───────────────────────────────────────────── */}
      <SectionGroup
        icon={<Cloud />}
        title="Remote"
        count={state.remoteConnections.length}
      >
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
          {state.remoteConnections.map((rc) => (
            <RemoteConnectionCard key={rc.id} remote={rc} />
          ))}
          {/* Add new tile */}
          <NewTile
            icon={<Cloud />}
            label="Add remote connection"
            onClick={() => openRemoteDialog()}
          />
        </div>
      </SectionGroup>

      {/* ── Dialogs ──────────────────────────────────────────────────────── */}
      <Dialog
        open={installOpen}
        onOpenChange={(open) => (open || !installing) && setInstallOpen(open)}
      >
        <DialogContent
          title="New local database"
          description="Installs PostgreSQL privately for this computer. No admin rights needed."
          className="w-130"
          hideClose={installing}
        >
          <InstallFlow
            onCancel={() => setInstallOpen(false)}
            onBusyChange={setInstalling}
            onInstalled={() => {
              setInstallOpen(false);
              void refresh();
            }}
          />
        </DialogContent>
      </Dialog>

      <RemoteConnectionDialog />
    </div>
  );
}

// ── Section wrapper ────────────────────────────────────────────────────────────

function SectionGroup({
  icon,
  title,
  count,
  children,
}: {
  icon: ReactNode;
  title: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="flex items-center gap-2 text-sm font-medium text-fg [&_svg]:size-4 [&_svg]:text-fg-subtle">
        {icon}
        {title}
        <span className="text-xs font-normal text-fg-subtle tabular-nums">
          {count}
        </span>
      </h2>
      {children}
    </section>
  );
}

// ── "Add new" dashed tile ──────────────────────────────────────────────────────

function NewTile({
  icon,
  label,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex min-h-40 cursor-pointer flex-col items-center justify-center gap-2.5 rounded-card border border-dashed border-border-strong transition-colors hover:border-accent/50 hover:bg-surface"
    >
      <span className="flex size-9 items-center justify-center rounded-full border border-border bg-surface text-fg-subtle transition-colors group-hover:text-accent [&_svg]:size-4">
        {icon}
      </span>
      <span className="text-sm text-fg-muted group-hover:text-fg">{label}</span>
    </button>
  );
}
