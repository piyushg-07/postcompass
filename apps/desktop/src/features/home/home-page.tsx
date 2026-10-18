import { Button, EmptyState } from "@repo/ui";
import { ArrowRight, Eye, Plus, Table2, TerminalSquare } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { useAppState } from "../../app/app-state";
import { DataStreams, Mascot } from "../../app/mascot";
import { useNavigation } from "../../app/navigation";
import { greeting } from "../../lib/format";
import {
  useQueryLibrary,
  useWorkspaceStore,
} from "../explorer/workspace-store";
import { DatabaseRow } from "../servers/database-card";
import { useServerStatuses } from "../servers/use-server-statuses";

/** Start page: a friendly banner, your databases, and where you left off. */
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
  const running = state.servers.filter((s) => statuses[s.id] === "running");
  const hasDatabases = state.servers.length > 0;

  const recentTables = Object.entries(workspaces)
    .filter(([id]) => serverName(id))
    .flatMap(([id, ws]) =>
      (ws.recentTables ?? []).map((table) => ({ serverId: id, table })),
    )
    .sort((a, b) => b.table.at - a.table.at)
    .slice(0, 5);
  const recentQueries = Object.entries(history)
    .filter(([id]) => serverName(id))
    .flatMap(([id, entries]) =>
      entries.map((entry) => ({ serverId: id, entry })),
    )
    .sort((a, b) => b.entry.at - a.entry.at)
    .slice(0, 5);

  const summary = !hasDatabases
    ? "Let's set up your first database. It takes about a minute."
    : running.length === 0
      ? "Your databases are resting. Start one to get going."
      : `${running.length} of ${state.servers.length} database${state.servers.length === 1 ? " is" : "s are"} running and ready.`;

  return (
    <>
      <Hero
        title={greeting(state.profile?.name)}
        summary={summary}
        sleepy={hasDatabases && running.length === 0}
      />

      {!hasDatabases ? (
        <Section title="Your databases" delay={100}>
          <div className="rounded-card border border-dashed border-border-strong">
            <EmptyState
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
        </Section>
      ) : (
        <Section
          title="Your databases"
          delay={100}
          action={
            <Button
              size="sm"
              variant="ghost"
              iconRight={<ArrowRight />}
              onClick={() => nav.goTo("databases")}
            >
              Manage
            </Button>
          }
        >
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
        </Section>
      )}

      {(recentTables.length > 0 || recentQueries.length > 0) && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Section title="Jump back in" delay={160}>
            {recentTables.length === 0 ? (
              <Muted>Tables you open show up here.</Muted>
            ) : (
              <ul className="overflow-hidden rounded-card border border-border bg-surface">
                {recentTables.map(({ serverId, table }) => (
                  <ListItem
                    key={`${serverId}:${table.database}.${table.schema}.${table.name}`}
                    icon={
                      table.kind === "view" ||
                      table.kind === "materialized_view" ? (
                        <Eye />
                      ) : (
                        <Table2 />
                      )
                    }
                    title={table.name}
                    meta={`${serverName(serverId)} · ${table.database}.${table.schema} · ${timeAgo(table.at)}`}
                    onClick={() => {
                      const ws = useWorkspaceStore.getState();
                      ws.setLocation(serverId, {
                        database: table.database,
                        schema: table.schema,
                      });
                      ws.openTab(serverId, {
                        type: "table",
                        database: table.database,
                        schema: table.schema,
                        name: table.name,
                        kind: table.kind,
                        view: "data",
                      });
                      nav.openServer(serverId);
                    }}
                  />
                ))}
              </ul>
            )}
          </Section>
          <Section title="Recent queries" delay={220}>
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

/** Greeting banner with Compi. */
function Hero({
  title,
  summary,
  sleepy,
}: {
  title: string;
  summary: string;
  sleepy: boolean;
}) {
  return (
    <section className="pc-rise relative overflow-hidden rounded-[14px] border border-border bg-surface">
      <div
        className="pc-grid pointer-events-none absolute inset-0"
        aria-hidden
      />
      <DataStreams className="pointer-events-none absolute top-0 right-[80px] h-full w-[45%] opacity-70" />
      <div
        className="pointer-events-none absolute -top-24 -right-16 size-80 rounded-full bg-accent/10 blur-3xl"
        aria-hidden
      />

      <div className="relative flex items-center gap-6 px-8 py-6">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-tight text-fg">
            {title}
          </h1>
          <p className="max-w-md text-sm text-fg-muted">{summary}</p>
        </div>

        <div className="relative hidden shrink-0 flex-col items-center md:flex">
          <Mascot size={156} mood={sleepy ? "sleepy" : "happy"} />
        </div>
      </div>
    </section>
  );
}

function Section({
  title,
  action,
  delay = 0,
  children,
}: {
  title: string;
  action?: ReactNode;
  delay?: number;
  children: ReactNode;
}) {
  return (
    <section
      className="pc-rise flex flex-col gap-3"
      style={{ "--pc-delay": `${delay}ms` } as CSSProperties}
    >
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
        className="group flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-surface-hover [&_svg]:size-4"
      >
        <span className="shrink-0 text-fg-subtle transition-colors group-hover:text-accent">
          {icon}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm text-fg">{title}</span>
          <span className="truncate text-xs text-fg-subtle">{meta}</span>
        </span>
        <ArrowRight className="size-3.5 shrink-0 text-fg-subtle opacity-0 transition-opacity group-hover:opacity-100" />
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
