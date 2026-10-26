import type { TaskStepState } from "@repo/ui";
import { useCallback, useState } from "react";
import type { InstallEvent, InstallStep } from "../../../lib/bindings";

const STEP_LABELS: Record<InstallStep, string> = {
  check_system: "Checking system",
  download: "Downloading PostgreSQL",
  verify: "Verifying checksum",
  extract: "Extracting files",
  initialize: "Setting up the server",
  start: "Starting the server",
  connect: "Connecting",
};
const STEP_ORDER = Object.keys(STEP_LABELS) as InstallStep[];
/** Only needed when the version isn't on this computer yet. */
export const DOWNLOAD_STEPS = new Set<InstallStep>(["download", "verify", "extract"]);

/** Most lines kept from the installer's log; older ones are dropped. */
const MAX_LOG_LINES = 500;

/** Live install state, fed by the events Rust streams over the install channel. */
export function useInstallProgress() {
  const [states, setStates] = useState<
    Partial<Record<InstallStep, { state: TaskStepState; detail?: string }>>
  >({});
  const [download, setDownload] = useState<{
    downloaded: number;
    total: number | null;
  } | null>(null);
  const [log, setLog] = useState<string[]>([]);

  const handle = useCallback((event: InstallEvent) => {
    switch (event.type) {
      case "step": {
        const state: TaskStepState =
          event.state === "active"
            ? "active"
            : event.state === "done"
              ? "done"
              : event.state === "skipped"
                ? "skipped"
                : "error";
        setStates((s) => ({
          ...s,
          [event.step]: { state, detail: event.detail ?? undefined },
        }));
        break;
      }
      case "download":
        setDownload({ downloaded: event.downloaded ?? 0, total: event.total });
        break;
      case "log":
        setLog((l) =>
          l.length > MAX_LOG_LINES
            ? [...l.slice(-400), event.line]
            : [...l, event.line],
        );
        break;
    }
  }, []);

  const reset = useCallback(() => {
    setStates({});
    setDownload(null);
    setLog([]);
  }, []);

  const steps = STEP_ORDER.map((id) => ({
    id,
    label: STEP_LABELS[id],
    state: states[id]?.state ?? ("pending" as const),
    detail: states[id]?.detail,
  }));
  const activeStep = STEP_ORDER.find((id) => states[id]?.state === "active");

  return { steps, download, log, handle, reset, activeStep };
}
