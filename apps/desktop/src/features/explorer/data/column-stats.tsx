import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  Skeleton,
  Tooltip,
} from "@repo/ui";
import { useQuery } from "@tanstack/react-query";
import { BarChart3 } from "lucide-react";
import { useState } from "react";
import { commands, describeError, unwrap } from "../../../lib/ipc";
import type { TypeKind } from "../../../lib/pg-types";
import { queryKeys } from "../../../lib/query";
import { ident, qualified } from "../../../lib/sql";
import { newRunId, useExplorer } from "../explorer-context";
import type { GridColumn } from "./data-grid";

/** Kinds where min and max make sense. */
const ORDERED = new Set<TypeKind>([
  "number",
  "date",
  "timestamp",
  "timestamptz",
  "time",
]);

interface Stats {
  total: number;
  nonNull: number;
  distinct: number;
  min: string | null;
  max: string | null;
  top: { value: string | null; count: number }[];
}

/** One round trip for everything the popover shows: counts, min/max and the most common values. */
function statsSql(schema: string, table: string, column: GridColumn) {
  const t = qualified(schema, table);
  const c = ident(column.name);
  const ordered = column.kind && ORDERED.has(column.kind);
  // JSON and arrays can't be counted distinct or grouped directly; compare their text
  const v =
    column.kind === "json" || column.kind === "array" ? `${c}::text` : c;
  const parts = [
    `select count(*)::text, count(${c})::text, count(distinct ${v})::text, ${
      ordered ? `min(${c})::text, max(${c})::text` : "null, null"
    } from ${t};`,
    `select ${v}::text, count(*)::text from ${t} group by 1 order by 2 desc, 1 limit 5;`,
  ];
  return parts.join("\n");
}

function useColumnStats(
  database: string,
  schema: string,
  table: string,
  column: GridColumn,
  enabled: boolean,
) {
  const { connectionId } = useExplorer();
  return useQuery({
    // Under the table's key, so every edit, paste, delete or undo (which refresh the table)
    // clears these too and the next look is current
    queryKey: [
      ...queryKeys.explorer.table(connectionId, database, schema, table),
      "stats",
      column.name,
    ],
    enabled,
    staleTime: 30_000,
    queryFn: async (): Promise<Stats> => {
      const result = await unwrap(
        commands.executeSql(
          connectionId,
          database,
          statsSql(schema, table, column),
          newRunId(),
          100,
          null,
        ),
      );
      if (result.error) throw new Error(result.error.message);
      const rows = result.statements.map((s) =>
        s.type === "rows" ? s.rows : [],
      );
      const summary = rows[0]?.[0] ?? [];
      return {
        total: Number(summary[0] ?? 0),
        nonNull: Number(summary[1] ?? 0),
        distinct: Number(summary[2] ?? 0),
        min: summary[3] ?? null,
        max: summary[4] ?? null,
        top: (rows[1] ?? []).map((r) => ({
          value: r[0] ?? null,
          count: Number(r[1] ?? 0),
        })),
      };
    },
  });
}

const percent = (part: number, whole: number) =>
  whole ? `${Math.round((part / whole) * 1000) / 10}%` : "0%";

/** The chart button in a column header and the stats popover behind it. */
export function ColumnStatsButton({
  database,
  schema,
  table,
  column,
}: {
  database: string;
  schema: string;
  table: string;
  column: GridColumn;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip content="Column stats">
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={`${column.name} stats`}
            className="flex size-5 cursor-pointer items-center justify-center rounded text-fg-subtle opacity-0 group-hover/header:opacity-100 hover:bg-surface-hover hover:text-fg data-[state=open]:bg-surface-hover data-[state=open]:text-fg data-[state=open]:opacity-100"
          >
            <BarChart3 className="size-3.5" />
          </button>
        </PopoverTrigger>
      </Tooltip>
      <PopoverContent align="start" className="w-72 p-0">
        {open && (
          <StatsBody
            database={database}
            schema={schema}
            table={table}
            column={column}
          />
        )}
      </PopoverContent>
    </Popover>
  );
}

function StatsBody({
  database,
  schema,
  table,
  column,
}: {
  database: string;
  schema: string;
  table: string;
  column: GridColumn;
}) {
  const stats = useColumnStats(database, schema, table, column, true);
  const s = stats.data;
  const nulls = s ? s.total - s.nonNull : 0;

  return (
    <div className="flex flex-col">
      <div className="flex items-baseline gap-2 border-b border-border px-3 py-2.5">
        <span className="font-mono text-xs text-fg">{column.name}</span>
        <span className="text-[11px] text-fg-subtle">{column.format}</span>
      </div>
      {stats.isPending ? (
        <div className="flex flex-col gap-2 p-3">
          <Skeleton className="h-10" />
          <Skeleton className="h-20" />
        </div>
      ) : stats.isError ? (
        <p className="p-3 text-xs text-danger">
          {describeError(stats.error).message}
        </p>
      ) : s ? (
        <div className="flex flex-col gap-3 p-3">
          <div className="grid grid-cols-3 gap-2">
            <Figure label="Rows" value={s.total.toLocaleString()} />
            <Figure label="Distinct" value={s.distinct.toLocaleString()} />
            <Figure
              label="NULL"
              value={percent(nulls, s.total)}
              warn={nulls > 0 && nulls === s.total}
            />
          </div>
          {(s.min !== null || s.max !== null) && (
            <div className="flex items-center justify-between gap-2 rounded-control bg-surface px-2.5 py-1.5 font-mono text-[11px]">
              <span className="truncate text-fg-muted">
                min <span className="text-fg">{s.min ?? "NULL"}</span>
              </span>
              <span className="truncate text-fg-muted">
                max <span className="text-fg">{s.max ?? "NULL"}</span>
              </span>
            </div>
          )}
          {s.top.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] text-fg-subtle">
                {s.distinct > 5 ? "Most common" : "Values"}
              </span>
              {s.top.map((t) => (
                <div
                  key={t.value ?? "\0null"}
                  className="flex flex-col gap-0.5"
                >
                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="truncate font-mono text-fg">
                      {t.value === null ? (
                        <span className="text-fg/50">NULL</span>
                      ) : t.value === "" ? (
                        <span className="text-fg/50">EMPTY</span>
                      ) : (
                        t.value
                      )}
                    </span>
                    <span className="shrink-0 font-mono text-fg-subtle">
                      {t.count.toLocaleString()} · {percent(t.count, s.total)}
                    </span>
                  </div>
                  <div className="h-1 overflow-hidden rounded-full bg-surface-hover">
                    <div
                      className="h-full rounded-full bg-accent/70"
                      style={{ width: percent(t.count, s.total) }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function Figure({
  label,
  value,
  warn,
}: {
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5 rounded-control bg-surface px-2.5 py-1.5">
      <span className="text-[10px] text-fg-subtle">{label}</span>
      <span
        className={
          warn ? "font-mono text-xs text-warning" : "font-mono text-xs text-fg"
        }
      >
        {value}
      </span>
    </div>
  );
}
