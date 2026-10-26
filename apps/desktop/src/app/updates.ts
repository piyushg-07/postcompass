import { toast } from "@repo/ui";
import { relaunch } from "@tauri-apps/plugin-process";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { useEffect } from "react";
import { describeError } from "../lib/ipc";

// In-app updates. The updater plugin reads latest.json from the newest GitHub release (see
// tauri.conf.json) and verifies each download against the public key there before installing.

/** A newer release, or null when this is the latest version. */
export function checkForUpdate(): Promise<Update | null> {
  return check();
}

/** Downloads and installs an update, then restarts into the new version. */
export function installUpdate(update: Update) {
  return toast.promise(
    update.downloadAndInstall().then(() => relaunch()),
    {
      loading: `Downloading PostCompass ${update.version}…`,
      success: "Update installed. Restarting…",
      error: (e) => `Couldn't install the update: ${describeError(e).message}`,
    },
  );
}

/**
 * Looks for an update shortly after launch and offers it in a toast. Quiet when up to date, offline or
 * before the first release exists; dev builds skip it (they aren't installed, so there's nothing to update).
 */
export function useUpdateCheck() {
  useEffect(() => {
    if (import.meta.env.DEV) return;
    let cancelled = false;
    // A short delay so the check doesn't compete with loading the app
    const timer = window.setTimeout(() => {
      checkForUpdate()
        .then((update) => {
          if (!update || cancelled) return;
          toast.info(`PostCompass ${update.version} is available`, {
            description: "Install it now. The app restarts in a few seconds.",
            action: { label: "Update now", onClick: () => void installUpdate(update).catch(() => {}) },
            duration: Infinity,
          });
        })
        // Offline, rate-limited or no release yet: try again next launch
        .catch(() => {});
    }, 3000);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);
}
