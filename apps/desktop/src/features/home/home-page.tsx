import { Button, EmptyState, Kbd, Tooltip } from "@repo/ui";
import { Database, Plus, Server } from "lucide-react";
import { useAppState } from "../../app/app-state";
import { useNavigation } from "../../app/navigation";
import { PageHeader } from "../../app/page";
import { greeting } from "../../lib/format";
import { ServerCard } from "../servers/server-card";
import { useServerStatuses } from "../servers/use-server-statuses";

export function HomePage() {
  const onInstall = useNavigation((s) => s.startInstall);
  const goTo = useNavigation((s) => s.goTo);
  const onOpen = useNavigation((s) => s.openServer);
  const onOpenServers = () => goTo("servers");
  const { state } = useAppState();
  const { statuses, setStatus } = useServerStatuses(state.servers.map((s) => s.id));
  const hasServers = state.servers.length > 0;

  return (
    <>
      <PageHeader
        title={greeting(state.profile?.name)}
        description="Here's what's on this computer."
        actions={
          <span className="flex items-center gap-1.5 text-xs text-fg-subtle">
            <Kbd>Ctrl</Kbd>
            <Kbd>K</Kbd>
            <span>Command palette (coming soon)</span>
          </span>
        }
      />

      {hasServers && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-medium tracking-wide text-fg-subtle uppercase">Local servers</h2>
            <Button size="sm" variant="ghost" onClick={onOpenServers}>
              Manage
            </Button>
          </div>
          <div className="grid gap-3 xl:grid-cols-2">
            {state.servers.map((server) => (
              <ServerCard
                key={server.id}
                compact
                server={server}
                status={statuses[server.id]}
                onStatus={(s) => setStatus(server.id, s)}
                onOpen={onOpen}
              />
            ))}
          </div>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-medium tracking-wide text-fg-subtle uppercase">Connections</h2>
        <div className="rounded-card border border-dashed border-border-strong">
          <EmptyState
            icon={<Database />}
            title="No connections yet"
            description="Connect to a database to start exploring."
            actions={
              <>
                <Tooltip content="Coming in the next update">
                  {/* span keeps the tooltip working on a disabled button */}
                  <span tabIndex={0}>
                    <Button variant="primary" iconLeft={<Plus />} disabled>
                      Add connection
                    </Button>
                  </span>
                </Tooltip>
                {!hasServers && (
                  <Button iconLeft={<Server />} onClick={onInstall}>
                    Install local PostgreSQL
                  </Button>
                )}
              </>
            }
          />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-medium tracking-wide text-fg-subtle uppercase">Recent activity</h2>
        <p className="text-sm text-fg-subtle">Nothing yet.</p>
      </section>
    </>
  );
}
