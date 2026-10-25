import { Channel } from "@tauri-apps/api/core";
import { useState } from "react";
import { commands, describeError, isCancelled } from "../../lib/ipc";
import { useBackupDialogs } from "./backup-store";

export type Job =
  | { state: "idle" }
  | { state: "running"; id: string }
  | { state: "done"; message: string; path?: string }
  | { state: "failed"; title: string; message: string };

/** Runs a backup/restore job with a live log and cancel. */
export function useJob() {
  const [job, setJob] = useState<Job>({ state: "idle" });
  const [log, setLog] = useState<string[]>([]);
  const [cancelling, setCancelling] = useState(false);

  const run = async <T,>(
    start: (jobId: string, channel: Channel<string>) => Promise<T>,
    onDone: (result: T) => { message: string; path?: string },
  ) => {
    const id = crypto.randomUUID();
    const channel = new Channel<string>();
    channel.onmessage = (line) =>
      setLog((l) =>
        l.length > 2000 ? [...l.slice(-1500), line] : [...l, line],
      );
    setLog([]);
    setCancelling(false);
    setJob({ state: "running", id });
    const store = useBackupDialogs.getState();
    store.setRunning(true);
    try {
      setJob({ state: "done", ...onDone(await start(id, channel)) });
    } catch (e) {
      if (isCancelled(e))
        setJob({
          state: "failed",
          title: "Cancelled",
          message: "Nothing was changed.",
        });
      else setJob({ state: "failed", ...describeError(e) });
    } finally {
      store.setRunning(false);
      setCancelling(false);
    }
  };

  const cancel = () => {
    if (job.state !== "running" || cancelling) return;
    setCancelling(true);
    // A failed request leaves the job running; let the user try again
    void commands.cancelJob(job.id).then(
      (res) => res.status === "error" && setCancelling(false),
      () => setCancelling(false),
    );
  };

  return { job, log, run, cancel, cancelling };
}
