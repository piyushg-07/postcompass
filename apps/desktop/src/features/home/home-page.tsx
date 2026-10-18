import { Button, cn, EmptyState, Kbd } from "@repo/ui";
import {
  ArrowRight,
  Database,
  Eye,
  Plus,
  Search,
  Table2,
  TerminalSquare,
} from "lucide-react";
import type { ReactNode } from "react";
import { useAppState } from "../../app/app-state";
import { useNavigation } from "../../app/navigation";
import { greeting } from "../../lib/format";
import {
  useQueryLibrary,
  useWorkspaceStore,
} from "../explorer/workspace-store";
import { DatabaseRow } from "../servers/database-card";
import { useServerStatuses } from "../servers/use-server-statuses";

/** Start page: quick actions, your databases, where you left off, recent queries. */
export function HomePage() {
  const { state } = useAppState();
  const nav = useNavigation();
  const { statuses, setStatus } = useServerStatuses(
    state.servers.map((s) => s.id),
  );
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const history = useQueryLibrary((s) => s.history);

  const serverName = (id: string) =>
    state.servers.find((s) => s.id === id)?.name;
  const firstRunning = state.servers.find((s) => statuses[s.id] === "running");
  const runningCount = state.servers.filter(
    (s) => statuses[s.id] === "running",
  ).length;

  // Tables open in each database's explorer; newest tabs are last, so reverse
  const recentTables = Object.entries(workspaces)
    .filter(([id]) => serverName(id))
    .flatMap(([id, ws]) =>
      ws.tabs.flatMap((tab) =>
        tab.type === "table" ? [{ serverId: id, tab }] : [],
      ),
    )
    .reverse()
    .slice(0, 6);

  const recentQueries = Object.entries(history)
    .filter(([id]) => serverName(id))
    .flatMap(([id, entries]) =>
      entries.map((entry) => ({ serverId: id, entry })),
    )
    .sort((a, b) => b.entry.at - a.entry.at)
    .slice(0, 5);

  const newQuery = () => {
    if (!firstRunning) return;
    const database = workspaces[firstRunning.id]?.database ?? "postgres";
    useWorkspaceStore.getState().newQuery(firstRunning.id, database);
    nav.openServer(firstRunning.id);
  };

  return (
    <>
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-fg">
          {greeting(state.profile?.name)}
        </h1>
        <p className="text-sm text-fg-muted">
          {state.servers.length === 0
            ? "Let's create your first database."
            : `${runningCount} of ${state.servers.length} database${state.servers.length === 1 ? "" : "s"} running.`}
        </p>
      </header>

      <section className="grid grid-cols-3 gap-3">
        <QuickAction
          icon={<TerminalSquare />}
          title="New query"
          description={
            firstRunning ? `In ${firstRunning.name}` : "Start a database first"
          }
          disabled={!firstRunning}
          onClick={newQuery}
        />
        <QuickAction
          icon={<Plus />}
          title="New local database"
          description="Install PostgreSQL in one click"
          onClick={nav.startInstall}
        />
        <QuickAction
          icon={<Search />}
          title="Search everything"
          description={
            <span className="flex items-center gap-1">
              Tables and actions <Kbd>Ctrl</Kbd>
              <Kbd>K</Kbd>
            </span>
          }
          onClick={() => nav.setPaletteOpen(true)}
        />
      </section>

      <Section
        title="Your databases"
        action={
          state.servers.length > 0 && (
            <Button
              size="sm"
              variant="ghost"
              iconRight={<ArrowRight />}
              onClick={() => nav.goTo("databases")}
            >
              Manage
            </Button>
          )
        }
      >
        {state.servers.length === 0 ? (
          <div className="rounded-card border border-dashed border-border-strong">
            <EmptyState
              icon={<Database />}
              title="No databases yet"
              description="Create a local PostgreSQL database. It runs only on this computer and needs no admin rights."
              actions={
                <Button
                  variant="primary"
                  iconLeft={<Plus />}
                  onClick={nav.startInstall}
                >
                  New local database
                </Button>
              }
            />
          </div>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-card border border-border bg-surface">
            {state.servers.map((server) => (
              <DatabaseRow
                key={server.id}
                server={server}
                status={statuses[server.id]}
                onStatus={(s) => setStatus(server.id, s)}
              />
            ))}
          </ul>
        )}
      </Section>

      {(recentTables.length > 0 || recentQueries.length > 0) && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Section title="Jump back in">
            {recentTables.length === 0 ? (
              <Muted>Tables you open show up here.</Muted>
            ) : (
              <ul className="overflow-hidden rounded-card border border-border bg-surface">
                {recentTables.map(({ serverId, tab }) => (
                  <ListItem
                    key={`${serverId}:${tab.id}`}
                    icon={
                      tab.kind === "view" ||
                      tab.kind === "materialized_view" ? (
                        <Eye />
                      ) : (
                        <Table2 />
                      )
                    }
                    title={tab.name}
                    meta={`${serverName(serverId)} · ${tab.database}.${tab.schema}`}
                    onClick={() => {
                      useWorkspaceStore.getState().setActive(serverId, tab.id);
                      nav.openServer(serverId);
                    }}
                  />
                ))}
              </ul>
            )}
          </Section>
          <Section title="Recent queries">
            {recentQueries.length === 0 ? (
              <Muted>Queries you run show up here.</Muted>
            ) : (
              <ul className="overflow-hidden rounded-card border border-border bg-surface">
                {recentQueries.map(({ serverId, entry }) => (
                  <ListItem
                    key={`${serverId}:${entry.at}`}
                    icon={<TerminalSquare />}
                    title={
                      <span className="font-mono text-xs">
                        {entry.sql.replace(/\s+/g, " ")}
                      </span>
                    }
                    meta={`${entry.database} · ${timeAgo(entry.at)}${entry.ok ? "" : " · failed"}`}
                    onClick={() => {
                      useWorkspaceStore
                        .getState()
                        .newQuery(serverId, entry.database, entry.sql);
                      nav.openServer(serverId);
                    }}
                  />
                ))}
              </ul>
            )}
          </Section>
        </div>
      )}
    </>
  );
}

function QuickAction({
  icon,
  title,
  description,
  disabled,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  description: ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "group flex cursor-pointer items-start gap-3 rounded-card border border-border bg-surface p-4 text-left transition-colors",
        "hover:border-border-strong hover:bg-surface-hover",
        "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-border disabled:hover:bg-surface",
      )}
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-control border border-border bg-bg text-fg-muted transition-colors group-enabled:group-hover:text-accent [&_svg]:size-4">
        {icon}
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-sm font-medium text-fg">{title}</span>
        <span className="truncate text-xs text-fg-muted">{description}</span>
      </span>
    </button>
  );
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex h-7 items-center justify-between">
        <h2 className="text-sm font-semibold text-fg">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function ListItem({
  icon,
  title,
  meta,
  onClick,
}: {
  icon: ReactNode;
  title: ReactNode;
  meta: string;
  onClick: () => void;
}) {
  return (
    <li className="border-b border-border last:border-b-0">
      <button
        type="button"
        onClick={onClick}
        className="flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-surface-hover [&_svg]:size-4"
      >
        <span className="shrink-0 text-fg-subtle">{icon}</span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm text-fg">{title}</span>
          <span className="truncate text-xs text-fg-subtle">{meta}</span>
        </span>
      </button>
    </li>
  );
}

function Muted({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-card border border-dashed border-border px-4 py-3 text-xs text-fg-subtle">
      {children}
    </p>
  );
}

function timeAgo(at: number) {
  const minutes = Math.round((Date.now() - at) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return new Date(at).toLocaleDateString();
}
