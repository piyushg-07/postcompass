import { Badge, Skeleton, StatusDot } from "@repo/ui";
import { FolderOpen, Radio } from "lucide-react";
import { useAppState } from "../../app/app-state";
import type { DetectionReport, InstallSource } from "../../lib/bindings";
import type { DetectionState } from "./use-detection";

const sourceLabels: Record<InstallSource, string> = {
  system: "System",
  homebrew: "Homebrew",
  postgres_app: "Postgres.app",
  docker: "Docker",
  managed: "PostCompass",
};

export function DetectionResults({ state }: { state: DetectionState }) {
  if (state.status === "scanning") {
    return (
      <div className="flex flex-col gap-2" aria-busy>
        <Skeleton className="h-12" />
        <Skeleton className="h-12 opacity-60" />
      </div>
    );
  }
  if (state.status === "error") {
    return <p className="text-sm text-danger">Scan failed: {state.message}</p>;
  }
  return <ReportList report={state.report} />;
}

function ReportList({ report }: { report: DetectionReport }) {
  const { state } = useAppState();
  // A listening port that belongs to one of our own servers
  const managedOn = (port: number) => state.servers.find((s) => s.port === port);
  if (report.installs.length === 0 && report.servers.length === 0) {
    return <p className="text-sm text-fg-muted">No PostgreSQL installs or running servers found on this computer.</p>;
  }

  return (
    <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-card border border-border bg-surface">
      {report.installs.map((install) => (
        <li key={install.binDir} className="flex items-center gap-3 px-3 py-2.5">
          <FolderOpen className="size-4 shrink-0 text-fg-subtle" />
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="text-sm text-fg">
              PostgreSQL {install.version ?? "(unknown version)"}
              {install.serviceName && <span className="text-fg-subtle"> · service {install.serviceName}</span>}
            </span>
            <span className="truncate font-mono text-xs text-fg-subtle" title={install.binDir}>
              {install.binDir}
            </span>
          </div>
          {install.serviceRunning !== null && (
            <StatusDot status={install.serviceRunning ? "running" : "stopped"} />
          )}
          <Badge variant={install.source === "managed" ? "accent" : "neutral"}>{sourceLabels[install.source]}</Badge>
        </li>
      ))}
      {report.servers.map((server) => (
        <li key={server.port} className="flex items-center gap-3 px-3 py-2.5">
          <Radio className="size-4 shrink-0 text-fg-subtle" />
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="text-sm text-fg">
              Server accepting connections on port <span className="font-mono">{server.port}</span>
            </span>
            <span className="font-mono text-xs text-fg-subtle">
              {server.host}:{server.port}
              {server.label && ` · ${server.label}`}
            </span>
          </div>
          <StatusDot status="running" />
          {managedOn(server.port) ? (
            <Badge variant="accent">PostCompass · {managedOn(server.port)!.name}</Badge>
          ) : (
            server.source && <Badge>{sourceLabels[server.source]}</Badge>
          )}
        </li>
      ))}
    </ul>
  );
}
