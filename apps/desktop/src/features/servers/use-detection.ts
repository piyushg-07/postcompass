import { useQuery } from "@tanstack/react-query";
import type { DetectionReport, InstallSource, ManagedServer } from "../../lib/bindings";
import { commands, unwrap } from "../../lib/ipc";
import { queryKeys } from "../../lib/query";

export const SOURCE_LABELS: Record<InstallSource, string> = {
  system: "System",
  homebrew: "Homebrew",
  postgres_app: "Postgres.app",
  docker: "Docker",
  managed: "PostCompass",
};

/** Scans this computer for PostgreSQL installed outside PostCompass. Read-only; rescan is explicit. */
export function useDetection() {
  const query = useQuery({
    queryKey: queryKeys.detection("postgres"),
    queryFn: () => unwrap(commands.detectLocal("postgres")),
    // Installs don't change on their own often
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
  return {
    report: query.data ?? null,
    scanning: query.isFetching,
    error: query.error,
    rescan: () => void query.refetch(),
  };
}

/** What the scan found that PostCompass doesn't already manage. */
export function externalPostgres(report: DetectionReport, managed: ManagedServer[]) {
  const managedPorts = new Set(managed.map((s) => s.port));
  return {
    /** Running servers you can connect to. */
    servers: report.servers.filter((s) => !managedPorts.has(s.port)),
    /** Installs on disk, running or not. */
    installs: report.installs.filter((i) => i.source !== "managed"),
  };
}
