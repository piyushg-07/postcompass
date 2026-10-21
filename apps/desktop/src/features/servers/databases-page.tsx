import { Button, Dialog, DialogContent } from "@repo/ui";
import { Cloud, Database, Plus } from "lucide-react";
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
  const { statuses, setStatus } = useServerStatuses(state.servers.map((s) => s.id));
  const [installing, setInstalling] = useState(false);

  return (
    <div className="flex flex-col gap-10">

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-fg">Databases</h1>
          <p className="mt-0.5 text-sm text-fg-muted">Local and remote PostgreSQL databases.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" iconLeft={<Cloud />} onClick={() => openRemoteDialog()}>
            Add remote
          </Button>
          <Button variant="primary" size="sm" iconLeft={<Plus />} onClick={() => setInstallOpen(true)}>
            New local
          </Button>
        </div>
      </div>

      {/* ── Local databases ──────────────────────────────────────────────── */}
      <SectionGroup
        title="Local"
        description="Managed by PostCompass on this computer."
        action={
          <button
            className="text-xs text-fg-subtle hover:text-fg transition-colors"
            onClick={() => setInstallOpen(true)}
          >
            + New
          </button>
        }
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
            icon={<Database className="size-5 text-fg-subtle" />}
            label="New local database"
            onClick={() => setInstallOpen(true)}
          />
        </div>
      </SectionGroup>

      {/* ── Remote connections ───────────────────────────────────────────── */}
      <SectionGroup
        title="Remote"
        description="Cloud or self-hosted PostgreSQL endpoints."
        action={
          <button
            className="text-xs text-fg-subtle hover:text-fg transition-colors"
            onClick={() => openRemoteDialog()}
          >
            + Add
          </button>
        }
      >
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
          {state.remoteConnections.map((rc) => (
            <RemoteConnectionCard key={rc.id} remote={rc} />
          ))}
          {/* Add new tile */}
          <NewTile
            icon={<Cloud className="size-5 text-fg-subtle" />}
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
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <h2 className="text-sm font-semibold text-fg">{title}</h2>
          {description && (
            <span className="text-xs text-fg-subtle">{description}</span>
          )}
        </div>
        {action}
      </div>
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
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col items-center justify-center gap-2 rounded-card border border-dashed border-border py-8 text-center transition-all hover:border-border-strong hover:bg-surface"
    >
      <span className="transition-transform group-hover:scale-110">{icon}</span>
      <span className="text-xs text-fg-subtle group-hover:text-fg">{label}</span>
    </button>
  );
}
