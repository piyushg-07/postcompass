import {
  Badge,
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  IconButton,
  Input,
  Select,
  Spinner,
  toast,
  Tooltip,
} from "@repo/ui";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Filter,
  Lock,
  Plus,
  RefreshCw,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";
import type { FilterOp, FilterSpec, RowChange, RowsPage, SortSpec } from "../../../lib/bindings";
import { commands, describeError, unwrap } from "../../../lib/ipc";
import { queryKeys } from "../../../lib/query";
import { useExplorer } from "../explorer-context";
import { SqlBlock } from "../sql/sql-editor";
import { DataGrid, type GridCell, type GridColumn, type GridRow } from "./data-grid";
import { type ExportFormat, exportRows } from "./export";

const EMPTY_PAGE: RowsPage = {
  columns: [],
  rows: [],
  keyColumns: [],
  hasMore: false,
  total: null,
  totalIsEstimate: false,
};

const FILTER_OPS: { op: FilterOp; label: string; needsValue: boolean }[] = [
  { op: "equals", label: "=", needsValue: true },
  { op: "not_equals", label: "≠", needsValue: true },
  { op: "contains", label: "contains", needsValue: true },
  { op: "starts_with", label: "starts with", needsValue: true },
  { op: "greater_than", label: ">", needsValue: true },
  { op: "greater_or_equal", label: "≥", needsValue: true },
  { op: "less_than", label: "<", needsValue: true },
  { op: "less_or_equal", label: "≤", needsValue: true },
  { op: "is_null", label: "is NULL", needsValue: false },
  { op: "is_not_null", label: "is not NULL", needsValue: false },
];

interface Pending {
  /** rowId → column index → new value */
  edits: Map<string, Map<number, string | null>>;
  inserts: { id: string; cells: GridCell[] }[];
  deletes: Set<string>;
}

const NO_CHANGES: Pending = { edits: new Map(), inserts: [], deletes: new Set() };

function pendingCount(p: Pending) {
  return p.edits.size + p.inserts.length + p.deletes.size;
}

/** Browse and edit a table's rows: server-side paging, sorting and filtering. */
export function TableData({
  database,
  schema,
  table,
  footerRight,
}: {
  database: string;
  schema: string;
  table: string;
  /** Shown on the right of the bottom bar (view switch, table actions). */
  footerRight?: ReactNode;
}) {
  const { connectionId } = useExplorer();
  const queryClient = useQueryClient();
  const [pageSize, setPageSize] = useState(100);
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState<SortSpec[]>([]);
  const [filters, setFilters] = useState<FilterSpec[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<Pending>(NO_CHANGES);
  const [reviewOpen, setReviewOpen] = useState(false);

  const request = { offset: page * pageSize, limit: pageSize, sort, filters };
  const rowsQuery = useQuery({
    queryKey: queryKeys.explorer.rows(connectionId, database, schema, table, request),
    queryFn: () => unwrap(commands.tableRows(connectionId, database, schema, table, request)),
    placeholderData: keepPreviousData,
  });
  const data = rowsQuery.data ?? EMPTY_PAGE;
  const editable = data.keyColumns.length > 0;
  const changes = pendingCount(pending);

  const columns: GridColumn[] = useMemo(
    () => data.columns.map((c) => ({ id: c.name, name: c.name, dataType: c.dataType, isKey: c.isPrimaryKey })),
    [data.columns],
  );
  const keyIndexes = useMemo(
    () => data.keyColumns.map((k) => data.columns.findIndex((c) => c.name === k)),
    [data.columns, data.keyColumns],
  );

  const rowId = (cells: (string | null)[], index: number) =>
    editable ? JSON.stringify(keyIndexes.map((i) => cells[i])) : `row:${page * pageSize + index}`;

  const gridRows: GridRow[] = useMemo(() => {
    const existing = data.rows.map((cells, index) => {
      const id = rowId(cells, index);
      const edits = pending.edits.get(id);
      return {
        id,
        cells: edits ? cells.map((v, i) => (edits.has(i) ? edits.get(i)! : v)) : cells,
        modified: edits ? new Set(edits.keys()) : undefined,
        state: pending.deletes.has(id) ? ("deleted" as const) : undefined,
      };
    });
    return [...pending.inserts.map((r) => ({ ...r, state: "new" as const })), ...existing];
    // rowId depends on page/keyIndexes, both covered by data
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, pending]);

  const originalRows = useMemo(
    () => new Map(data.rows.map((cells, index) => [rowId(cells, index), cells])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data],
  );

  /* ── Editing ── */

  const editCell = (id: string, col: number, value: string | null) => {
    setPending((p) => {
      const insertIndex = p.inserts.findIndex((r) => r.id === id);
      if (insertIndex >= 0) {
        const inserts = [...p.inserts];
        inserts[insertIndex] = { id, cells: inserts[insertIndex]!.cells.map((v, i) => (i === col ? value : v)) };
        return { ...p, inserts };
      }
      const original = originalRows.get(id);
      const edits = new Map(p.edits);
      const rowEdits = new Map(edits.get(id));
      if (original && original[col] === value) rowEdits.delete(col);
      else rowEdits.set(col, value);
      if (rowEdits.size) edits.set(id, rowEdits);
      else edits.delete(id);
      return { ...p, edits };
    });
  };

  const addRow = () =>
    setPending((p) => ({
      ...p,
      inserts: [{ id: `new:${Date.now()}`, cells: data.columns.map(() => undefined) }, ...p.inserts],
    }));

  const deleteSelected = () => {
    setPending((p) => {
      const inserts = p.inserts.filter((r) => !selected.has(r.id));
      const deletes = new Set(p.deletes);
      for (const id of selected) if (originalRows.has(id)) deletes.add(id);
      return { ...p, inserts, deletes };
    });
    setSelected(new Set());
  };

  const discard = () => {
    setPending(NO_CHANGES);
    setReviewOpen(false);
  };

  const keyOf = (id: string) =>
    data.keyColumns.map((column, i) => ({ column, value: originalRows.get(id)![keyIndexes[i]!] ?? null }));

  const rowChanges: RowChange[] = useMemo(() => {
    const out: RowChange[] = [];
    for (const insert of pending.inserts) {
      out.push({
        type: "insert",
        values: insert.cells
          .map((value, i) => ({ column: data.columns[i]!.name, value }))
          .filter((cv): cv is { column: string; value: string | null } => cv.value !== undefined),
      });
    }
    for (const [id, edits] of pending.edits) {
      if (pending.deletes.has(id)) continue;
      out.push({
        type: "update",
        key: keyOf(id),
        values: [...edits].map(([i, value]) => ({ column: data.columns[i]!.name, value })),
      });
    }
    for (const id of pending.deletes) out.push({ type: "delete", key: keyOf(id) });
    return out;
    // keyOf reads data, covered below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, data]);

  const apply = useMutation({
    mutationFn: () => unwrap(commands.applyChanges(connectionId, database, schema, table, rowChanges)),
    onSuccess: (result) => {
      const parts = [
        result.inserted && `${result.inserted} added`,
        result.updated && `${result.updated} updated`,
        result.deleted && `${result.deleted} deleted`,
      ].filter(Boolean);
      toast.success("Changes saved", { description: parts.join(", ") });
      setPending(NO_CHANGES);
      setReviewOpen(false);
      void queryClient.invalidateQueries({ queryKey: queryKeys.explorer.table(connectionId, database, schema, table) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.explorer.tables(connectionId, database, schema) });
    },
    onError: (e) => toast.error("Nothing was saved", { description: describeError(e).message }),
  });

  /* ── Sorting, paging, copying ── */

  const toggleSort = (column: string) => {
    if (changes) return;
    setSort((current) => {
      const existing = current.find((s) => s.column === column);
      if (!existing) return [{ column, descending: false }];
      if (!existing.descending) return [{ column, descending: true }];
      return [];
    });
    setPage(0);
  };

  const copy = (format: ExportFormat) => {
    const source = selected.size ? gridRows.filter((r) => selected.has(r.id)) : gridRows;
    const text = exportRows(
      format,
      data.columns.map((c) => c.name),
      source.map((r) => r.cells),
      { schema, table },
    );
    void navigator.clipboard
      .writeText(text)
      .then(() => toast.success(`Copied ${source.length} row${source.length === 1 ? "" : "s"} as ${format.toUpperCase()}`));
  };

  const from = data.rows.length ? page * pageSize + 1 : 0;
  const to = page * pageSize + data.rows.length;
  const total =
    data.total === null ? null : `${data.totalIsEstimate ? "~" : ""}${Math.round(data.total).toLocaleString()}`;
  const locked = changes > 0;
  const pages =
    data.total === null
      ? null
      : `${data.totalIsEstimate ? "~" : ""}${Math.max(1, Math.ceil(data.total / pageSize)).toLocaleString()}`;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Toolbar */}
      <div className="flex h-10 shrink-0 items-center gap-1 border-b border-border px-2">
        <Button
          size="sm"
          variant={showFilters || filters.length ? "secondary" : "ghost"}
          iconLeft={<Filter />}
          onClick={() => setShowFilters((s) => !s)}
        >
          Filter{filters.length ? ` (${filters.length})` : ""}
        </Button>
        <IconButton
          size="sm"
          label="Refresh"
          icon={rowsQuery.isFetching ? <Spinner className="size-3.5" /> : <RefreshCw />}
          onClick={() => void rowsQuery.refetch()}
        />
        <span className="mx-1 h-4 w-px bg-border" />
        {editable ? (
          <>
            <Button size="sm" variant="ghost" iconLeft={<Plus />} onClick={addRow}>
              Row
            </Button>
            <Button size="sm" variant="ghost" iconLeft={<Trash2 />} disabled={!selected.size} onClick={deleteSelected}>
              Delete{selected.size ? ` (${selected.size})` : ""}
            </Button>
          </>
        ) : (
          data.columns.length > 0 && (
            <Tooltip content="Rows can only be edited in tables with a primary key">
              <span className="flex items-center gap-1.5 px-2 text-xs text-fg-subtle">
                <Lock className="size-3.5" /> Read-only
              </span>
            </Tooltip>
          )
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="ghost" iconLeft={<Copy />}>
              Copy{selected.size ? ` (${selected.size})` : ""}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onSelect={() => copy("csv")}>As CSV</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => copy("json")}>As JSON</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => copy("sql")}>As SQL INSERT</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

      </div>

      {showFilters && (
        <FilterBar
          columns={data.columns.map((c) => c.name)}
          applied={filters}
          disabled={locked}
          onApply={(next) => {
            setFilters(next);
            setPage(0);
          }}
        />
      )}

      {/* Grid */}
      <div className="relative min-h-0 flex-1">
        {rowsQuery.isError ? (
          <p className="p-4 text-sm text-danger">{describeError(rowsQuery.error).message}</p>
        ) : rowsQuery.isPending ? (
          <div className="flex h-full items-center justify-center text-fg-subtle">
            <Spinner />
          </div>
        ) : (
          <DataGrid
            columns={columns}
            rows={gridRows}
            startIndex={page * pageSize}
            sort={sort}
            onSort={toggleSort}
            selected={selected}
            onSelectedChange={setSelected}
            onEdit={editable ? editCell : undefined}
            emptyText={filters.length ? "No rows match these filters" : "This table is empty"}
          />
        )}
      </div>

      {/* Pending changes */}
      {changes > 0 && (
        <div className="flex h-11 shrink-0 items-center justify-between border-t border-border bg-surface px-3">
          <span className="flex items-center gap-2 text-xs text-fg-muted">
            <Badge variant="warning">{changes} unsaved</Badge>
            {pending.inserts.length > 0 && `${pending.inserts.length} new · `}
            {pending.edits.size > 0 && `${pending.edits.size} edited · `}
            {pending.deletes.size > 0 && `${pending.deletes.size} to delete`}
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" iconLeft={<Undo2 />} onClick={discard}>
              Discard
            </Button>
            <Button size="sm" variant="primary" onClick={() => setReviewOpen(true)}>
              Review & save
            </Button>
          </div>
        </div>
      )}

      {/* Bottom bar, like Supabase: pagination left, views right */}
      <TableFooter right={footerRight}>
        <IconButton
          size="sm"
          label={locked ? "Save or discard changes first" : "Previous page"}
          icon={<ChevronLeft />}
          disabled={page === 0 || locked}
          onClick={() => setPage((p) => p - 1)}
        />
        <span className="text-xs text-fg-muted">
          Page <span className="font-mono text-fg">{(page + 1).toLocaleString()}</span>
          {pages !== null && (
            <>
              {" "}
              of <span className="font-mono">{pages}</span>
            </>
          )}
        </span>
        <IconButton
          size="sm"
          label={locked ? "Save or discard changes first" : "Next page"}
          icon={<ChevronRight />}
          disabled={!data.hasMore || locked}
          onClick={() => setPage((p) => p + 1)}
        />
        <span className="mx-1 h-4 w-px bg-border" />
        <Select
          aria-label="Rows per page"
          size="sm"
          side="top"
          className="w-[104px]"
          value={String(pageSize)}
          disabled={locked}
          onValueChange={(v) => {
            setPageSize(Number(v));
            setPage(0);
          }}
          options={[50, 100, 500, 1000].map((n) => ({ value: String(n), label: `${n} rows` }))}
        />
        <span className="ml-1 font-mono text-xs text-fg-subtle">
          {total !== null ? `${total} records` : `${from.toLocaleString()}–${to.toLocaleString()}`}
        </span>
      </TableFooter>

      <ReviewDialog
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        changes={rowChanges}
        database={database}
        schema={schema}
        table={table}
        saving={apply.isPending}
        onSave={() => apply.mutate()}
      />
    </div>
  );
}

function ReviewDialog({
  open,
  onOpenChange,
  changes,
  database,
  schema,
  table,
  saving,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  changes: RowChange[];
  database: string;
  schema: string;
  table: string;
  saving: boolean;
  onSave: () => void;
}) {
  const { connectionId } = useExplorer();
  const preview = useQuery({
    queryKey: ["preview-changes", connectionId, database, schema, table, changes],
    queryFn: () => unwrap(commands.previewChanges(connectionId, database, schema, table, changes)),
    enabled: open,
    staleTime: 0,
    gcTime: 0,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Review changes"
        description="These statements run in one transaction. If any fails, nothing is saved."
        className="w-[720px]"
      >
        {preview.isPending ? (
          <div className="flex h-32 items-center justify-center text-fg-subtle">
            <Spinner />
          </div>
        ) : preview.isError ? (
          <p className="text-sm text-danger">{describeError(preview.error).message}</p>
        ) : (
          <SqlBlock sql={preview.data.join("\n")} className="h-64" />
        )}
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Keep editing</Button>
          </DialogClose>
          <Button variant="primary" loading={saving} disabled={!preview.isSuccess} onClick={onSave}>
            Save {changes.length} change{changes.length === 1 ? "" : "s"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FilterBar({
  columns,
  applied,
  disabled,
  onApply,
}: {
  columns: string[];
  applied: FilterSpec[];
  disabled: boolean;
  onApply: (filters: FilterSpec[]) => void;
}) {
  const [draft, setDraft] = useState<FilterSpec[]>(
    applied.length ? applied : [{ column: columns[0] ?? "", op: "contains", value: "" }],
  );
  const update = (index: number, patch: Partial<FilterSpec>) =>
    setDraft((d) => d.map((f, i) => (i === index ? { ...f, ...patch } : f)));
  const valid = draft.filter((f) => f.column && (!FILTER_OPS.find((o) => o.op === f.op)?.needsValue || f.value));

  return (
    <div className="flex shrink-0 flex-col gap-1.5 border-b border-border bg-surface px-3 py-2">
      {draft.map((filter, index) => {
        const needsValue = FILTER_OPS.find((o) => o.op === filter.op)?.needsValue ?? true;
        return (
          <div key={index} className="flex items-center gap-1.5">
            <span className="w-10 text-right text-[11px] text-fg-subtle">{index === 0 ? "where" : "and"}</span>
            <Select
              aria-label="Column"
              size="sm"
              mono
              className="w-44"
              value={filter.column}
              onValueChange={(column) => update(index, { column })}
              options={columns.map((c) => ({ value: c, label: c }))}
            />
            <Select
              aria-label="Condition"
              size="sm"
              className="w-32"
              value={filter.op}
              onValueChange={(op) => update(index, { op: op as FilterOp })}
              options={FILTER_OPS.map((o) => ({ value: o.op, label: o.label }))}
            />
            {needsValue && (
              <Input
                aria-label="Value"
                className="h-7 w-56 font-mono text-xs"
                placeholder="value"
                value={filter.value ?? ""}
                onChange={(e) => update(index, { value: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && !disabled && onApply(valid)}
              />
            )}
            <IconButton
              size="sm"
              label="Remove filter"
              icon={<X />}
              onClick={() => setDraft((d) => d.filter((_, i) => i !== index))}
            />
          </div>
        );
      })}
      <div className="flex items-center gap-2 pl-11">
        <Button
          size="sm"
          variant="ghost"
          iconLeft={<Plus />}
          onClick={() => setDraft((d) => [...d, { column: columns[0] ?? "", op: "equals", value: "" }])}
        >
          Add condition
        </Button>
        <Button size="sm" variant="primary" disabled={disabled} onClick={() => onApply(valid)}>
          Apply
        </Button>
        {applied.length > 0 && (
          <Button
            size="sm"
            variant="ghost"
            disabled={disabled}
            onClick={() => {
              setDraft([{ column: columns[0] ?? "", op: "contains", value: "" }]);
              onApply([]);
            }}
          >
            Clear
          </Button>
        )}
      </div>
    </div>
  );
}

/** The table tab's bottom bar. `children` go on the left. */
export function TableFooter({ children, right }: { children?: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex h-10 shrink-0 items-center gap-1 border-t border-border bg-surface px-2">
      {children}
      <div className="ml-auto flex items-center gap-1">{right}</div>
    </div>
  );
}
