import { Button, RadioCard, RadioCardGroup, Spinner, StatusBadge } from "@repo/ui";
import { ArrowRight } from "lucide-react";
import { useState } from "react";
import postgresLogo from "../../assets/providers/postgresql.svg";
import { useAppState } from "../../app/app-state";
import type { RemoteDraft } from "../../app/navigation";
import type { ManagedServer } from "../../lib/bindings";
import { InstallFlow } from "../servers/install-flow";
import { externalPostgres, SOURCE_LABELS, useDetection } from "../servers/use-detection";
import { useServerStatuses } from "../servers/use-server-statuses";
import { ServerCard, StepLayout } from "./layout";

export function PostgresStep({
  installed,
  existing,
  onInstalled,
  onUseExisting,
  onBack,
  onNext,
}: {
  installed: ManagedServer | null;
  existing: RemoteDraft | null;
  onInstalled: (server: ManagedServer) => void;
  onUseExisting: (server: RemoteDraft) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const { state } = useAppState();
  const [installing, setInstalling] = useState(false);
  const ready = installed ?? state.servers[0] ?? null;
  const { statuses } = useServerStatuses(ready ? [ready.id] : []);
  const status = ready ? statuses[ready.id] : undefined;
  const { report, scanning } = useDetection();
  const found = report ? externalPostgres(report, state.servers) : null;
  const [picked, setPicked] = useState<number | null>(existing?.port ?? null);

  if (installing) {
    return (
      <StepLayout title="Install PostgreSQL">
        <InstallFlow onInstalled={onInstalled} onCancel={() => setInstalling(false)} cancelLabel="Back" />
      </StepLayout>
    );
  }

  if (ready) {
    return (
      <StepLayout title="PostgreSQL is ready" onBack={onBack} onNext={onNext}>
        <ServerCard
          title={ready.name}
          detail={`${ready.host}:${ready.port}`}
          aside={status && <StatusBadge status={status} />}
        />
      </StepLayout>
    );
  }

  // First scan still running: nothing to decide yet
  if (!report && scanning) {
    return (
      <StepLayout title="Looking for PostgreSQL…" onBack={onBack}>
        <ServerCard
          title="Checking this computer"
          detail="Looking for installed PostgreSQL and running servers."
          aside={<Spinner className="size-4 text-fg-subtle" />}
        />
      </StepLayout>
    );
  }

  // Already running on this computer: offer to use it
  if (found && found.servers.length > 0) {
    const selected = found.servers.find((s) => s.port === picked) ?? found.servers[0]!;
    const describe = (server: (typeof found.servers)[number]) => {
      const source = server.label ?? (server.source ? SOURCE_LABELS[server.source] : null);
      return `${server.host}:${server.port}${source ? ` · ${source}` : ""}`;
    };
    return (
      <StepLayout
        title="PostgreSQL is already on this computer"
        onBack={onBack}
        actions={
          <>
            <Button variant="ghost" onClick={() => setInstalling(true)}>
              Install a separate one
            </Button>
            <Button
              variant="primary"
              iconRight={<ArrowRight />}
              onClick={() =>
                onUseExisting({ name: `PostgreSQL on port ${selected.port}`, host: selected.host, port: selected.port })
              }
            >
              Use this
            </Button>
          </>
        }
      >
        {found.servers.length === 1 ? (
          <ServerCard
            title={`PostgreSQL on port ${selected.port}`}
            detail={describe(selected)}
            aside={<StatusBadge status="running" />}
          />
        ) : (
          <RadioCardGroup value={String(selected.port)} onValueChange={(v) => setPicked(Number(v))}>
            {found.servers.map((server) => (
              <RadioCard
                key={server.port}
                value={String(server.port)}
                title={`PostgreSQL on port ${server.port}`}
                description={describe(server)}
                icon={<img src={postgresLogo} alt="" draggable={false} />}
              />
            ))}
          </RadioCardGroup>
        )}
      </StepLayout>
    );
  }

  const stopped = found?.installs[0];
  return (
    <StepLayout
      title="Set up PostgreSQL"
      onBack={onBack}
      actions={
        <>
          <Button variant="ghost" onClick={onNext}>
            Skip for now
          </Button>
          <Button variant="primary" iconRight={<ArrowRight />} onClick={() => setInstalling(true)}>
            Install PostgreSQL
          </Button>
        </>
      }
    >
      <ServerCard title="PostgreSQL" detail="Runs privately on this computer. No admin rights or Docker." />
      {/* Installed but not running, so there's nothing to connect to yet */}
      {stopped && (
        <p className="-mt-6 text-sm text-fg-muted">
          We found PostgreSQL {stopped.version ?? ""} installed ({SOURCE_LABELS[stopped.source]}), but it isn't running.
          Start it and connect later from Databases, or install one here.
        </p>
      )}
    </StepLayout>
  );
}
