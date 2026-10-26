import { toast } from "@repo/ui";
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
  Settings,
  ShieldCheck,
  Square,
  Table2,
  TerminalSquare,
  Type,
  Zap,
} from "lucide-react";
import { type ReactNode, useMemo } from "react";
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
import { forgetConnection } from "../servers/connection-cache";
import { PROVIDER_LOGOS } from "../servers/provider-logos";
import type { Command } from "./types";

/** Every command available right now, built from app state, the open server and cached explorer data. */
export function useCommands(): Command[] {
  const { state } = useAppState();
  const queryClient = useQueryClient();
  // Only the open server matters for the list; actions read the store when they run, so
  // unrelated navigation (e.g. the palette opening) doesn't rebuild every command
  const openServerId = useNavigation((s) => s.openServerId);
  const workspace = useWorkspaceStore((s) =>
    openServerId ? s.workspaces[openServerId] : undefined,
  );
  const saved = useQueryLibrary((s) =>
    openServerId ? s.saved[openServerId] : undefined,
  );
  // Read from the cache without fetching; subscribed, so the list follows status changes
  const statusesQuery = useQuery<Record<string, ServerStatus>>({
    queryKey: queryKeys.serverStatuses,
    enabled: false,
  });
  const connectionQuery = useQuery<OpenedConnection>({
    queryKey: queryKeys.connection(openServerId ?? ""),
    enabled: false,
  });
  const statuses = statusesQuery.data;
  const connection = openServerId ? connectionQuery.data : undefined;
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
    const nav = useNavigation.getState();

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
      const running = statuses?.[server.id] === "running";
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
              // Stopping closes the session in Rust; drop the cached one so the next open reconnects
              if (status !== "running") forgetConnection(queryClient, server.id);
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
  ]);
}
