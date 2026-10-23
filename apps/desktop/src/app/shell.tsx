import { cn, Kbd, Spinner, Tooltip } from "@repo/ui";
import { useHotkey } from "@tanstack/react-hotkeys";
import {
  Database,
  Home,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
  X,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { lazy, type ReactNode, Suspense, useEffect, useRef } from "react";
import { BackupDialog, RestoreDialog } from "../features/backup/backup-dialogs";
import { HomePage } from "../features/home/home-page";
import { CommandPalette } from "../features/palette/command-palette";
import { DatabasesPage } from "../features/servers/databases-page";
import {
  LocalServerLogo,
  ProviderLogo,
} from "../features/servers/provider-logos";
import type { OpenedConnection } from "../lib/bindings";
import { commands } from "../lib/ipc";
import { queryKeys } from "../lib/query";
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
  const openServerIds = useNavigation((s) => s.openServerIds);
  const goTo = useNavigation((s) => s.goTo);
  const openServer = useNavigation((s) => s.openServer);
  const closeServer = useNavigation((s) => s.closeServer);
  const setPaletteOpen = useNavigation((s) => s.setPaletteOpen);
  const queryClient = useQueryClient();

  // Connections kept in the sidebar, skipping any that were removed since
  const openConnections = openServerIds.flatMap<{
    id: string;
    name: string;
    detail: string;
    provider: string | null;
  }>((id) => {
    if (id.startsWith("remote:")) {
      const remote = state.remoteConnections.find(
        (r) => r.id === id.replace(/^remote:/, ""),
      );
      return remote
        ? [
            {
              id,
              name: remote.name,
              detail: remote.database,
              provider: remote.provider,
            },
          ]
        : [];
    }
    const server = state.servers.find((x) => x.id === id);
    return server
      ? [
          {
            id,
            name: server.name,
            detail: `localhost:${server.port}`,
            provider: null,
          },
        ]
      : [];
  });

  /** Closes the connection behind a sidebar entry and takes it out of the list. */
  const disconnect = async (id: string) => {
    const opened = queryClient.getQueryData<OpenedConnection>(
      queryKeys.connection(id),
    );
    if (opened) {
      await commands.closeConnection(opened.connectionId);
      queryClient.removeQueries({
        queryKey: queryKeys.explorer.all(opened.connectionId),
      });
    }
    queryClient.removeQueries({ queryKey: queryKeys.connection(id) });
    closeServer(id);
  };

  const collapsed = useUiPrefs((s) => s.sidebarCollapsed);
  const toggleSidebar = useUiPrefs((s) => s.toggleSidebar);
  useHotkey("Mod+B", toggleSidebar, { ignoreInputs: false });

  // Opening a database collapses the sidebar to give the explorer room; leaving it brings the
  // sidebar back, unless it was already collapsed or the user changed it in the meantime.
  const autoCollapsed = useRef(false);
  const inExplorer = section === "explorer" && openServerId !== null;
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
                  onClose={() => void disconnect(c.id)}
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
 * One open connection in the sidebar: its logo (the PostgreSQL elephant, or the cloud provider's),
 * a dot while connected, and × on hover to disconnect.
 */
function ConnectionButton({
  id,
  name,
  detail,
  provider,
  active,
  collapsed,
  onOpen,
  onClose,
}: {
  id: string;
  name: string;
  detail: string;
  /** Cloud provider, or null for a local server. */
  provider: string | null;
  active: boolean;
  collapsed: boolean;
  onOpen: () => void;
  onClose: () => void;
}) {
  // Reads the explorer's cached session without opening one
  const connection = useQuery<OpenedConnection>({
    queryKey: queryKeys.connection(id),
    enabled: false,
  });
  const connected = connection.data !== undefined;
  const logo =
    provider === null ? (
      <LocalServerLogo status={connected ? "running" : undefined} />
    ) : (
      <span className="relative inline-flex shrink-0">
        <ProviderLogo provider={provider} className="size-4" />
        {connected && (
          <span className="absolute -right-0.5 -bottom-0.5 size-1.5 rounded-full bg-accent ring-2 ring-surface" />
        )}
      </span>
    );

  const button = (
    <div
      className={cn(
        "group/conn relative flex h-8 w-full items-center rounded-control text-sm transition-colors",
        active
          ? "bg-surface-hover text-fg"
          : "text-fg-muted hover:bg-surface-hover/60 hover:text-fg",
      )}
    >
      {active && (
        <span className="absolute top-1.5 bottom-1.5 left-0 w-0.5 rounded-full bg-accent" />
      )}
      <button
        type="button"
        onClick={onOpen}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex h-full min-w-0 flex-1 cursor-pointer items-center gap-2.5",
          collapsed ? "justify-center" : "pl-2.5",
        )}
      >
        {logo}
        {collapsed ? (
          <span className="sr-only">{name}</span>
        ) : (
          <span className="flex min-w-0 flex-1 flex-col text-left leading-tight">
            <span className="truncate whitespace-nowrap">{name}</span>
          </span>
        )}
      </button>
      <button
        type="button"
        aria-label={`Disconnect ${name}`}
        onClick={onClose}
        className={cn(
          "flex size-5 shrink-0 cursor-pointer items-center justify-center rounded text-fg-subtle opacity-0 group-hover/conn:opacity-100 hover:bg-surface-raised hover:text-fg focus-visible:opacity-100",
          collapsed
            ? "absolute -top-1 -right-1 size-4 rounded-full border border-border-strong bg-surface-raised"
            : "mr-1.5",
        )}
      >
        <X className="size-3" />
      </button>
    </div>
  );
  return (
    <Tooltip
      side="right"
      content={
        <span className="flex flex-col">
          <span>{name}</span>
          <span className="font-mono text-[11px] text-fg-muted">{detail}</span>
        </span>
      }
    >
      {button}
    </Tooltip>
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
