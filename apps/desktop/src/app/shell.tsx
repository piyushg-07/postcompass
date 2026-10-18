import { cn, Kbd, Spinner, Tooltip } from "@repo/ui";
import { useHotkey } from "@tanstack/react-hotkeys";
import {
  Database,
  Home,
  Palette,
  PanelLeftClose,
  PanelLeftOpen,
  Server,
  Settings,
} from "lucide-react";
import { lazy, type ReactNode, Suspense } from "react";
import { HomePage } from "../features/home/home-page";
import { ServersPage } from "../features/servers/servers-page";
import { BackupDialog, RestoreDialog } from "../features/backup/backup-dialogs";
import { CommandPalette } from "../features/palette/command-palette";
import { SettingsPage } from "../features/settings/settings-page";
import { Playground } from "../playground/playground";
import { useAppState } from "./app-state";
import { CompassMark } from "./compass-mark";
import { type Section, useNavigation } from "./navigation";
import { useUiPrefs } from "./ui-prefs";

// The explorer pulls in the SQL editor and data grid; load it when a server is first opened
const ExplorerPage = lazy(() =>
  import("../features/explorer/explorer-page").then((m) => ({
    default: m.ExplorerPage,
  })),
);

const NAV: {
  id: Section;
  label: string;
  icon: ReactNode;
  devOnly?: boolean;
}[] = [
  { id: "home", label: "Home", icon: <Home /> },
  { id: "servers", label: "Servers", icon: <Server /> },
  { id: "settings", label: "Settings", icon: <Settings /> },
  { id: "playground", label: "Components", icon: <Palette />, devOnly: true },
];

export function Shell() {
  const { info, state } = useAppState();
  const section = useNavigation((s) => s.section);
  const openServerId = useNavigation((s) => s.openServerId);
  const goTo = useNavigation((s) => s.goTo);
  const closeServer = useNavigation((s) => s.closeServer);
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
        <div
          className={cn(
            "flex h-14 items-center gap-2.5",
            collapsed ? "justify-center px-0" : "px-4",
          )}
        >
          <span className="shrink-0">
            <CompassMark size={22} />
          </span>
          {!collapsed && (
            <span className="text-sm font-semibold tracking-tight whitespace-nowrap">
              PostCompass
            </span>
          )}
        </div>
        <ul className="flex flex-1 flex-col gap-0.5 px-2 py-2">
          {NAV.filter((item) => !item.devOnly || import.meta.env.DEV).map(
            (item) => (
              <li key={item.id}>
                <NavButton
                  active={section === item.id}
                  icon={item.icon}
                  label={item.label}
                  collapsed={collapsed}
                  onClick={() => goTo(item.id)}
                />
              </li>
            ),
          )}
          {openServer && (
            <>
              {collapsed ? (
                <li className="mx-2 my-2 h-px bg-border" aria-hidden />
              ) : (
                <li className="px-2.5 pt-4 pb-1 text-[10px] font-medium tracking-wide text-fg-subtle uppercase">
                  Open
                </li>
              )}
              <li>
                <NavButton
                  active={section === "explorer"}
                  icon={<Database />}
                  label={openServer.name}
                  collapsed={collapsed}
                  onClick={() => goTo("explorer")}
                />
              </li>
            </>
          )}
        </ul>
        <div
          className={cn(
            "flex items-center gap-2 border-t border-border py-2",
            collapsed ? "justify-center px-0" : "justify-between pr-2 pl-4",
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

      <main className="min-w-0 flex-1 overflow-y-auto">
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
            {section === "servers" && <ServersPage />}
            {section === "settings" && <SettingsPage />}
            {section === "playground" && <Playground />}
          </div>
        )}
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
  onClick,
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  collapsed: boolean;
  onClick: () => void;
}) {
  const button = (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex h-8 w-full cursor-pointer items-center gap-2.5 rounded-control text-sm transition-colors [&_svg]:size-4",
        collapsed ? "justify-center px-0" : "px-2.5",
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
        <span className="truncate whitespace-nowrap">{label}</span>
      )}
    </button>
  );
  // Collapsed: the icon alone, with the label as a tooltip
  return collapsed ? (
    <Tooltip side="right" content={label}>
      {button}
    </Tooltip>
  ) : (
    button
  );
}
