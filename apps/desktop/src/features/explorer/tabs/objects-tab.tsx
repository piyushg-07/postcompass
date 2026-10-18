import { Badge, EmptyState, Input, Skeleton } from "@repo/ui";
import { Search } from "lucide-react";
import { type ReactNode, useState } from "react";
import { describeError } from "../../../lib/ipc";
import { useExplorer, useSchemaObjects } from "../explorer-context";
import { type ObjectGroup, useWorkspace } from "../workspace-store";

export const OBJECT_GROUP_TITLES: Record<ObjectGroup, string> = {
  functions: "Functions",
  triggers: "Triggers",
  enums: "Enumerated types",
  sequences: "Sequences",
};

interface Row {
  key: string;
  cells: ReactNode[];
  search: string;
  onOpen?: () => void;
}

/** One "Database" page, like Supabase's: every function / trigger / enum / sequence in a schema as a list. */
export function ObjectsTab({ database, schema, group }: { database: string; schema: string; group: ObjectGroup }) {
  const { serverId } = useExplorer();
  const ws = useWorkspace(serverId);
  const objects = useSchemaObjects(database, schema);
  const [search, setSearch] = useState("");

  if (objects.isPending)
    return (
      <div className="flex flex-col gap-2 p-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-10" />
        ))}
      </div>
    );
  if (objects.isError) return <p className="p-4 text-sm text-danger">{describeError(objects.error).message}</p>;

  const mono = (text: string) => <span className="font-mono">{text}</span>;
  let headers: string[];
  let rows: Row[];
  switch (group) {
    case "functions":
      headers = ["Name", "Arguments", "Returns", "Language", "Kind"];
      rows = objects.data.functions.map((f) => ({
        key: f.id,
        search: f.name,
        cells: [mono(f.name), mono(f.arguments || "—"), mono(f.returns || "—"), f.language, f.kind],
        onOpen: () =>
          ws.openTab({ type: "definition", database, schema, kind: "function", name: f.id, title: `${f.name}()` }),
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
          t.enabled ? <Badge variant="accent">Enabled</Badge> : <Badge>Disabled</Badge>,
        ],
        // Triggers are shown and edited with their table's structure
        onOpen: () =>
          ws.openTab({ type: "table", database, schema, name: t.table, kind: "table", view: "structure" }),
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
      }));
      break;
    case "sequences":
      headers = ["Name", "Type", "Last value", "Increment"];
      rows = objects.data.sequences.map((s) => ({
        key: s.name,
        search: s.name,
        cells: [mono(s.name), mono(s.dataType), mono(s.lastValue ?? "—"), mono(s.increment)],
        onOpen: () => ws.openTab({ type: "definition", database, schema, kind: "sequence", name: s.name, title: s.name }),
      }));
      break;
  }

  const query = search.trim().toLowerCase();
  const shown = rows.filter((r) => !query || r.search.toLowerCase().includes(query));
  const title = OBJECT_GROUP_TITLES[group];

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
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-4">
        {rows.length === 0 ? (
          <EmptyState title={`No ${title.toLowerCase()} in ${schema}`} description="Create them with SQL in a query tab." />
        ) : (
          <table className="w-full overflow-hidden rounded-card border border-border text-left text-xs">
            <thead className="bg-surface text-[11px] text-fg-subtle">
              <tr>
                {headers.map((h) => (
                  <th key={h} className="border-b border-border px-3 py-2 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr
                  key={r.key}
                  onClick={r.onOpen}
                  className={`border-b border-border last:border-0 ${r.onOpen ? "cursor-pointer hover:bg-surface-hover" : ""}`}
                >
                  {r.cells.map((c, i) => (
                    <td key={i} className="px-3 py-2 align-top text-fg-muted first:text-fg">
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
