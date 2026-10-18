import { Button, Dialog, DialogContent, EmptyState } from "@repo/ui";
import { Database, Plus, RefreshCw } from "lucide-react";
import { useState } from "react";
import { useAppState } from "../../app/app-state";
import { useNavigation } from "../../app/navigation";
import { PageHeader } from "../../app/page";
import { DatabaseCard } from "./database-card";
import { DetectionResults } from "./detection-results";
import { InstallFlow } from "./install-flow";
import { useDetection } from "./use-detection";
import { useServerStatuses } from "./use-server-statuses";

/** Every PostgreSQL database PostCompass manages, plus other installs found on this computer. */
export function DatabasesPage() {
  const { state, refresh } = useAppState();
  const installOpen = useNavigation((s) => s.installDialogOpen);
  const setInstallOpen = useNavigation((s) => s.setInstallDialogOpen);
  const { statuses, setStatus } = useServerStatuses(
    state.servers.map((s) => s.id),
  );
  const detection = useDetection();
  const [installing, setInstalling] = useState(false);
  const running = state.servers.filter(
    (s) => statuses[s.id] === "running",
  ).length;

  return (
    <>
      <PageHeader
        title="Databases"
        description={
          state.servers.length
            ? `${state.servers.length} local database${state.servers.length === 1 ? "" : "s"} · ${running} running`
            : "PostgreSQL databases on this computer."
        }
        actions={
          <Button
            variant="primary"
            iconLeft={<Plus />}
            onClick={() => setInstallOpen(true)}
          >
            New local database
          </Button>
        }
      />

      {state.servers.length === 0 ? (
        <div className="rounded-card border border-dashed border-border-strong">
          <EmptyState
            icon={<Database />}
            title="No databases yet"
            description="Create a local PostgreSQL database in one click. It runs only on this computer and needs no admin rights."
            actions={
              <Button
                variant="primary"
                iconLeft={<Plus />}
                onClick={() => setInstallOpen(true)}
              >
                New local database
              </Button>
            }
          />
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {state.servers.map((server) => (
            <DatabaseCard
              key={server.id}
              server={server}
              status={statuses[server.id]}
              onStatus={(s) => setStatus(server.id, s)}
            />
          ))}
        </div>
      )}

      <section className="flex flex-col gap-3">
        <div className="flex items-end justify-between gap-4">
          <div className="flex flex-col gap-0.5">
            <h2 className="text-sm font-semibold text-fg">
              Also on this computer
            </h2>
            <p className="text-xs text-fg-muted">
              PostgreSQL installed outside PostCompass. Connecting to these is
              coming with remote connections.
            </p>
          </div>
          <Button
            size="sm"
            variant="ghost"
            iconLeft={<RefreshCw />}
            loading={detection.state.status === "scanning"}
            onClick={detection.rescan}
          >
            Scan again
          </Button>
        </div>
        <DetectionResults state={detection.state} />
      </section>

      <Dialog
        open={installOpen}
        onOpenChange={(open) => (open || !installing) && setInstallOpen(open)}
      >
        <DialogContent
          title="New local database"
          description="Installs PostgreSQL privately for this computer. No admin rights needed."
          className="w-[520px]"
          hideClose={installing}
        >
          <InstallFlow
            onCancel={() => setInstallOpen(false)}
            onBusyChange={setInstalling}
            onInstalled={() => {
              setInstallOpen(false);
              void refresh();
              detection.rescan();
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
