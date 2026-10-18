import {
  Badge,
  Button,
  cn,
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  IconButton,
  Select,
  Spinner,
  toast,
  Tooltip,
} from "@repo/ui";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { save as saveFile } from "@tauri-apps/plugin-dialog";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Columns3,
  Copy,
  Download,
  Lock,
  Pencil,
  Plus,
  RefreshCw,
  Rows3,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";
import type {
  ColumnInfo,
  FilterSpec,
  RowChange,
  RowsPage,
  SortSpec,
} from "../../../lib/bindings";
import { commands, describeError, unwrap } from "../../../lib/ipc";
import { queryKeys } from "../../../lib/query";
import { useExplorer } from "../explorer-context";
import { SqlBlock } from "../sql/sql-editor";
import { ColumnSheet } from "../structure/add-column-sheet";
import { RunSqlDialog } from "../run-sql-dialog";
import { dropColumn } from "../../../lib/sql";
import {
  DataGrid,
  type GridCell,
  type GridColumn,
  type GridRow,
} from "./data-grid";
import { FilterBar } from "./filter-bar";
import { SortPopover } from "./filter-sort";
import { type EditTarget, RowSheet } from "./insert-row-sheet";
import { type ExportFormat, exportRows } from "./export";

const EMPTY_PAGE: RowsPage = {
  columns: [],
  rows: [],
  keyColumns: [],
  hasMore: false,
  total: null,
  totalIsEstimate: false,
};

interface Pending {
  /** rowId → column index → new value */
  edits: Map<string, Map<number, string | null>>;
  inserts: { id: string; cells: GridCell[] }[];
  deletes: Set<string>;
}

const NO_CHANGES: Pending = {
  edits: new Map(),
  inserts: [],
  deletes: new Set(),
};

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
  const [insert, setInsert] = useState<"row" | "column" | null>(null);
  const [editRow, setEditRow] = useState<EditTarget | null>(null);
  const [editColumn, setEditColumn] = useState<ColumnInfo | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<Pending>(NO_CHANGES);
  const [reviewOpen, setReviewOpen] = useState(false);

  const request = { offset: page * pageSize, limit: pageSize, sort, filters };
  const rowsQuery = useQuery({
    queryKey: queryKeys.explorer.rows(
      connectionId,
      database,
      schema,
      table,
      request,
    ),
    queryFn: () =>
      unwrap(
        commands.tableRows(connectionId, database, schema, table, request),
      ),
    placeholderData: keepPreviousData,
  });
  const data = rowsQuery.data ?? EMPTY_PAGE;
  const editable = data.keyColumns.length > 0;
  const changes = pendingCount(pending);

  const columns: GridColumn[] = useMemo(
    () =>
      data.columns.map((c) => ({
        id: c.name,
        name: c.name,
        dataType: c.dataType,
        isKey: c.isPrimaryKey,
      })),
    [data.columns],
  );
  const keyIndexes = useMemo(
    () =>
      data.keyColumns.map((k) => data.columns.findIndex((c) => c.name === k)),
    [data.columns, data.keyColumns],
  );

  const rowId = (cells: (string | null)[], index: number) =>
    editable
      ? JSON.stringify(keyIndexes.map((i) => cells[i]))
      : `row:${page * pageSize + index}`;

  const gridRows: GridRow[] = useMemo(() => {
    const existing = data.rows.map((cells, index) => {
      const id = rowId(cells, index);
      const edits = pending.edits.get(id);
      return {
        id,
        cells: edits
          ? cells.map((v, i) => (edits.has(i) ? edits.get(i)! : v))
          : cells,
        modified: edits ? new Set(edits.keys()) : undefined,
        state: pending.deletes.has(id) ? ("deleted" as const) : undefined,
      };
    });
    return [
      ...pending.inserts.map((r) => ({ ...r, state: "new" as const })),
      ...existing,
    ];
    // rowId depends on page/keyIndexes, both covered by data
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, pending]);

  const originalRows = useMemo(
    () =>
      new Map(data.rows.map((cells, index) => [rowId(cells, index), cells])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data],
  );

  /* ── Editing ── */

  const editCell = (id: string, col: number, value: string | null) => {
    setPending((p) => {
      const insertIndex = p.inserts.findIndex((r) => r.id === id);
      if (insertIndex >= 0) {
        const inserts = [...p.inserts];
        inserts[insertIndex] = {
          id,
          cells: inserts[insertIndex]!.cells.map((v, i) =>
            i === col ? value : v,
          ),
        };
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
    data.keyColumns.map((column, i) => ({
      column,
      value: originalRows.get(id)![keyIndexes[i]!] ?? null,
    }));

  const rowChanges: RowChange[] = useMemo(() => {
    const out: RowChange[] = [];
    for (const insert of pending.inserts) {
      out.push({
        type: "insert",
        values: insert.cells
          .map((value, i) => ({ column: data.columns[i]!.name, value }))
          .filter(
            (cv): cv is { column: string; value: string | null } =>
              cv.value !== undefined,
          ),
      });
    }
    for (const [id, edits] of pending.edits) {
      if (pending.deletes.has(id)) continue;
      out.push({
        type: "update",
        key: keyOf(id),
        values: [...edits].map(([i, value]) => ({
          column: data.columns[i]!.name,
          value,
        })),
      });
    }
    for (const id of pending.deletes)
      out.push({ type: "delete", key: keyOf(id) });
    return out;
    // keyOf reads data, covered below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, data]);

  const apply = useMutation({
    mutationFn: () =>
      unwrap(
        commands.applyChanges(
          connectionId,
          database,
          schema,
          table,
          rowChanges,
        ),
      ),
    onSuccess: (result) => {
      const parts = [
        result.inserted && `${result.inserted} added`,
        result.updated && `${result.updated} updated`,
        result.deleted && `${result.deleted} deleted`,
      ].filter(Boolean);
      toast.success("Changes saved", { description: parts.join(", ") });
      setPending(NO_CHANGES);
      setReviewOpen(false);
      void queryClient.invalidateQueries({
        queryKey: queryKeys.explorer.table(
          connectionId,
          database,
          schema,
          table,
        ),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.explorer.tables(connectionId, database, schema),
      });
    },
    onError: (e) =>
      toast.error("Nothing was saved", {
        description: describeError(e).message,
      }),
  });

  /* ── Sorting, paging, copying ── */

  const copy = (format: ExportFormat) => {
    const source = selected.size
      ? gridRows.filter((r) => selected.has(r.id))
      : gridRows;
    const text = exportRows(
      format,
      data.columns.map((c) => c.name),
      source.map((r) => r.cells),
      { schema, table },
    );
    void navigator.clipboard
      .writeText(text)
      .then(() =>
        toast.success(
          `Copied ${source.length} row${source.length === 1 ? "" : "s"} as ${format.toUpperCase()}`,
        ),
      );
  };

  const exportFile = async (format: ExportFormat) => {
    const source = selected.size
      ? gridRows.filter((r) => selected.has(r.id))
      : gridRows;
    const text = exportRows(
      format,
      data.columns.map((c) => c.name),
      source.map((r) => r.cells),
      { schema, table },
    );
    const path = await saveFile({
      defaultPath: `${table}.${format}`,
      filters: [{ name: format.toUpperCase(), extensions: [format] }],
    });
    if (!path) return;
    try {
      await unwrap(commands.saveTextFile(path, text));
      toast.success(
        `Exported ${source.length} row${source.length === 1 ? "" : "s"}`,
        { description: path },
      );
    } catch (e) {
      toast.error("Couldn't export", { description: describeError(e).message });
    }
  };

  const from = data.rows.length ? page * pageSize + 1 : 0;
  const to = page * pageSize + data.rows.length;
  const total =
    data.total === null
      ? null
      : `${data.totalIsEstimate ? "~" : ""}${Math.round(data.total).toLocaleString()}`;
  const locked = changes > 0;
  const pages =
    data.total === null
      ? null
      : `${data.totalIsEstimate ? "~" : ""}${Math.max(1, Math.ceil(data.total / pageSize)).toLocaleString()}`;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Toolbar, like Supabase: filter, sort, insert; bulk actions while rows are selected */}
      <div className="flex h-10 shrink-0 items-center gap-1 border-b border-border px-2">
        {selected.size > 0 ? (
          <>
            <IconButton
              size="sm"
              label="Clear selection"
              icon={<X />}
              onClick={() => setSelected(new Set())}
            />
            <span className="px-1 text-xs text-fg">
              {selected.size} row{selected.size === 1 ? "" : "s"} selected
            </span>
            <span className="mx-1 h-4 w-px bg-border" />
            <RowsMenu
              icon={<Copy />}
              label="Copy"
              verb="Copy as"
              onPick={copy}
            />
            <RowsMenu
              icon={<Download />}
              label="Export"
              verb="Export as"
              onPick={(f) => void exportFile(f)}
            />
          </>
        ) : (
          <>
            <FilterBar
              columns={data.columns.map((c) => c.name)}
              applied={filters}
              disabled={locked}
              onApply={(next) => {
                setFilters(next);
                setPage(0);
              }}
            />
            <SortPopover
              columns={data.columns.map((c) => c.name)}
              applied={sort}
              disabled={locked}
              onApply={(next) => {
                setSort(next);
                setPage(0);
              }}
            />
            {editable ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="sm"
                    variant="primary"
                    iconLeft={<Plus />}
                    iconRight={<ChevronDown />}
                  >
                    Insert
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-72">
                  <InsertOption
                    icon={<Rows3 />}
                    title="Insert row"
                    description={`Add a new row to ${table}`}
                    onSelect={() => setInsert("row")}
                  />
                  <InsertOption
                    icon={<Columns3 />}
                    title="Insert column"
                    description={`Add a new column to ${table}`}
                    onSelect={() => setInsert("column")}
                  />
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              data.columns.length > 0 && (
                <Tooltip content="Rows can only be edited in tables with a primary key">
                  <span className="flex items-center gap-1.5 px-2 text-xs text-fg-subtle">
                    <Lock className="size-3.5" /> Read-only
                  </span>
                </Tooltip>
              )
            )}
          </>
        )}
        <div
          className={cn(
            "flex items-center gap-1",
            selected.size > 0 && "ml-auto",
          )}
        >
          <IconButton
            size="sm"
            label="Refresh"
            icon={
              rowsQuery.isFetching ? (
                <Spinner className="size-3.5" />
              ) : (
                <RefreshCw />
              )
            }
            onClick={() => void rowsQuery.refetch()}
          />
          {selected.size > 0 && editable && (
            <Button
              size="sm"
              variant="danger"
              iconLeft={<Trash2 />}
              onClick={deleteSelected}
            >
              Delete {selected.size} row{selected.size === 1 ? "" : "s"}
            </Button>
          )}
        </div>
      </div>

      {/* Grid */}
      <div className="relative min-h-0 flex-1">
        {rowsQuery.isError ? (
          <p className="p-4 text-sm text-danger">
            {describeError(rowsQuery.error).message}
          </p>
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
            headerMenu={(column) => (
              <ColumnMenu
                name={column.name}
                sort={sort.find((x) => x.column === column.id)}
                disabled={locked}
                onSort={(descending) => {
                  setSort(
                    descending === null
                      ? sort.filter((x) => x.column !== column.id)
                      : [{ column: column.id, descending }],
                  );
                  setPage(0);
                }}
                onEdit={() =>
                  setEditColumn(
                    data.columns.find((c) => c.name === column.id) ?? null,
                  )
                }
                onDrop={() => setDropTarget(column.id)}
                onCopy={() =>
                  void navigator.clipboard
                    .writeText(column.name)
                    .then(() => toast.success("Column name copied"))
                }
              />
            )}
            onExpandRow={
              editable
                ? (id) => {
                    const values = originalRows.get(id);
                    if (values) setEditRow({ values, key: keyOf(id) });
                  }
                : undefined
            }
            selected={selected}
            onSelectedChange={setSelected}
            onEdit={editable ? editCell : undefined}
            emptyText={
              filters.length
                ? "No rows match these filters"
                : "This table is empty"
            }
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
            <Button
              size="sm"
              variant="ghost"
              iconLeft={<Undo2 />}
              onClick={discard}
            >
              Discard
            </Button>
            <Button
              size="sm"
              variant="primary"
              onClick={() => setReviewOpen(true)}
            >
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
          Page{" "}
          <span className="font-mono text-fg">
            {(page + 1).toLocaleString()}
          </span>
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
          options={[50, 100, 500, 1000].map((n) => ({
            value: String(n),
            label: `${n} rows`,
          }))}
        />
        <span className="ml-1 font-mono text-xs text-fg-subtle">
          {total !== null
            ? `${total} records`
            : `${from.toLocaleString()}–${to.toLocaleString()}`}
        </span>
      </TableFooter>

      <RowSheet
        open={insert === "row" || editRow !== null}
        onOpenChange={(o) => {
          if (!o) {
            setInsert(null);
            setEditRow(null);
          }
        }}
        database={database}
        schema={schema}
        table={table}
        columns={data.columns}
        row={editRow}
      />
      <ColumnSheet
        open={insert === "column" || editColumn !== null}
        onOpenChange={(o) => {
          if (!o) {
            setInsert(null);
            setEditColumn(null);
          }
        }}
        database={database}
        schema={schema}
        table={table}
        column={editColumn}
      />
      {dropTarget && (
        <RunSqlDialog
          open
          onOpenChange={(o) => !o && setDropTarget(null)}
          title={`Delete column ${dropTarget}?`}
          description="The column and all its values are removed permanently."
          sql={dropColumn(schema, table, dropTarget)}
          database={database}
          confirmLabel="Delete column"
          destructive
          successMessage={`Column ${dropTarget} deleted`}
        />
      )}

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
    queryKey: [
      "preview-changes",
      connectionId,
      database,
      schema,
      table,
      changes,
    ],
    queryFn: () =>
      unwrap(
        commands.previewChanges(connectionId, database, schema, table, changes),
      ),
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
          <p className="text-sm text-danger">
            {describeError(preview.error).message}
          </p>
        ) : (
          <SqlBlock sql={preview.data.join("\n")} className="h-64" />
        )}
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Keep editing</Button>
          </DialogClose>
          <Button
            variant="primary"
            loading={saving}
            disabled={!preview.isSuccess}
            onClick={onSave}
          >
            Save {changes.length} change{changes.length === 1 ? "" : "s"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** The table tab's bottom bar. `children` go on the left. */
export function TableFooter({
  children,
  right,
}: {
  children?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="flex h-10 shrink-0 items-center gap-1 border-t border-border bg-surface px-2">
      {children}
      <div className="ml-auto flex items-center gap-1">{right}</div>
    </div>
  );
}

function RowsMenu({
  icon,
  label,
  verb,
  onPick,
}: {
  icon: ReactNode;
  label: string;
  verb: string;
  onPick: (format: ExportFormat) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="sm"
          variant="ghost"
          iconLeft={icon}
          iconRight={<ChevronDown />}
        >
          {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onSelect={() => onPick("csv")}>
          {verb} CSV
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onPick("json")}>
          {verb} JSON
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onPick("sql")}>
          {verb} SQL
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function InsertOption({
  icon,
  title,
  description,
  onSelect,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  onSelect: () => void;
}) {
  return (
    <DropdownMenuItem
      icon={icon}
      className="h-auto items-start py-2 [&_svg]:mt-0.5"
      onSelect={onSelect}
    >
      <span className="flex flex-col gap-0.5">
        <span className="text-fg">{title}</span>
        <span className="text-[11px] text-fg-subtle">{description}</span>
      </span>
    </DropdownMenuItem>
  );
}

/** The menu behind each column header's button, like Supabase's. */
function ColumnMenu({
  name,
  sort,
  disabled,
  onSort,
  onEdit,
  onDrop,
  onCopy,
}: {
  name: string;
  sort?: SortSpec;
  disabled: boolean;
  onSort: (descending: boolean | null) => void;
  onEdit: () => void;
  onDrop: () => void;
  onCopy: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`${name} column options`}
          className="flex size-5 cursor-pointer items-center justify-center rounded text-fg-subtle hover:bg-surface-raised hover:text-fg data-[state=open]:bg-surface-raised data-[state=open]:text-fg"
        >
          <ChevronDown className="size-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="font-sans">
        <DropdownMenuItem
          icon={<ArrowUp />}
          disabled={disabled}
          onSelect={() => onSort(false)}
        >
          Sort ascending
        </DropdownMenuItem>
        <DropdownMenuItem
          icon={<ArrowDown />}
          disabled={disabled}
          onSelect={() => onSort(true)}
        >
          Sort descending
        </DropdownMenuItem>
        {sort && (
          <DropdownMenuItem
            icon={<X />}
            disabled={disabled}
            onSelect={() => onSort(null)}
          >
            Remove sort
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem icon={<Pencil />} onSelect={onEdit}>
          Edit column
        </DropdownMenuItem>
        <DropdownMenuItem icon={<Copy />} onSelect={onCopy}>
          Copy name
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem icon={<Trash2 />} danger onSelect={onDrop}>
          Delete column
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
