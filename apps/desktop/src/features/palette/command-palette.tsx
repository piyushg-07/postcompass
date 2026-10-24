import { cn, Kbd, toast } from "@repo/ui";
import { useHotkey } from "@tanstack/react-hotkeys";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArchiveRestore,
  Blocks,
  Bookmark,
  Cloud,
  Database,
  DatabaseBackup,
  Eye,
  FunctionSquare,
  Hash,
  Home,
  Layers,
  Network,
  PanelLeft,
  Pencil,
  Play,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Square,
  Table2,
  TerminalSquare,
  Type,
  Zap,
} from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useAppState } from "../../app/app-state";
import { useNavigation } from "../../app/navigation";
import { useUiPrefs } from "../../app/ui-prefs";
import type {
  DatabaseInfo,
  OpenedConnection,
  SchemaObjects,
  ServerStatus,
  TableInfo,
} from "../../lib/bindings";
import { commands, describeError, unwrap } from "../../lib/ipc";
import { queryKeys } from "../../lib/query";
import { useBackupDialogs } from "../backup/backup-store";
import { useCreateTableSheet } from "../explorer/create-table-sheet";
import {
  useQueryLibrary,
  useWorkspaceStore,
} from "../explorer/workspace-store";
import { PROVIDER_LOGOS } from "../servers/provider-logos";
import { fuzzyScore } from "./fuzzy";

interface Command {
  id: string;
  group: string;
  label: string;
  /** Extra words that match but aren't shown, e.g. the schema name. */
  keywords?: string;
  hint?: string;
  icon: ReactNode;
  run: () => void;
}

const MAX_RESULTS = 60;

/** Ctrl/⌘+K: jump anywhere and run any action. */
export function CommandPalette() {
  const open = useNavigation((s) => s.paletteOpen);
  const setOpen = useNavigation((s) => s.setPaletteOpen);
  useHotkey("Mod+K", () => setOpen((o) => !o), { ignoreInputs: false });

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-fade-in" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed top-[14%] left-1/2 z-50 flex w-[620px] max-w-[calc(100vw-32px)] -translate-x-1/2 flex-col overflow-hidden rounded-card border border-border-strong bg-surface-raised shadow-2xl shadow-black/70 data-[state=open]:animate-fade-in"
        >
          <DialogPrimitive.Title className="sr-only">
            Command palette
          </DialogPrimitive.Title>
          {open && <PaletteBody onClose={() => setOpen(false)} />}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function PaletteBody({ onClose }: { onClose: () => void }) {
  const commandsList = useCommands();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const haystacks = useMemo(
    () =>
      commandsList.map((c) => `${c.label} ${c.keywords ?? ""}`.toLowerCase()),
    [commandsList],
  );
  const results = useMemo(() => {
    if (!query.trim()) return commandsList.slice(0, MAX_RESULTS);
    return commandsList
      .map((c, i) => ({ c, score: fuzzyScore(query, haystacks[i]!) }))
      .filter((r): r is { c: Command; score: number } => r.score !== null)
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_RESULTS)
      .map((r) => r.c);
  }, [commandsList, haystacks, query]);

  useEffect(() => setActive(0), [query]);
  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const runCommand = (command: Command | undefined) => {
    if (!command) return;
    onClose();
    // Let the dialog close before running, so focus lands where the command sends it
    setTimeout(command.run, 0);
  };

  // Group in result order while keeping a flat index for keyboard navigation
  const groups: {
    name: string;
    items: { command: Command; index: number }[];
  }[] = [];
  results.forEach((command, index) => {
    let group = groups.find((g) => g.name === command.group);
    if (!group) groups.push((group = { name: command.group, items: [] }));
    group.items.push({ command, index });
  });

  return (
    <>
      <div className="flex items-center gap-2 border-b border-border px-3">
        <Search className="size-4 text-fg-subtle" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, results.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              runCommand(results[active]);
            }
          }}
          placeholder="Search tables, servers, actions…"
          className="h-12 flex-1 bg-transparent text-sm text-fg outline-none placeholder:text-fg-subtle"
        />
        <Kbd>Esc</Kbd>
      </div>
      <div
        ref={listRef}
        className="max-h-[420px] overflow-y-auto p-1.5"
        role="listbox"
      >
        {results.length === 0 ? (
          <p className="px-3 py-8 text-center text-sm text-fg-subtle">
            No matches
          </p>
        ) : (
          groups.map((group) => (
            <div key={group.name} className="mb-1">
              <div className="px-2.5 pt-2 pb-1 text-[10px] font-medium tracking-wide text-fg-subtle uppercase">
                {group.name}
              </div>
              {group.items.map(({ command, index }) => (
                <button
                  key={command.id}
                  type="button"
                  role="option"
                  aria-selected={index === active}
                  data-index={index}
                  onMouseMove={() => setActive(index)}
                  onClick={() => runCommand(command)}
                  className={cn(
                    "flex h-9 w-full cursor-pointer items-center gap-3 rounded-control px-2.5 text-left text-sm [&_svg]:size-4",
                    index === active
                      ? "bg-surface-hover text-fg"
                      : "text-fg-muted",
                  )}
                >
                  <span
                    className={
                      index === active ? "text-accent" : "text-fg-subtle"
                    }
                  >
                    {command.icon}
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    {command.label}
                  </span>
                  {command.hint && (
                    <span className="max-w-[40%] shrink-0 truncate font-mono text-[11px] text-fg-subtle">
                      {command.hint}
                    </span>
                  )}
                </button>
              ))}
            </div>
          ))
        )}
      </div>
      <div className="flex items-center gap-4 border-t border-border px-3 py-2 text-[11px] text-fg-subtle">
        <span className="flex items-center gap-1">
          <Kbd>↑</Kbd>
          <Kbd>↓</Kbd> move
        </span>
        <span className="flex items-center gap-1">
          <Kbd>↵</Kbd> run
        </span>
        <span className="ml-auto flex items-center gap-1">
          <Kbd>Ctrl</Kbd>
          <Kbd>K</Kbd> toggle
        </span>
      </div>
    </>
  );
}

/** Every command available right now, built from app state, the open server and cached explorer data. */
function useCommands(): Command[] {
  const { state } = useAppState();
  const queryClient = useQueryClient();
  const nav = useNavigation();
  const openServerId = nav.openServerId;
  const workspace = useWorkspaceStore((s) =>
    openServerId ? s.workspaces[openServerId] : undefined,
  );
  const saved = useQueryLibrary((s) =>
    openServerId ? s.saved[openServerId] : undefined,
  );
  const statuses =
    queryClient.getQueryData<Record<string, ServerStatus>>(
      queryKeys.serverStatuses,
    ) ?? {};
  const connection = openServerId
    ? queryClient.getQueryData<OpenedConnection>(
        queryKeys.connection(openServerId),
      )
    : undefined;
  const database = workspace?.database ?? connection?.database ?? null;
  const schema = workspace?.schema ?? null;

  const tables = useQuery({
    queryKey: queryKeys.explorer.tables(
      connection?.connectionId ?? "",
      database ?? "",
      schema ?? "",
    ),
    queryFn: () =>
      unwrap(commands.listTables(connection!.connectionId, database!, schema!)),
    enabled: Boolean(connection && database && schema),
  });
  const objects = useQuery({
    queryKey: queryKeys.explorer.objects(
      connection?.connectionId ?? "",
      database ?? "",
      schema ?? "",
    ),
    queryFn: () =>
      unwrap(
        commands.schemaObjects(connection!.connectionId, database!, schema!),
      ),
    enabled: Boolean(connection && database && schema),
  });

  return useMemo(() => {
    const list: Command[] = [];
    const ws = useWorkspaceStore.getState();

    // Things in the open server first: that's what people jump to most
    if (openServerId && connection && database && schema) {
      const openTab = (name: string, kind: TableInfo["kind"]) => {
        ws.openTab(openServerId, {
          type: "table",
          database,
          schema,
          name,
          kind,
          view: "data",
        });
        nav.goTo("explorer");
      };
      for (const t of (tables.data as TableInfo[] | undefined) ?? []) {
        const isView = t.kind === "view" || t.kind === "materialized_view";
        list.push({
          id: `table:${t.name}`,
          group: isView ? "Views" : "Tables",
          label: t.name,
          keywords: `${schema} ${t.comment ?? ""}`,
          hint: `${schema}`,
          icon:
            t.kind === "materialized_view" ? (
              <Layers />
            ) : isView ? (
              <Eye />
            ) : (
              <Table2 />
            ),
          run: () => openTab(t.name, t.kind),
        });
      }
      for (const f of (objects.data as SchemaObjects | undefined)?.functions ??
        []) {
        list.push({
          id: `fn:${f.id}`,
          group: "Functions",
          label: `${f.name}(${f.arguments})`,
          hint: f.returns,
          icon: <FunctionSquare />,
          run: () => {
            ws.openTab(openServerId, {
              type: "definition",
              database,
              schema,
              kind: "function",
              name: f.id,
              title: `${f.name}()`,
            });
            nav.goTo("explorer");
          },
        });
      }
      for (const q of saved ?? []) {
        list.push({
          id: `saved:${q.id}`,
          group: "Saved queries",
          label: q.name,
          keywords: q.sql,
          icon: <Bookmark />,
          run: () => {
            ws.newQuery(openServerId, database, q.sql);
            nav.goTo("explorer");
          },
        });
      }
      const databases =
        queryClient.getQueryData<DatabaseInfo[]>(
          queryKeys.explorer.databases(connection.connectionId),
        ) ?? [];
      for (const d of databases) {
        if (!d.allowConnections || d.name === database) continue;
        list.push({
          id: `db:${d.name}`,
          group: "Switch database",
          label: d.name,
          keywords: "database switch",
          icon: <Database />,
          run: () => {
            ws.setLocation(openServerId, { database: d.name, schema: null });
            nav.goTo("explorer");
          },
        });
      }
      const actions: [string, string, ReactNode, () => void][] = [
        [
          "new-query",
          "New query",
          <TerminalSquare key="q" />,
          () => ws.newQuery(openServerId, database),
        ],
        [
          "new-table",
          `New table in ${schema}`,
          <Plus key="t" />,
          () =>
            useCreateTableSheet
              .getState()
              .open({ serverId: openServerId, database, schema }),
        ],
        [
          "diagram",
          `ER diagram of ${schema}`,
          <Network key="d" />,
          () => ws.openTab(openServerId, { type: "diagram", database, schema }),
        ],
        [
          "extensions",
          `Extensions in ${database}`,
          <Blocks key="e" />,
          () => ws.openTab(openServerId, { type: "extensions", database }),
        ],
        [
          "policies",
          `Policies (RLS) in ${schema}`,
          <ShieldCheck key="p" />,
          () =>
            ws.openTab(openServerId, { type: "policies", database, schema }),
        ],
        ...(
          [
            ["functions", "Functions", <FunctionSquare key="f" />],
            ["triggers", "Triggers", <Zap key="tr" />],
            ["enums", "Enumerated types", <Type key="en" />],
            ["sequences", "Sequences", <Hash key="sq" />],
          ] as const
        ).map(
          ([group, label, icon]): [string, string, ReactNode, () => void] => [
            `objects-${group}`,
            `${label} in ${schema}`,
            icon,
            () =>
              ws.openTab(openServerId, {
                type: "objects",
                database,
                schema,
                group,
              }),
          ],
        ),
      ];
      for (const [id, label, icon, run] of actions) {
        list.push({
          id,
          group: "Actions",
          label,
          icon,
          run: () => (run(), nav.goTo("explorer")),
        });
      }
      // Backup and restore use the bundled pg_dump, so only local servers have them
      if (!openServerId.startsWith("remote:"))
        list.push(
          {
            id: "backup",
            group: "Actions",
            label: `Back up ${database}…`,
            keywords: "backup dump export pg_dump",
            icon: <DatabaseBackup />,
            run: () =>
              useBackupDialogs
                .getState()
                .openBackup({ serverId: openServerId, database }),
          },
          {
            id: "restore",
            group: "Actions",
            label: `Restore a backup into ${database}…`,
            keywords: "restore import pg_restore",
            icon: <ArchiveRestore />,
            run: () =>
              useBackupDialogs
                .getState()
                .openRestore({ serverId: openServerId, database }),
          },
        );
    }

    // Databases
    for (const server of state.servers) {
      const running = statuses[server.id] === "running";
      if (running) {
        list.push({
          id: `open:${server.id}`,
          group: "Databases",
          label: `Open ${server.name}`,
          hint: `:${server.port}`,
          icon: <Database />,
          run: () => nav.openServer(server.id),
        });
      }
      list.push({
        id: `toggle:${server.id}`,
        group: "Databases",
        label: `${running ? "Stop" : "Start"} ${server.name}`,
        hint: `PostgreSQL ${server.version}`,
        icon: running ? <Square /> : <Play />,
        run: () =>
          void unwrap(
            running
              ? commands.stopServer(server.id)
              : commands.startServer(server.id),
          )
            .then((status) => {
              queryClient.setQueryData<Record<string, ServerStatus>>(
                queryKeys.serverStatuses,
                (prev) => ({
                  ...prev,
                  [server.id]: status,
                }),
              );
              toast.success(
                `${server.name} ${status === "running" ? "started" : "stopped"}`,
              );
            })
            .catch((e: unknown) =>
              toast.error(describeError(e).title, {
                description: describeError(e).message,
              }),
            ),
      });
    }
    for (const remote of state.remoteConnections) {
      list.push(
        {
          id: `open:remote:${remote.id}`,
          group: "Databases",
          label: `Open ${remote.name}`,
          keywords: `${remote.host} ${remote.provider} remote cloud`,
          hint: (PROVIDER_LOGOS[remote.provider] ?? PROVIDER_LOGOS.other)!
            .label,
          icon: <Cloud />,
          run: () => nav.openServer(`remote:${remote.id}`),
        },
        {
          id: `edit:remote:${remote.id}`,
          group: "Databases",
          label: `Edit ${remote.name}`,
          keywords: `${remote.host} remote connection settings`,
          icon: <Pencil />,
          run: () => {
            nav.goTo("databases");
            nav.openRemoteDialog(remote.id);
          },
        },
      );
    }
    list.push({
      id: "add-remote",
      group: "Databases",
      label: "Add remote connection",
      keywords: "cloud aws rds supabase neon azure gcp connect",
      icon: <Cloud />,
      run: () => {
        nav.goTo("databases");
        nav.openRemoteDialog();
      },
    });
    list.push({
      id: "install",
      group: "Databases",
      label: "New local database",
      keywords: "install postgresql create server",
      icon: <Plus />,
      run: () => nav.startInstall(),
    });

    // Navigation
    const pages: [string, string, ReactNode, () => void][] = [
      ["home", "Go to Home", <Home key="h" />, () => nav.goTo("home")],
      [
        "databases",
        "Go to Databases",
        <Database key="s" />,
        () => nav.goTo("databases"),
      ],
      [
        "settings",
        "Go to Settings",
        <Settings key="g" />,
        () => nav.goTo("settings"),
      ],
    ];
    for (const [id, label, icon, run] of pages)
      list.push({ id: `nav:${id}`, group: "Navigation", label, icon, run });
    list.push({
      id: "toggle-sidebar",
      group: "Navigation",
      label: "Toggle sidebar",
      keywords: "collapse expand hide show",
      hint: "Ctrl+B",
      icon: <PanelLeft />,
      run: () => useUiPrefs.getState().toggleSidebar(),
    });

    return list;
  }, [
    state.servers,
    state.remoteConnections,
    queryClient,
    statuses,
    openServerId,
    connection,
    database,
    schema,
    tables.data,
    objects.data,
    saved,
    nav,
  ]);
}
