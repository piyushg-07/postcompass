import { Button } from "@repo/ui";
import { ArrowRight, Eye, Table2, TerminalSquare } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { useAppState } from "../../app/app-state";
import { DataStreams, Mascot } from "../../app/mascot";
import { useNavigation } from "../../app/navigation";
import type { RemoteConnection } from "../../lib/bindings";
import { greeting } from "../../lib/format";
import {
  useQueryLibrary,
  useWorkspaceStore,
} from "../explorer/workspace-store";
import { DatabaseRow } from "../servers/database-card";
import { PROVIDER_LOGOS, ProviderLogo } from "../servers/provider-logos";
import { useServerStatuses } from "../servers/use-server-statuses";

/** Start page: greeting, shortcuts, every connection (local and cloud), and where you left off. */
export function HomePage() {
  const { state } = useAppState();
  const nav = useNavigation();
  const { statuses, setStatus } = useServerStatuses(
    state.servers.map((s) => s.id),
  );
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const history = useQueryLibrary((s) => s.history);

  // Workspaces are keyed by server id, or `remote:<id>` for cloud connections
  const nameOf = (id: string) =>
    id.startsWith("remote:")
      ? state.remoteConnections.find((r) => `remote:${r.id}` === id)?.name
      : state.servers.find((s) => s.id === id)?.name;
  const running = state.servers.filter((s) => statuses[s.id] === "running");
  const localCount = state.servers.length;
  const remoteCount = state.remoteConnections.length;
  const hasAny = localCount + remoteCount > 0;

  const recentTables = Object.entries(workspaces)
    .filter(([id]) => nameOf(id))
    .flatMap(([id, ws]) =>
      (ws.recentTables ?? []).map((table) => ({ serverId: id, table })),
    )
    .sort((a, b) => b.table.at - a.table.at)
    .slice(0, 5);
  const recentQueries = Object.entries(history)
    .filter(([id]) => nameOf(id))
    .flatMap(([id, entries]) =>
      entries.map((entry) => ({ serverId: id, entry })),
    )
    .sort((a, b) => b.entry.at - a.entry.at)
    .slice(0, 5);

  // Counts live in the Connections list below; the banner just says what to do next
  const summary = hasAny
    ? "Pick up where you left off, or open a connection below."
    : "Create a local database or connect to one in the cloud to get started.";

  return (
    <>
      <Hero
        title={greeting(state.profile?.name)}
        summary={summary}
        sleepy={localCount > 0 && running.length === 0 && remoteCount === 0}
      />

      {hasAny && (
        <Section
          title="Connections"
          delay={120}
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
            {state.remoteConnections.map((remote) => (
              <RemoteRow
                key={remote.id}
                remote={remote}
                onOpen={() => nav.openServer(`remote:${remote.id}`)}
              />
            ))}
          </ul>
        </Section>
      )}

      {(recentTables.length > 0 || recentQueries.length > 0) && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Section title="Jump back in" delay={180}>
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
                    meta={`${nameOf(serverId)} · ${table.database}.${table.schema} · ${timeAgo(table.at)}`}
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
          <Section title="Recent queries" delay={240}>
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
                    meta={`${nameOf(serverId)} · ${entry.database} · ${timeAgo(entry.at)}${entry.ok ? "" : " · failed"}`}
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

/** Compact row for a cloud connection, matching the local DatabaseRow. */
function RemoteRow({
  remote,
  onOpen,
}: {
  remote: RemoteConnection;
  onOpen: () => void;
}) {
  const provider = (PROVIDER_LOGOS[remote.provider] ?? PROVIDER_LOGOS.other)!;
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <ProviderLogo provider={remote.provider} className="size-4 shrink-0" />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium text-fg">
          {remote.name}
        </span>
        <span className="truncate text-xs text-fg-subtle">
          {provider.label} ·{" "}
          <span className="font-mono">
            {remote.host}:{remote.port}
          </span>
        </span>
      </div>
      <Button size="sm" variant="primary" onClick={onOpen}>
        Open
      </Button>
    </li>
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

      <div className="relative flex items-center gap-6 px-8 py-5">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <h1 className="font-heading text-3xl font-semibold tracking-tight text-fg">
            {title}
          </h1>
          <p className="max-w-md text-sm text-fg-muted">{summary}</p>
        </div>

        <div className="relative hidden shrink-0 flex-col items-center md:flex">
          <Mascot size={128} mood={sleepy ? "sleepy" : "happy"} />
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
