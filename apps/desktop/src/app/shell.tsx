import { cn, Kbd, Spinner, Tooltip } from "@repo/ui";
import { useHotkey } from "@tanstack/react-hotkeys";
import {
  Database,
  Home,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
  Table2,
} from "lucide-react";
import { lazy, type ReactNode, Suspense } from "react";
import { BackupDialog, RestoreDialog } from "../features/backup/backup-dialogs";
import { HomePage } from "../features/home/home-page";
import { CommandPalette } from "../features/palette/command-palette";
import { DatabasesPage } from "../features/servers/databases-page";
import { SettingsPage } from "../features/settings/settings-page";
import { useAppState } from "./app-state";
import { ErrorBoundary } from "./error-boundary";
import { type Section, useNavigation } from "./navigation";
import { useUiPrefs } from "./ui-prefs";

// The explorer pulls in the SQL editor and data grid; load it when a database is first opened
const ExplorerPage = lazy(() =>
  import("../features/explorer/explorer-page").then((m) => ({
    default: m.ExplorerPage,
  })),
);

const MAIN_NAV: { id: Section; label: string; icon: ReactNode }[] = [
  { id: "home", label: "Home", icon: <Home /> },
  { id: "databases", label: "Databases", icon: <Database /> },
];

export function Shell() {
  const { info, state } = useAppState();
  const section = useNavigation((s) => s.section);
  const openServerId = useNavigation((s) => s.openServerId);
  const goTo = useNavigation((s) => s.goTo);
  const closeServer = useNavigation((s) => s.closeServer);
  const setPaletteOpen = useNavigation((s) => s.setPaletteOpen);
  const openServer = state.servers.find((s) => s.id === openServerId);
  const collapsed = useUiPrefs((s) => s.sidebarCollapsed);
  const toggleSidebar = useUiPrefs((s) => s.toggleSidebar);
  useHotkey("Mod+B", toggleSidebar, { ignoreInputs: false });

  return (
    <div className="flex h-full">
      <nav
        className={cn(
          "flex shrink-0 flex-col overflow-hidden border-r border-border bg-surface transition-[width] duration-200 ease-out",
          collapsed ? "w-14" : "w-56",
        )}
        aria-label="Main"
      >
        {/* The window title bar already shows the app name and icon */}
        <ul className="flex flex-col gap-0.5 px-2 pt-3 pb-2">
          {MAIN_NAV.map((item) => (
            <li key={item.id}>
              <NavButton
                active={section === item.id}
                icon={item.icon}
                label={item.label}
                collapsed={collapsed}
                onClick={() => goTo(item.id)}
              />
            </li>
          ))}
          <li>
            <NavButton
              active={false}
              icon={<Search />}
              label="Search"
              shortcut={["Ctrl", "K"]}
              collapsed={collapsed}
              onClick={() => setPaletteOpen(true)}
            />
          </li>
        </ul>

        {openServer && (
          <ul className="flex flex-col gap-0.5 px-2">
            {collapsed ? (
              <li className="mx-2 my-1 h-px bg-border" aria-hidden />
            ) : (
              <li className="px-2.5 pt-3 pb-1 text-[10px] font-medium tracking-wide text-fg-subtle uppercase">
                Open now
              </li>
            )}
            <li>
              <NavButton
                active={section === "explorer"}
                icon={<Table2 />}
                label={openServer.name}
                collapsed={collapsed}
                onClick={() => goTo("explorer")}
              />
            </li>
          </ul>
        )}

        {/* Settings and the collapse toggle live at the bottom */}
        <ul className="mt-auto flex flex-col gap-0.5 px-2 py-2">
          <li>
            <NavButton
              active={section === "settings"}
              icon={<Settings />}
              label="Settings"
              collapsed={collapsed}
              onClick={() => goTo("settings")}
            />
          </li>
        </ul>
        <div
          className={cn(
            "flex h-11 shrink-0 items-center gap-2 border-t border-border",
            collapsed ? "justify-center" : "justify-between pr-2 pl-4",
          )}
        >
          {!collapsed && (
            <span className="font-mono text-[11px] whitespace-nowrap text-fg-subtle">
              v{info.version}
            </span>
          )}
          <Tooltip
            side="right"
            content={
              <span className="flex items-center gap-2">
                {collapsed ? "Expand sidebar" : "Collapse sidebar"}
                <span className="flex gap-0.5">
                  <Kbd>Ctrl</Kbd>
                  <Kbd>B</Kbd>
                </span>
              </span>
            }
          >
            <button
              type="button"
              onClick={toggleSidebar}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-expanded={!collapsed}
              className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-control text-fg-subtle transition-colors hover:bg-surface-hover hover:text-fg [&_svg]:size-4"
            >
              {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
            </button>
          </Tooltip>
        </div>
      </nav>

      {/* The explorer fills the window and scrolls inside its own panes. `clip` (unlike `hidden`)
          also stops focus and scrollIntoView from scrolling it, which pushed the header and tabs out of view. */}
      <main
        className={cn(
          "min-w-0 flex-1",
          section === "explorer" && openServerId
            ? "overflow-clip"
            : "overflow-y-auto",
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
                onClose={closeServer}
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

function NavButton({
  active,
  icon,
  label,
  collapsed,
  shortcut,
  onClick,
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  collapsed: boolean;
  /** Keys shown on the right when expanded, e.g. ["Ctrl", "K"]. */
  shortcut?: string[];
  onClick: () => void;
}) {
  const button = (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex h-8 w-full cursor-pointer items-center gap-2.5 rounded-control text-sm transition-colors [&_svg]:size-4",
        collapsed ? "justify-center" : "px-2.5",
        active
          ? "bg-surface-hover text-fg"
          : "text-fg-muted hover:bg-surface-hover/60 hover:text-fg",
      )}
    >
      {active && (
        <span className="absolute top-1.5 bottom-1.5 left-0 w-0.5 rounded-full bg-accent" />
      )}
      <span className={cn("shrink-0", active && "text-accent")}>{icon}</span>
      {collapsed ? (
        <span className="sr-only">{label}</span>
      ) : (
        <span className="flex-1 truncate text-left whitespace-nowrap">
          {label}
        </span>
      )}
      {!collapsed && shortcut && (
        <span className="flex shrink-0 gap-0.5">
          {shortcut.map((key) => (
            <Kbd key={key}>{key}</Kbd>
          ))}
        </span>
      )}
    </button>
  );
  // Collapsed: just the icon, with the label as a tooltip
  return collapsed ? (
    <Tooltip side="right" content={label}>
      {button}
    </Tooltip>
  ) : (
    button
  );
}
