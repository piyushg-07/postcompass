import {
  Button,
  cn,
  Dialog,
  DialogContent,
  Input,
  SheetContent,
  Skeleton,
} from "@repo/ui";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useDebouncedValue } from "@tanstack/react-pacer";
import { ArrowUpRight, KeyRound, Search } from "lucide-react";
import { useState } from "react";
import type { RowsRequest } from "../../../lib/bindings";
import { commands, describeError, unwrap } from "../../../lib/ipc";
import { queryKeys } from "../../../lib/query";
import { useExplorer } from "../explorer-context";
import { useWorkspaceStore } from "../workspace-store";

/** Where a foreign-key column points: one column of another table. */
export interface Reference {
  schema: string;
  table: string;
  column: string;
}

function useRows(
  database: string,
  ref: Reference,
  request: RowsRequest,
  enabled = true,
) {
  const { connectionId } = useExplorer();
  return useQuery({
    queryKey: queryKeys.explorer.rows(
      connectionId,
      database,
      ref.schema,
      ref.table,
      request,
    ),
    queryFn: () =>
      unwrap(
        commands.tableRows(
          connectionId,
          database,
          ref.schema,
          ref.table,
          request,
        ),
      ),
    placeholderData: keepPreviousData,
    enabled,
  });
}

/**
 * The record a foreign-key value points to, like Supabase's "referencing record" panel:
 * every field of that row, and a button that opens the table filtered to it.
 */
export function ReferenceSheet({
  database,
  target,
  onOpenChange,
}: {
  database: string;
  target: (Reference & { value: string }) | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={target !== null} onOpenChange={onOpenChange}>
      {target && (
        <ReferenceBody
          database={database}
          target={target}
          onClose={() => onOpenChange(false)}
        />
      )}
    </Dialog>
  );
}

function ReferenceBody({
  database,
  target,
  onClose,
}: {
  database: string;
  target: Reference & { value: string };
  onClose: () => void;
}) {
  const { serverId } = useExplorer();
  const filters = [
    { column: target.column, op: "equals" as const, value: target.value },
  ];
  const rows = useRows(database, target, {
    offset: 0,
    limit: 1,
    sort: [],
    filters,
  });
  const row = rows.data?.rows[0];

  const openTable = () => {
    useWorkspaceStore.getState().openTab(serverId, {
      type: "table",
      database,
      schema: target.schema,
      name: target.table,
      kind: "table",
      view: "data",
      filters,
    });
    onClose();
  };

  return (
    <SheetContent
      title={
        <>
          Referencing record from{" "}
          <span className="font-mono">{`${target.schema}.${target.table}`}</span>
        </>
      }
      description={
        <>
          Where <span className="font-mono">{target.column}</span> ={" "}
          <span className="font-mono text-accent">{target.value}</span>
        </>
      }
      className="w-[520px]"
      footer={
        <Button
          variant="primary"
          iconLeft={<ArrowUpRight />}
          onClick={openTable}
        >
          Open table
        </Button>
      }
    >
      {rows.isPending ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-10" />
          ))}
        </div>
      ) : rows.isError ? (
        <p className="text-sm text-danger">
          {describeError(rows.error).message}
        </p>
      ) : !row ? (
        <p className="text-sm text-fg-muted">
          No matching record. It may have been deleted.
        </p>
      ) : (
        <dl className="flex flex-col divide-y divide-border">
          {rows.data.columns.map((c, i) => (
            <div
              key={c.name}
              className="grid grid-cols-[170px_1fr] gap-4 py-2.5 first:pt-0"
            >
              <dt className="flex min-w-0 flex-col gap-0.5">
                <span className="flex items-center gap-1.5 truncate font-mono text-xs text-fg">
                  {c.isPrimaryKey && (
                    <KeyRound className="size-3 shrink-0 text-warning" />
                  )}
                  {c.name}
                </span>
                <span className="truncate font-mono text-[11px] text-fg-subtle">
                  {c.dataType}
                </span>
              </dt>
              <dd className="min-w-0 font-mono text-xs break-words whitespace-pre-wrap text-fg select-text">
                {row[i] === null ? (
                  <span className="text-fg-subtle italic">NULL</span>
                ) : (
                  row[i]
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </SheetContent>
  );
}

/** Pick a row of the referenced table; returns its referenced column's value. */
export function RecordPicker({
  database,
  reference,
  open,
  onOpenChange,
  onPick,
}: {
  database: string;
  reference: Reference;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (value: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && (
        <PickerBody
          database={database}
          reference={reference}
          onPick={(v) => {
            onPick(v);
            onOpenChange(false);
          }}
        />
      )}
    </Dialog>
  );
}

function PickerBody({
  database,
  reference,
  onPick,
}: {
  database: string;
  reference: Reference;
  onPick: (value: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [query] = useDebouncedValue(search.trim(), { wait: 250 });
  const rows = useRows(database, reference, {
    offset: 0,
    limit: 100,
    sort: [],
    filters: query
      ? [{ column: reference.column, op: "contains", value: query }]
      : [],
  });
  const data = rows.data;
  const refIndex =
    data?.columns.findIndex((c) => c.name === reference.column) ?? -1;

  return (
    <DialogContent
      title={
        <>
          Select a record from{" "}
          <span className="font-mono">{`${reference.schema}.${reference.table}`}</span>
        </>
      }
      description={
        <>
          Sets the value to the record's{" "}
          <span className="font-mono">{reference.column}</span>.
        </>
      }
      className="w-[760px]"
    >
      <div className="relative">
        <Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-fg-subtle" />
        <Input
          autoFocus
          className="pl-8 font-mono text-xs"
          placeholder={`Search by ${reference.column}…`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div className="max-h-[420px] overflow-auto rounded-card border border-border">
        {rows.isPending ? (
          <div className="flex flex-col gap-1.5 p-3">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-7" />
            ))}
          </div>
        ) : rows.isError ? (
          <p className="p-3 text-sm text-danger">
            {describeError(rows.error).message}
          </p>
        ) : !data || data.rows.length === 0 ? (
          <p className="p-6 text-center text-sm text-fg-subtle">
            No records found
          </p>
        ) : (
          <table className="w-full text-left font-mono text-xs">
            <thead className="sticky top-0 bg-surface text-[11px] text-fg-subtle">
              <tr>
                {data.columns.map((c) => (
                  <th
                    key={c.name}
                    className={cn(
                      "border-b border-border px-3 py-2 font-sans font-medium whitespace-nowrap",
                      c.name === reference.column && "text-accent",
                    )}
                  >
                    {c.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r, i) => (
                <tr
                  key={i}
                  onClick={() =>
                    refIndex >= 0 &&
                    r[refIndex] !== null &&
                    onPick(r[refIndex]!)
                  }
                  className="cursor-pointer border-b border-border/60 last:border-0 hover:bg-surface-hover"
                >
                  {r.map((v, j) => (
                    <td
                      key={j}
                      className={cn(
                        "max-w-56 truncate px-3 py-1.5",
                        j === refIndex ? "text-accent" : "text-fg",
                      )}
                    >
                      {v === null ? (
                        <span className="text-fg-subtle italic">NULL</span>
                      ) : (
                        v
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </DialogContent>
  );
}
