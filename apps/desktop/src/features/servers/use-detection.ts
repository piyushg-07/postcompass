import { useCallback, useEffect, useState } from "react";
import type { DetectionReport } from "../../lib/bindings";
import { commands, unwrap } from "../../lib/ipc";

export type DetectionState =
  | { status: "scanning" }
  | { status: "done"; report: DetectionReport }
  | { status: "error"; message: string };

/** Runs local PostgreSQL detection on mount; `rescan` runs it again. */
export function useDetection() {
  const [state, setState] = useState<DetectionState>({ status: "scanning" });

  const rescan = useCallback(() => {
    setState({ status: "scanning" });
    unwrap(commands.detectLocal("postgres"))
      .then((report) => setState({ status: "done", report }))
      .catch((e: unknown) => setState({ status: "error", message: e instanceof Error ? e.message : String(e) }));
  }, []);

  useEffect(rescan, [rescan]);

  return { state, rescan };
}

/** Found anything not managed by PostCompass. */
export function foundExternal(report: DetectionReport) {
  return report.installs.some((i) => i.source !== "managed") || report.servers.length > 0;
}
