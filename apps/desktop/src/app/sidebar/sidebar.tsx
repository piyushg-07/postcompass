import { cn, Kbd, Tooltip } from "@repo/ui";
import { useQueryClient } from "@tanstack/react-query";
import {
  Database,
  Home,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
} from "lucide-react";
import type { ReactNode } from "react";
import { closeConnection } from "../../features/servers/connection-cache";
import { useAppState } from "../app-state";
import { type Section, useNavigation } from "../navigation";
import { useUiPrefs } from "../ui-prefs";
import { ConnectionButton } from "./connection-button";
import { NavButton } from "./nav-button";
import { useOpenConnections } from "./use-open-connections";

const MAIN_NAV: { id: Section; label: string; icon: ReactNode }[] = [
  { id: "home", label: "Home", icon: <Home /> },
  { id: "databases", label: "Databases", icon: <Database /> },
];

/** Main navigation, the connections kept open, settings and the collapse toggle. */
export function Sidebar() {
  const { info } = useAppState();
  const section = useNavigation((s) => s.section);
  const openServerId = useNavigation((s) => s.openServerId);
  const goTo = useNavigation((s) => s.goTo);
  const openServer = useNavigation((s) => s.openServer);
  const closeServer = useNavigation((s) => s.closeServer);
  const setPaletteOpen = useNavigation((s) => s.setPaletteOpen);
  const collapsed = useUiPrefs((s) => s.sidebarCollapsed);
  const toggleSidebar = useUiPrefs((s) => s.toggleSidebar);
  const queryClient = useQueryClient();
  const openConnections = useOpenConnections();

  /** Closes the connection behind a sidebar entry and takes it out of the list. */
  const disconnect = (id: string) => {
    // Leave the explorer first, so it never renders against a session that is being closed;
    // the entry also goes away even if closing the session fails.
    closeServer(id);
    void closeConnection(queryClient, id);
  };

  return (
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

      {openConnections.length > 0 && (
        <ul className="flex min-h-0 flex-col gap-0.5 overflow-y-auto px-2">
          {collapsed ? (
            <li className="mx-2 my-1 h-px bg-border" aria-hidden />
          ) : (
            <li className="px-2.5 pt-3 pb-1 text-[10px] font-medium tracking-wide text-fg-subtle uppercase">
              Open now
            </li>
          )}
          {openConnections.map((c) => (
            <li key={c.id}>
              <ConnectionButton
                id={c.id}
                name={c.name}
                detail={c.detail}
                provider={c.provider}
                active={section === "explorer" && openServerId === c.id}
                collapsed={collapsed}
                onOpen={() => openServer(c.id)}
                onClose={() => disconnect(c.id)}
              />
            </li>
          ))}
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
  );
}
