import { Button, Dialog, DialogContent, EmptyState } from "@repo/ui";
import { Plus, RefreshCw, Server } from "lucide-react";
import { useState } from "react";
import { useAppState } from "../../app/app-state";
import { useNavigation } from "../../app/navigation";
import { PageHeader } from "../../app/page";
import { DetectionResults } from "./detection-results";
import { InstallFlow } from "./install-flow";
import { ServerCard } from "./server-card";
import { useDetection } from "./use-detection";
import { useServerStatuses } from "./use-server-statuses";

export function ServersPage() {
  const installOpen = useNavigation((s) => s.installDialogOpen);
  const onInstallOpenChange = useNavigation((s) => s.setInstallDialogOpen);
  const onOpen = useNavigation((s) => s.openServer);
  const { state, refresh } = useAppState();
  const { statuses, setStatus } = useServerStatuses(state.servers.map((s) => s.id));
  const detection = useDetection();
  const [installing, setInstalling] = useState(false);

  return (
    <>
      <PageHeader
        title="Servers"
        description="PostgreSQL servers on this computer."
        actions={
          <Button variant="primary" iconLeft={<Plus />} onClick={() => onInstallOpenChange(true)}>
            Install PostgreSQL
          </Button>
        }
      />

      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-medium tracking-wide text-fg-subtle uppercase">Managed by PostCompass</h2>
        {state.servers.length === 0 ? (
          <div className="rounded-card border border-dashed border-border-strong">
            <EmptyState
              icon={<Server />}
              title="No local servers yet"
              description="Install PostgreSQL in one click. It runs only on this computer and needs no admin rights."
              actions={
                <Button variant="primary" onClick={() => onInstallOpenChange(true)}>
                  Install PostgreSQL
                </Button>
              }
            />
          </div>
        ) : (
          <div className="grid gap-3 xl:grid-cols-2">
            {state.servers.map((server) => (
              <ServerCard
                key={server.id}
                server={server}
                status={statuses[server.id]}
                onStatus={(s) => setStatus(server.id, s)}
                onOpen={onOpen}
              />
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-medium tracking-wide text-fg-subtle uppercase">Found on this computer</h2>
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

      <Dialog open={installOpen} onOpenChange={(open) => (open || !installing) && onInstallOpenChange(open)}>
        <DialogContent
          title="Install PostgreSQL"
          description="A private PostgreSQL server for this computer."
          className="w-[520px]"
          hideClose={installing}
        >
          <InstallFlow
            onCancel={() => onInstallOpenChange(false)}
            onBusyChange={setInstalling}
            onInstalled={() => {
              onInstallOpenChange(false);
              void refresh();
              detection.rescan();
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
