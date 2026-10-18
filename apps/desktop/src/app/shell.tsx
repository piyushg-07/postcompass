import { cn } from "@repo/ui";
import { Database, Home, Palette, Server, Settings } from "lucide-react";
import { type ReactNode, useState } from "react";
import { ExplorerPage } from "../features/explorer/explorer-page";
import { HomePage } from "../features/home/home-page";
import { ServersPage } from "../features/servers/servers-page";
import { SettingsPage } from "../features/settings/settings-page";
import { Playground } from "../playground/playground";
import { useAppState } from "./app-state";
import { CompassMark } from "./compass-mark";

export type Section = "home" | "servers" | "settings" | "playground" | "explorer";

const NAV: { id: Section; label: string; icon: ReactNode; devOnly?: boolean }[] = [
  { id: "home", label: "Home", icon: <Home /> },
  { id: "servers", label: "Servers", icon: <Server /> },
  { id: "settings", label: "Settings", icon: <Settings /> },
  { id: "playground", label: "Components", icon: <Palette />, devOnly: true },
];

export function Shell() {
  const { info, state } = useAppState();
  const [section, setSection] = useState<Section>("home");
  const [installOpen, setInstallOpen] = useState(false);
  const [openServerId, setOpenServerId] = useState<string | null>(null);
  const openServer = state.servers.find((s) => s.id === openServerId);

  const open = (serverId: string) => {
    setOpenServerId(serverId);
    setSection("explorer");
  };

  const openInstall = () => {
    setSection("servers");
    setInstallOpen(true);
  };

  return (
    <div className="flex h-full">
      <nav className="flex w-56 shrink-0 flex-col border-r border-border bg-surface" aria-label="Main">
        <div className="flex h-14 items-center gap-2.5 px-4">
          <CompassMark size={22} />
          <span className="text-sm font-semibold tracking-tight">PostCompass</span>
        </div>
        <ul className="flex flex-1 flex-col gap-0.5 px-2 py-2">
          {NAV.filter((item) => !item.devOnly || import.meta.env.DEV).map((item) => (
            <li key={item.id}>
              <NavButton
                active={section === item.id}
                icon={item.icon}
                label={item.label}
                onClick={() => setSection(item.id)}
              />
            </li>
          ))}
          {openServer && (
            <>
              <li className="px-2.5 pt-4 pb-1 text-[10px] font-medium tracking-wide text-fg-subtle uppercase">Open</li>
              <li>
                <NavButton
                  active={section === "explorer"}
                  icon={<Database />}
                  label={openServer.name}
                  onClick={() => setSection("explorer")}
                />
              </li>
            </>
          )}
        </ul>
        <div className="px-4 py-3 font-mono text-[11px] text-fg-subtle">v{info.version}</div>
      </nav>

      <main className="min-w-0 flex-1 overflow-y-auto">
        {section === "explorer" && openServerId ? (
          <ExplorerPage
            key={openServerId}
            serverId={openServerId}
            onClose={() => {
              setOpenServerId(null);
              setSection("servers");
            }}
          />
        ) : (
          <div className="mx-auto flex max-w-5xl flex-col gap-8 px-8 py-8">
            {section === "home" && (
              <HomePage onInstall={openInstall} onOpenServers={() => setSection("servers")} onOpen={open} />
            )}
            {section === "servers" && (
              <ServersPage installOpen={installOpen} onInstallOpenChange={setInstallOpen} onOpen={open} />
            )}
            {section === "settings" && <SettingsPage />}
            {section === "playground" && <Playground />}
          </div>
        )}
      </main>
    </div>
  );
}

function NavButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex h-8 w-full cursor-pointer items-center gap-2.5 rounded-control px-2.5 text-sm transition-colors [&_svg]:size-4",
        active ? "bg-surface-hover text-fg" : "text-fg-muted hover:bg-surface-hover/60 hover:text-fg",
      )}
    >
      {active && <span className="absolute top-1.5 bottom-1.5 left-0 w-0.5 rounded-full bg-accent" />}
      <span className={active ? "text-accent" : undefined}>{icon}</span>
      <span className="truncate">{label}</span>
    </button>
  );
}
