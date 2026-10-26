import {
  Button,
  cn,
  Dialog,
  IconButton,
  SheetContent,
  Skeleton,
  Spinner,
} from "@repo/ui";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Key,
  RefreshCw,
} from "lucide-react";
import { useState } from "react";
import type {
  ColumnInfo,
  FilterSpec,
  RowsRequest,
  SortSpec,
} from "../../../lib/bindings";
import { commands, describeError, unwrap } from "../../../lib/ipc";
import { shortType, typeKind } from "../../../lib/pg-types";
import { queryKeys } from "../../../lib/query";
import { useExplorer } from "../explorer-context";
import { useWorkspaceStore } from "../workspace-store";
import { FilterBar } from "./filter-bar";
import { SortPopover } from "./filter-sort";

/** Where a foreign-key column points: one column of another table. */
export interface Reference {
  schema: string;
  table: string;
  column: string;
}

const PAGE = 100;

function useRows(database: string, ref: Reference, request: RowsRequest) {
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
  });
}

function ColumnHead({ column }: { column: ColumnInfo }) {
  return (
    <span className="flex items-center gap-1.5 whitespace-nowrap">
      {column.isPrimaryKey && (
        <Key className="size-3 shrink-0 rotate-45 text-key-primary" />
      )}
      <span className="font-medium text-fg">{column.name}</span>
      <span className="text-fg-subtle">{shortType(column.dataType)}</span>
    </span>
  );
}

function Value({ value }: { value: string | null }) {
  if (value === null) return <span className="text-fg/50">NULL</span>;
  if (value === "") return <span className="text-fg/50">EMPTY</span>;
  return <>{value}</>;
}

/**
 * The popover behind a foreign-key cell's arrow, like Supabase's: the referenced row in a
 * small grid, and "Open table" to jump to it.
 */
export function ReferencePeek({
  database,
  reference,
  value,
  onClose,
}: {
  database: string;
  reference: Reference;
  value: string;
  onClose: () => void;
}) {
  const { serverId } = useExplorer();
  const filters: FilterSpec[] = [
    { column: reference.column, op: "equals", value },
  ];
  const rows = useRows(database, reference, {
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
      schema: reference.schema,
      name: reference.table,
      kind: "table",
      view: "data",
      filters,
    });
    onClose();
  };

  return (
    <div className="flex flex-col">
      <p className="px-3 py-2.5 text-xs text-fg-muted">
        Referencing record from{" "}
        <span className="font-mono text-fg">{`${reference.schema}.${reference.table}`}</span>
        :
      </p>
      <div className="h-32 overflow-auto border-y border-border bg-bg text-xs">
        {rows.isPending ? (
          <div className="flex flex-col gap-1.5 p-3">
            <Skeleton className="h-6" />
            <Skeleton className="h-6" />
          </div>
        ) : rows.isError ? (
          <p className="p-3 text-danger">
            Failed to find referencing row: {describeError(rows.error).message}
          </p>
        ) : !row ? (
          <p className="p-3 text-fg-subtle">No results were returned</p>
        ) : (
          <table className="text-left">
            <thead className="sticky top-0 bg-surface">
              <tr>
                {rows.data.columns.map((c) => (
                  <th
                    key={c.name}
                    className="h-8 border-r border-b border-border px-2 font-normal"
                  >
                    <ColumnHead column={c} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                {row.map((v, i) => (
                  <td
                    key={i}
                    className="h-8 max-w-60 truncate border-r border-b border-border px-2 text-fg select-text"
                  >
                    <Value value={v} />
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        )}
      </div>
      <div className="flex justify-end px-3 py-2">
        <Button
          size="sm"
          variant="secondary"
          iconRight={<ArrowUpRight />}
          onClick={openTable}
        >
          Open table
        </Button>
      </div>
    </div>
  );
}

/**
 * "Select a record to reference", like Supabase's: the referenced table with filter, sort and
 * paging; clicking a row picks its referenced column's value.
 */
export function RecordPicker({
  database,
  reference,
  open,
  nullable = false,
  onOpenChange,
  onPick,
}: {
  database: string;
  reference: Reference | null;
  open: boolean;
  /** Offers "Set NULL". */
  nullable?: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (value: string | null) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && reference && (
        <PickerBody
          database={database}
          reference={reference}
          nullable={nullable}
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
  nullable,
  onPick,
}: {
  database: string;
  reference: Reference;
  nullable: boolean;
  onPick: (value: string | null) => void;
}) {
  const [page, setPage] = useState(0);
  const [filters, setFilters] = useState<FilterSpec[]>([]);
  const [sort, setSort] = useState<SortSpec[]>([]);
  const rows = useRows(database, reference, {
    offset: page * PAGE,
    limit: PAGE,
    sort,
    filters,
  });
  const data = rows.data;
  const columns = data?.columns.map((c) => c.name) ?? [];
  const refIndex =
    data?.columns.findIndex((c) => c.name === reference.column) ?? -1;

  return (
    <SheetContent
      title={
        <>
          Select a record to reference from{" "}
          <span className="font-mono">{`${reference.schema}.${reference.table}`}</span>
        </>
      }
      className="w-[860px]"
    >
      <div className="-mx-5 -mt-4 flex h-full min-h-0 flex-col">
        <div className="flex h-10 shrink-0 items-center gap-1 border-b border-border px-3">
          <IconButton
            size="sm"
            label="Refresh"
            icon={
              rows.isFetching ? <Spinner className="size-3.5" /> : <RefreshCw />
            }
            onClick={() => void rows.refetch()}
          />
          <FilterBar
            columns={(data?.columns ?? []).map((c) => ({
              name: c.name,
              format: shortType(c.dataType),
              kind: typeKind(c.dataType, new Set()),
            }))}
            applied={filters}
            disabled={false}
            onApply={(next) => {
              setFilters(next);
              setPage(0);
            }}
          />
          <SortPopover
            columns={columns}
            applied={sort}
            disabled={false}
            onApply={(next) => {
              setSort(next);
              setPage(0);
            }}
          />
          <span className="ml-auto flex items-center gap-1">
            <IconButton
              size="sm"
              label="Previous page"
              icon={<ChevronLeft />}
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
            />
            <IconButton
              size="sm"
              label="Next page"
              icon={<ChevronRight />}
              disabled={!data?.hasMore}
              onClick={() => setPage((p) => p + 1)}
            />
            {nullable && (
              <Button
                size="sm"
                variant="secondary"
                className="ml-1"
                onClick={() => onPick(null)}
              >
                Set NULL
              </Button>
            )}
          </span>
        </div>
        <div className="min-h-0 flex-1 overflow-auto bg-bg text-[13px]">
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
            <p className="p-10 text-center text-sm text-fg-subtle">
              No Rows Found
            </p>
          ) : (
            <table className="min-w-full text-left">
              <thead className="sticky top-0 z-10 bg-surface text-xs">
                <tr>
                  {data.columns.map((c) => (
                    <th
                      key={c.name}
                      className="h-[34px] border-r border-b border-border px-2 font-normal"
                    >
                      <ColumnHead column={c} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r, i) => (
                  <tr
                    key={i}
                    onClick={() => refIndex >= 0 && onPick(r[refIndex] ?? null)}
                    className="cursor-pointer hover:bg-surface-hover"
                  >
                    {r.map((v, j) => (
                      <td
                        key={j}
                        className={cn(
                          "h-[34px] max-w-64 truncate border-r border-b border-border px-2",
                          j === refIndex ? "text-fg" : "text-fg-muted",
                        )}
                      >
                        <Value value={v} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </SheetContent>
  );
}
