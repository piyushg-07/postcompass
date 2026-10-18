import { useQuery } from "@tanstack/react-query";
import type { DetectionReport } from "../../lib/bindings";
import { commands, unwrap } from "../../lib/ipc";
import { queryKeys } from "../../lib/query";

export type DetectionState =
  | { status: "scanning" }
  | { status: "done"; report: DetectionReport }
  | { status: "error"; message: string };

/** Local PostgreSQL detection. Cached and shared between onboarding and the Servers page. */
export function useDetection() {
  const query = useQuery({
    queryKey: queryKeys.detection("postgres"),
    queryFn: () => unwrap(commands.detectLocal("postgres")),
    // Installs don't change on their own often; rescan is explicit
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const state: DetectionState = query.isFetching
    ? { status: "scanning" }
    : query.error
      ? { status: "error", message: query.error.message }
      : query.data
        ? { status: "done", report: query.data }
        : { status: "scanning" };

  return { state, rescan: () => void query.refetch() };
}

/** Found anything not managed by PostCompass. */
export function foundExternal(report: DetectionReport) {
  return (
    report.installs.some((i) => i.source !== "managed") ||
    report.servers.length > 0
  );
}
