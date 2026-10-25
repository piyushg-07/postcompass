import { Button } from "@repo/ui";
import { ArrowRight, Eye, Table2, TerminalSquare } from "lucide-react";
import {
  type CSSProperties,
  type PointerEvent,
  type ReactNode,
  useRef,
} from "react";
import { useAppState } from "../../app/app-state";
import { DataNetwork } from "../../app/data-network";
import { Mascot } from "../../app/mascot";
import { useNavigation } from "../../app/navigation";
import type { RemoteConnection } from "../../lib/bindings";
import {
  useQueryLibrary,
  useWorkspaceStore,
} from "../explorer/workspace-store";
import { DatabaseRow } from "../servers/database-card";
import { PROVIDER_LOGOS, ProviderLogo } from "../servers/provider-logos";
import { useServerStatuses } from "../servers/use-server-statuses";

/** Start page: a live network banner, every connection (local and cloud), and where you left off. */
export function HomePage() {
  const { state } = useAppState();
  // Just the actions: subscribing to the whole store re-rendered Home on every navigation change
  const goTo = useNavigation((s) => s.goTo);
  const openServer = useNavigation((s) => s.openServer);
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

  return (
    <>
      <Hero />

      {hasAny && (
        <Section
          title="Connections"
          delay={120}
          action={
            <Button
              size="sm"
              variant="ghost"
              iconRight={<ArrowRight />}
              onClick={() => goTo("databases")}
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
                onOpen={() => openServer(`remote:${remote.id}`)}
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
                      openServer(serverId);
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
                      openServer(serverId);
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

/**
 * Full-width live network banner with Compi and the PostCompass name in the middle.
 * The centre leans towards the cursor (parallax); the network reacts to hover and clicks.
 */
function Hero() {
  const centre = useRef<HTMLDivElement>(null);
  const frame = useRef(0);

  const lean = (e: PointerEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      if (centre.current)
        centre.current.style.transform = `translate(${x * 18}px, ${y * 12}px)`;
    });
  };
  const settle = () => {
    cancelAnimationFrame(frame.current);
    if (centre.current) centre.current.style.transform = "";
  };

  return (
    <section
      onPointerMove={lean}
      onPointerLeave={settle}
      className="pc-rise relative h-[300px] overflow-hidden rounded-[14px] border border-border bg-surface"
    >
      <div
        className="pointer-events-none absolute -top-32 left-1/2 size-[480px] -translate-x-1/2 rounded-full bg-accent/8 blur-3xl"
        aria-hidden
      />
      <DataNetwork className="absolute inset-0 size-full cursor-crosshair" />
      {/* Darker centre so Compi and the name stand out from the network */}
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_38%_60%_at_50%_50%,var(--color-surface)_35%,transparent_100%)]"
        aria-hidden
      />
      {/* Fade the edges into the card */}
      <div
        className="pointer-events-none absolute inset-0 shadow-[inset_0_0_60px_20px_var(--color-surface)]"
        aria-hidden
      />

      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div
          ref={centre}
          className="flex items-center gap-5 transition-transform duration-300 ease-out"
        >
          <Mascot size={150} />
          <div className="flex flex-col gap-1">
            <span className="flex items-baseline gap-0.5 text-5xl text-fg">
              <span className="font-brand font-bold tracking-tighter">
                Post
              </span>
              <span className="bg-gradient-to-r from-accent to-[#7ee7b8] bg-clip-text pr-1 font-serif text-[3.4rem] leading-none text-transparent italic">
                Compass
              </span>
            </span>
            <span className="text-sm text-fg-subtle">
              Your PostgreSQL, charted.
            </span>
          </div>
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
