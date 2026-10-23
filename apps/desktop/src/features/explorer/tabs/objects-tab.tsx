import {
  Badge,
  Button,
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  EmptyState,
  Input,
  Skeleton,
} from "@repo/ui";
import {
  MoreHorizontal,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Table2,
  Trash2,
} from "lucide-react";
import { Fragment, type ReactNode, useState } from "react";
import { useExplorer, useSchemaObjects } from "../explorer-context";
import { type ObjectGroup, useWorkspace } from "../workspace-store";
import { type ObjectAction, ObjectForms, TriggerSwitch } from "./object-forms";
import { LoadError } from "../load-error";

export const OBJECT_GROUP_TITLES: Record<ObjectGroup, string> = {
  functions: "Functions",
  triggers: "Triggers",
  enums: "Enumerated types",
  sequences: "Sequences",
};

const SINGULAR: Record<ObjectGroup, string> = {
  functions: "function",
  triggers: "trigger",
  enums: "enum",
  sequences: "sequence",
};

/** One action in a row's menu; rendered both as the "⋯" dropdown and the right-click menu. */
interface RowAction {
  label: string;
  icon: ReactNode;
  run: () => void;
  danger?: boolean;
  /** Draw a separator before this item. */
  divide?: boolean;
}

interface Row {
  key: string;
  cells: ReactNode[];
  search: string;
  /** Clicking the row: usually "edit". */
  onOpen?: () => void;
  actions: RowAction[];
}

/**
 * One "Database" page, like Supabase's: every function / trigger / enum / sequence in a schema,
 * with a New button, row actions (⋯ or right-click) and forms to create, edit and delete them.
 */
export function ObjectsTab({
  database,
  schema,
  group,
}: {
  database: string;
  schema: string;
  group: ObjectGroup;
}) {
  const { serverId } = useExplorer();
  const ws = useWorkspace(serverId);
  const objects = useSchemaObjects(database, schema);
  const [search, setSearch] = useState("");
  const [action, setAction] = useState<ObjectAction | null>(null);

  if (objects.isPending)
    return (
      <div className="flex flex-col gap-2 p-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-10" />
        ))}
      </div>
    );
  if (objects.isError) return <LoadError query={objects} />;

  const mono = (text: string) => <span className="font-mono">{text}</span>;
  let headers: string[];
  let rows: Row[];
  switch (group) {
    case "functions":
      headers = ["Name", "Arguments", "Returns", "Language", "Kind"];
      rows = objects.data.functions.map((f) => ({
        key: f.id,
        search: f.name,
        cells: [
          mono(f.name),
          mono(f.arguments || "—"),
          mono(f.returns || "—"),
          f.language,
          f.kind,
        ],
        // Aggregates and window functions aren't edited as plain SQL bodies
        onOpen: () =>
          f.kind === "function" || f.kind === "procedure"
            ? setAction({ kind: "function-edit", item: f })
            : ws.openTab({
                type: "definition",
                database,
                schema,
                kind: "function",
                name: f.id,
                title: `${f.name}()`,
              }),
        actions: [
          ...(f.kind === "function" || f.kind === "procedure"
            ? [
                {
                  label: `Edit ${f.kind}…`,
                  icon: <Pencil />,
                  run: () => setAction({ kind: "function-edit", item: f }),
                },
              ]
            : []),
          {
            label: `Delete ${f.kind}…`,
            icon: <Trash2 />,
            danger: true,
            divide: true,
            run: () => setAction({ kind: "function-drop", item: f }),
          },
        ],
      }));
      break;
    case "triggers":
      headers = ["Name", "Table", "Function", "Status"];
      rows = objects.data.triggers.map((t) => ({
        key: `${t.table}.${t.name}`,
        search: `${t.name} ${t.table} ${t.function}`,
        cells: [
          mono(t.name),
          mono(t.table),
          mono(t.function),
          <TriggerSwitch database={database} schema={schema} item={t} />,
        ],
        actions: [
          {
            label: "Open table structure",
            icon: <Table2 />,
            run: () =>
              ws.openTab({
                type: "table",
                database,
                schema,
                name: t.table,
                kind: "table",
                view: "structure",
              }),
          },
          {
            label: "Rename…",
            icon: <Pencil />,
            run: () => setAction({ kind: "trigger-rename", item: t }),
          },
          {
            label: "Delete trigger…",
            icon: <Trash2 />,
            danger: true,
            divide: true,
            run: () => setAction({ kind: "trigger-drop", item: t }),
          },
        ],
      }));
      break;
    case "enums":
      headers = ["Name", "Values"];
      rows = objects.data.enums.map((e) => ({
        key: e.name,
        search: `${e.name} ${e.values.join(" ")}`,
        cells: [
          mono(e.name),
          <span className="flex flex-wrap gap-1">
            {e.values.map((v) => (
              <Badge key={v}>{v}</Badge>
            ))}
          </span>,
        ],
        onOpen: () => setAction({ kind: "enum-edit", item: e }),
        actions: [
          {
            label: "Edit enum…",
            icon: <Pencil />,
            run: () => setAction({ kind: "enum-edit", item: e }),
          },
          {
            label: "Delete enum…",
            icon: <Trash2 />,
            danger: true,
            divide: true,
            run: () => setAction({ kind: "enum-drop", item: e }),
          },
        ],
      }));
      break;
    case "sequences":
      headers = ["Name", "Type", "Last value", "Step"];
      rows = objects.data.sequences.map((s) => ({
        key: s.name,
        search: s.name,
        cells: [
          mono(s.name),
          mono(s.dataType),
          mono(s.lastValue ?? "—"),
          mono(s.increment),
        ],
        onOpen: () => setAction({ kind: "sequence-edit", item: s }),
        actions: [
          {
            label: "Edit…",
            icon: <Pencil />,
            run: () => setAction({ kind: "sequence-edit", item: s }),
          },
          {
            label: "Restart…",
            icon: <RotateCcw />,
            run: () => setAction({ kind: "sequence-restart", item: s }),
          },
          {
            label: "Rename…",
            icon: <Pencil />,
            run: () => setAction({ kind: "sequence-rename", item: s }),
          },
          {
            label: "Delete sequence…",
            icon: <Trash2 />,
            danger: true,
            divide: true,
            run: () => setAction({ kind: "sequence-drop", item: s }),
          },
        ],
      }));
      break;
  }

  const query = search.trim().toLowerCase();
  const shown = rows.filter(
    (r) => !query || r.search.toLowerCase().includes(query),
  );
  const title = OBJECT_GROUP_TITLES[group];
  const singular = SINGULAR[group];

  const newButton = (
    <Button
      size="sm"
      variant="primary"
      iconLeft={<Plus />}
      onClick={() =>
        setAction(
          group === "functions"
            ? { kind: "function-new" }
            : group === "enums"
              ? { kind: "enum-new" }
              : group === "triggers"
                ? { kind: "trigger-new" }
                : { kind: "sequence-new" },
        )
      }
    >
      New {singular}
    </Button>
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-3">
        <h2 className="font-heading text-sm font-semibold text-fg">{title}</h2>
        <div className="relative w-64">
          <Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-fg-subtle" />
          <Input
            className="h-7 pl-8 text-xs"
            placeholder={`Search ${title.toLowerCase()}`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <span className="text-xs text-fg-subtle">
          {rows.length} in <span className="font-mono">{schema}</span>
        </span>
        <div className="ml-auto">{newButton}</div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-4">
        {rows.length === 0 ? (
          <EmptyState
            title={`No ${title.toLowerCase()} in ${schema}`}
            description={`Create your first ${singular} with the button above.`}
            actions={newButton}
          />
        ) : (
          <table className="w-full overflow-hidden rounded-card border border-border text-left text-xs">
            <thead className="bg-surface text-[11px] text-fg-subtle">
              <tr>
                {headers.map((h) => (
                  <th
                    key={h}
                    className="border-b border-border px-3 py-2 font-medium"
                  >
                    {h}
                  </th>
                ))}
                <th className="w-10 border-b border-border" />
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <ContextMenu key={r.key}>
                  <ContextMenuTrigger asChild>
                    <tr
                      onClick={r.onOpen}
                      className={`group border-b border-border last:border-0 hover:bg-surface-hover ${r.onOpen ? "cursor-pointer" : ""}`}
                    >
                      {r.cells.map((c, i) => (
                        <td
                          key={i}
                          className="px-3 py-2 align-middle text-fg-muted first:text-fg"
                        >
                          {c}
                        </td>
                      ))}
                      <td
                        className="px-1 py-1 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              aria-label={`Actions for ${r.key}`}
                              className="flex size-7 cursor-pointer items-center justify-center rounded-control text-fg-subtle opacity-0 group-hover:opacity-100 hover:bg-surface-raised hover:text-fg data-[state=open]:opacity-100 [&_svg]:size-4"
                            >
                              <MoreHorizontal />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {r.actions.map((a) => (
                              <Fragment key={a.label}>
                                {a.divide && <DropdownMenuSeparator />}
                                <DropdownMenuItem
                                  icon={a.icon}
                                  danger={a.danger}
                                  onSelect={a.run}
                                >
                                  {a.label}
                                </DropdownMenuItem>
                              </Fragment>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  </ContextMenuTrigger>
                  <ContextMenuContent>
                    {r.actions.map((a) => (
                      <Fragment key={a.label}>
                        {a.divide && <ContextMenuSeparator />}
                        <ContextMenuItem
                          icon={a.icon}
                          danger={a.danger}
                          onSelect={a.run}
                        >
                          {a.label}
                        </ContextMenuItem>
                      </Fragment>
                    ))}
                  </ContextMenuContent>
                </ContextMenu>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ObjectForms
        action={action}
        onClose={() => setAction(null)}
        database={database}
        schema={schema}
        functions={objects.data.functions}
      />
    </div>
  );
}
