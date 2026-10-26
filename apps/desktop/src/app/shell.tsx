import { cn, Spinner } from "@repo/ui";
import { useHotkey } from "@tanstack/react-hotkeys";
import { lazy, Suspense, useEffect, useRef } from "react";
import { BackupDialog, RestoreDialog } from "../features/backup/backup-dialogs";
import { HomePage } from "../features/home/home-page";
import { CommandPalette } from "../features/palette/command-palette";
import { DatabasesPage } from "../features/servers/databases-page";
import { SettingsPage } from "../features/settings/settings-page";
import { ErrorBoundary } from "./error-boundary";
import { useNavigation } from "./navigation";
import { Sidebar } from "./sidebar/sidebar";
import { useUiPrefs } from "./ui-prefs";
import { useUpdateCheck } from "./updates";

// The explorer pulls in the SQL editor and data grid; load it when a database is first opened
const ExplorerPage = lazy(() =>
  import("../features/explorer/explorer-page").then((m) => ({
    default: m.ExplorerPage,
  })),
);

export function Shell() {
  const section = useNavigation((s) => s.section);
  const openServerId = useNavigation((s) => s.openServerId);
  const closeServer = useNavigation((s) => s.closeServer);
  const toggleSidebar = useUiPrefs((s) => s.toggleSidebar);
  useHotkey("Mod+B", toggleSidebar, { ignoreInputs: false });
  useUpdateCheck();

  const inExplorer = section === "explorer" && openServerId !== null;
  useAutoCollapse(inExplorer);

  return (
    <div className="flex h-full">
      <Sidebar />

      {/* The explorer fills the window and scrolls inside its own panes. `clip` (unlike `hidden`)
          also stops focus and scrollIntoView from scrolling it, which pushed the header and tabs out of view. */}
      <main
        className={cn(
          "min-w-0 flex-1",
          inExplorer ? "overflow-clip" : "overflow-y-auto",
        )}
      >
        <ErrorBoundary resetKey={`${section}:${openServerId}`}>
          {section === "explorer" && openServerId ? (
            <Suspense
              fallback={
                <div className="flex h-full items-center justify-center text-fg-subtle">
                  <Spinner />
                </div>
              }
            >
              <ExplorerPage
                key={openServerId}
                serverId={openServerId}
                onClose={() => closeServer(openServerId)}
              />
            </Suspense>
          ) : (
            <div className="mx-auto flex max-w-5xl flex-col gap-8 px-8 py-8">
              {section === "home" && <HomePage />}
              {section === "databases" && <DatabasesPage />}
              {section === "settings" && <SettingsPage />}
            </div>
          )}
        </ErrorBoundary>
      </main>

      <CommandPalette />
      <BackupDialog />
      <RestoreDialog />
    </div>
  );
}

/**
 * Opening a database collapses the sidebar to give the explorer room; leaving it brings the
 * sidebar back, unless it was already collapsed or the user changed it in the meantime.
 */
function useAutoCollapse(inExplorer: boolean) {
  const collapsed = useUiPrefs((s) => s.sidebarCollapsed);
  const autoCollapsed = useRef(false);
  useEffect(() => {
    const prefs = useUiPrefs.getState();
    if (inExplorer) {
      if (!prefs.sidebarCollapsed) {
        prefs.setSidebarCollapsed(true);
        autoCollapsed.current = true;
      }
    } else if (autoCollapsed.current) {
      autoCollapsed.current = false;
      if (prefs.sidebarCollapsed) prefs.setSidebarCollapsed(false);
    }
  }, [inExplorer]);
  // A manual toggle in the explorer means the user decides from now on
  useEffect(() => {
    if (inExplorer && !collapsed) autoCollapsed.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collapsed]);
}
