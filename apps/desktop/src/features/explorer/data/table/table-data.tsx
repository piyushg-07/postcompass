import {
  Button,
  cn,
  ConfirmDialog,
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
import {
  ChevronLeft,
  ChevronRight,
  Lock,
  Redo2,
  RefreshCw,
  Trash2,
  Undo2,
} from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";
import type {
  ColumnInfo,
  ColumnValue,
  FilterSpec,
  RowChange,
  SortSpec,
} from "../../../../lib/bindings";
import { commands, describeError, unwrap } from "../../../../lib/ipc";
import { queryKeys } from "../../../../lib/query";
import { dropColumn } from "../../../../lib/sql";
import {
  useExplorer,
  useSchemaObjects,
  useStructure,
} from "../../explorer-context";
import { LoadError } from "../../load-error";
import { RunSqlDialog } from "../../run-sql-dialog";
import { ColumnSheet } from "../../structure/add-column-sheet";
import { ColumnStatsButton } from "../column-stats";
import { FilterBar } from "../filter-bar";
import { SortPopover } from "../filter-sort";
import { DataGrid } from "../grid/data-grid";
import type { CellTarget, GridRow } from "../grid/types";
import { type EditTarget, RowSheet } from "../insert-row-sheet";
import { PasteRowsDialog } from "../paste-rows";
import { isTabular } from "../paste/parse-clipboard";
import { RecordPicker, ReferencePeek } from "../reference";
import type { UndoEntry } from "../undo-store";
import { CellMenu, ColumnMenu, HiddenColumnsMenu } from "./menus";
import {
  ALL_ROWS_PAGE,
  type Cells,
  EMPTY_PAGE,
  enumValuesByName,
  fetchAllRows,
  foreignKeyReferences,
  keyAfter,
  keyIndexesOf,
  keyOf,
  pickStatsColumns,
  reinsertChanges,
  toGridColumns,
  toGridRows,
  undoInserts,
} from "./model";
import { PageInput } from "./page-input";
import { copyRows, exportRowsToFile } from "./row-export";
import { TableFooter } from "./table-footer";
import { InsertMenu, SelectionToolbar } from "./toolbar";
import { toggleFrozen, toggleIn, useColumnView } from "./use-column-view";
import { useRowPaste } from "./use-row-paste";
import { useUndoHistory } from "./use-undo-history";

interface TableDataProps {
  database: string;
  schema: string;
  table: string;
  /** Filters to start with (e.g. when following a foreign key). */
  initialFilters?: FilterSpec[];
  /** Shown on the right of the bottom bar (view switch, table actions). */
  footerRight?: ReactNode;
  /** Views are read-only, so there's nothing to say about editing. */
  isView?: boolean;
  /** Extra toolbar items on the right (e.g. a view's security warning). */
  toolbarRight?: ReactNode;
}

/** Browse and edit a table's rows: server-side paging, sorting and filtering. */
export function TableData(props: TableDataProps) {
  const { serverId } = useExplorer();
  // Paging, selection and the saved column view all belong to one table: showing another one
  // (or the same tab after a rename) starts fresh instead of carrying them over
  return (
    <TableDataView
      key={`${serverId}:${props.database}.${props.schema}.${props.table}`}
      {...props}
    />
  );
}

const NO_SELECTION: ReadonlySet<string> = new Set();

const rows = (n: number) => `${n} row${n === 1 ? "" : "s"}`;

/** Paste and Ctrl+Z belong to text fields and dialogs when they have focus. */
const inField = (target: EventTarget) =>
  (target as HTMLElement).closest(
    "input, textarea, [contenteditable=true], [role=dialog]",
  ) !== null;

function TableDataView({
  database,
  schema,
  table,
  initialFilters,
  footerRight,
  isView = false,
  toolbarRight,
}: TableDataProps) {
  const { connectionId, serverId } = useExplorer();
  // Hidden, frozen and rearranged columns: only how this table looks here, saved per table on
  // this computer
  const [view, setView] = useColumnView(
    `${serverId}:${database}.${schema}.${table}`,
  );
  const hidden = useMemo(() => new Set(view.hidden), [view.hidden]);
  const frozen = useMemo(() => new Set(view.frozen), [view.frozen]);
  const queryClient = useQueryClient();
  const [pageSize, setPageSize] = useState(100);
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState<SortSpec[]>([]);
  const [filters, setFilters] = useState<FilterSpec[]>(initialFilters ?? []);
  /** A foreign-key cell being edited by picking a record. */
  const [picking, setPicking] = useState<CellTarget | null>(null);
  // Single-column foreign keys make a column a link to another table
  const structure = useStructure(database, schema, table);
  const references = useMemo(
    () => foreignKeyReferences(structure.data?.foreignKeys ?? []),
    [structure.data],
  );
  // Enum columns get a list of their values
  const objects = useSchemaObjects(database, schema);
  const enums = useMemo(
    () => enumValuesByName(objects.data?.enums ?? []),
    [objects.data],
  );
  const [insert, setInsert] = useState<"row" | "column" | null>(null);
  const [editRow, setEditRow] = useState<EditTarget | null>(null);
  const [editColumn, setEditColumn] = useState<ColumnInfo | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [selected, setSelected] = useState<ReadonlySet<string>>(NO_SELECTION);
  /** Cell edits being saved right now, shown in place until the table reloads. */
  const [saving, setSaving] = useState<Map<string, Map<number, string | null>>>(
    new Map(),
  );
  const [confirmDelete, setConfirmDelete] = useState(false);
  /** Set after "Select all N rows": actions cover every row matching the filters, not just this page. */
  const [allRows, setAllRows] = useState(false);
  const changeSelection = (next: ReadonlySet<string>) => {
    setSelected(next);
    setAllRows(false);
  };

  const request = useMemo(
    () => ({ offset: page * pageSize, limit: pageSize, sort, filters }),
    [page, pageSize, sort, filters],
  );
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
  const target = { connectionId, database, schema, table };

  const columns = useMemo(
    () => toGridColumns(data.columns, references, enums, editable),
    [data.columns, references, enums, editable],
  );
  const statsColumns = useMemo(
    () => pickStatsColumns(columns, data.rows),
    [columns, data.rows],
  );
  const keyIndexes = useMemo(() => keyIndexesOf(data), [data]);
  /** The rows as loaded; the same objects across renders, so unchanged grid rows skip rendering. */
  const baseRows = useMemo(
    () => toGridRows(data, keyIndexes),
    [data, keyIndexes],
  );
  const originalRows = useMemo(
    () => new Map(baseRows.map((r, i) => [r.id, data.rows[i]!])),
    [baseRows, data.rows],
  );
  const gridRows: GridRow[] = useMemo(
    () =>
      saving.size === 0
        ? baseRows
        : baseRows.map((row) => {
            const edits = saving.get(row.id);
            return edits
              ? {
                  ...row,
                  cells: row.cells.map((v, i) =>
                    edits.has(i) ? edits.get(i)! : v,
                  ),
                  modified: new Set(edits.keys()),
                }
              : row;
          }),
    [baseRows, saving],
  );

  /* ── Selection follows the rows on screen ── */

  // Another page, sort or filter starts a new selection (otherwise "N selected" counts rows that
  // aren't shown, and "Select all" would cover a different set of rows). A reload keeps the rows
  // still there; read-only tables only know rows by position, so any new data starts over.
  const requestKey = JSON.stringify(request);
  const [scope, setScope] = useState({ request: requestKey, data });
  if (scope.request !== requestKey || scope.data !== data) {
    const fresh = scope.request !== requestKey || !editable;
    setScope({ request: requestKey, data });
    if (fresh) {
      if (selected.size > 0) setSelected(NO_SELECTION);
      if (allRows) setAllRows(false);
    } else if (selected.size > 0) {
      const kept = new Set([...selected].filter((id) => originalRows.has(id)));
      if (kept.size !== selected.size) setSelected(kept);
    }
  }

  // Deleting the last rows of the last page leaves an empty page: go back to the last one that
  // has rows (or the first, when the total isn't known)
  if (
    rowsQuery.isSuccess &&
    !rowsQuery.isPlaceholderData &&
    data.rows.length === 0 &&
    page > 0
  ) {
    const last =
      data.total === null
        ? 0
        : Math.max(0, Math.ceil(data.total / pageSize) - 1);
    setPage(last < page ? last : 0);
  }

  /* ── Whole-table selection ── */

  const pageAllSelected =
    gridRows.length > 0 && gridRows.every((r) => selected.has(r.id));
  const everyRow = allRows && pageAllSelected;
  // Only worth offering when the table has more than this page
  const canSelectAll = pageAllSelected && (data.hasMore || page > 0);
  const totalLabel =
    data.total === null ? "all" : Math.round(data.total).toLocaleString();
  const selectedCount = everyRow
    ? (data.total ?? selected.size)
    : selected.size;

  /** The selected rows' cells: this page's picks, or every row after "Select all". */
  const selectedCells = async (): Promise<Cells[]> =>
    everyRow
      ? fetchAllRows(target, sort, filters)
      : gridRows
          .filter((r) => selected.has(r.id))
          .map((r) => r.cells.map((v) => v ?? null));

  /* ── Editing ── */

  const apply = (changes: RowChange[]) =>
    unwrap(
      commands.applyChanges(connectionId, database, schema, table, changes),
    );

  const reload = () =>
    Promise.all([
      queryClient.invalidateQueries({
        queryKey: queryKeys.explorer.table(
          connectionId,
          database,
          schema,
          table,
        ),
      }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.explorer.tables(connectionId, database, schema),
      }),
    ]);

  // Undo history is per table and survives switching tabs
  const { canUndo, canRedo, undoing, step, record, remember } = useUndoHistory({
    historyKey: `${connectionId}:${database}.${schema}.${table}`,
    apply,
    reload,
  });

  /** Records a change made in the row panel, with the values it replaced. */
  const rememberRowChange = (change: RowChange) => {
    if (change.type === "update") {
      const before = editRow?.values ?? [];
      const old = change.values.map((v) => ({
        column: v.column,
        value:
          before[data.columns.findIndex((c) => c.name === v.column)] ?? null,
      }));
      remember(
        {
          label: "Edit row",
          undo: [
            {
              type: "update",
              key: keyAfter(change.key, change.values),
              values: old,
            },
          ],
          redo: [change],
        },
        `Row updated in ${table}`,
      );
    } else if (change.type === "insert") {
      // Only undoable when the new row's key is known (the database didn't generate it)
      const undo = undoInserts([change.values], data.keyColumns);
      if (undo) record({ label: "Add row", undo, redo: [change] });
    }
  };

  const setSavingCell = (id: string, col: number, value: string | null) =>
    setSaving((current) => {
      const next = new Map(current);
      next.set(id, new Map(current.get(id)).set(col, value));
      return next;
    });

  /** Stops showing a saved value, unless a newer edit of the same cell replaced it meanwhile. */
  const clearSavingCell = (id: string, col: number, value: string | null) =>
    setSaving((current) => {
      const row = current.get(id);
      if (!row?.has(col) || row.get(col) !== value) return current;
      const next = new Map(current);
      const rest = new Map(row);
      rest.delete(col);
      if (rest.size) next.set(id, rest);
      else next.delete(id);
      return next;
    });

  /** Saves a cell as soon as it's edited; no review step. */
  const editCell = (id: string, col: number, value: string | null) => {
    const original = originalRows.get(id);
    if (!original) return;
    // Compare with what's on screen: an earlier edit of this cell may still be saving
    const pending = saving.get(id);
    const shown = pending?.has(col)
      ? (pending.get(col) ?? null)
      : (original[col] ?? null);
    if (shown === value) return;
    const column = data.columns[col]!.name;
    const change: RowChange = {
      type: "update",
      key: keyOf(original, data.keyColumns, keyIndexes),
      values: [{ column, value }],
    };
    setSavingCell(id, col, value);
    void (async () => {
      try {
        await apply([change]);
      } catch (e) {
        toast.error(`Couldn't save ${column}`, {
          description: describeError(e).message,
        });
        clearSavingCell(id, col, value);
        return;
      }
      remember(
        {
          label: `Edit ${column}`,
          undo: [
            {
              type: "update",
              key: change.key,
              values: [{ column, value: shown ?? null }],
            },
          ],
          redo: [change],
        },
        `Saved ${column}`,
      );
      // The new value stays on screen until the reload brings it back from the database
      await reload();
      clearSavingCell(id, col, value);
    })();
  };

  /** The undo entry for deleted rows: inserting them again. */
  const deletedEntry = (deleted: Cells[]): UndoEntry => ({
    label: `Delete ${rows(deleted.length)}`,
    undo: reinsertChanges(deleted, data.columns),
    redo: deleted.map((cells) => ({
      type: "delete",
      key: keyOf(cells, data.keyColumns, keyIndexes),
    })),
  });

  const removeRows = useMutation({
    mutationFn: async () => {
      const targets = everyRow
        ? await fetchAllRows(target, sort, filters)
        : [...selected].flatMap((id) => {
            const cells = originalRows.get(id);
            return cells ? [cells] : [];
          });
      // Big deletes go in batches so each request stays small
      const deleted: Cells[] = [];
      try {
        for (let i = 0; i < targets.length; i += ALL_ROWS_PAGE) {
          const batch = targets.slice(i, i + ALL_ROWS_PAGE);
          await apply(
            batch.map((cells) => ({
              type: "delete",
              key: keyOf(cells, data.keyColumns, keyIndexes),
            })),
          );
          for (const cells of batch) deleted.push(cells);
        }
      } catch (e) {
        // Each batch is its own transaction: rows already gone stay gone, so keep them undoable
        if (deleted.length > 0) {
          record(deletedEntry(deleted));
          toast.info(`${rows(deleted.length)} deleted before the error`, {
            description: "Press Ctrl+Z to put them back.",
          });
          void reload();
        }
        throw e;
      }
      return deleted;
    },
    onSuccess: (deleted) => {
      remember(deletedEntry(deleted), `Deleted ${rows(deleted.length)}`);
      changeSelection(NO_SELECTION);
      setConfirmDelete(false);
      void reload();
    },
    onError: (e) =>
      toast.error("Couldn't delete", { description: describeError(e).message }),
  });

  /* ── Pasting rows from a spreadsheet ── */

  const paste = useRowPaste();

  const insertRows = useMutation({
    mutationFn: async (values: ColumnValue[][]) => {
      const inserts: RowChange[] = values.map((v) => ({
        type: "insert",
        values: v,
      }));
      const result = await apply(inserts);
      return { result, inserts };
    },
    onSuccess: ({ result, inserts }, values) => {
      const message = `Inserted ${rows(result.inserted)}`;
      // Undo needs each row's key; it's known only when the paste included it
      const undo = undoInserts(values, data.keyColumns);
      if (undo)
        remember(
          { label: message.replace("Inserted", "Paste"), undo, redo: inserts },
          message,
        );
      else toast.success(message);
      paste.close();
      void reload();
    },
    onError: (e) =>
      toast.error("Couldn't insert the rows", {
        description: describeError(e).message,
      }),
  });

  const expandRow = (id: string) => {
    const values = originalRows.get(id);
    if (values)
      setEditRow({ values, key: keyOf(values, data.keyColumns, keyIndexes) });
  };

  const copyRowJson = (id: string) => {
    const row = gridRows.find((r) => r.id === id);
    if (!row) return;
    const text = JSON.stringify(
      Object.fromEntries(
        data.columns.map((c, i) => [c.name, row.cells[i] ?? null]),
      ),
      null,
      2,
    );
    void navigator.clipboard
      .writeText(text)
      .then(() => toast.success("Copied row to clipboard"));
  };

  /* ── Sorting, paging, copying ── */

  const exportSource = {
    columns: data.columns.map((c) => c.name),
    load: selectedCells,
    schema,
    table,
  };

  const from = data.rows.length ? page * pageSize + 1 : 0;
  const to = page * pageSize + data.rows.length;
  const total =
    data.total === null ? null : Math.round(data.total).toLocaleString();
  // Paging, sorting and filtering wait until in-flight saves land
  const locked = saving.size > 0;
  const lastPage =
    data.total === null ? null : Math.max(1, Math.ceil(data.total / pageSize));

  return (
    <div
      className="flex h-full min-h-0 flex-col"
      onPaste={(e) => {
        if (!editable || inField(e.target)) return;
        const text = e.clipboardData.getData("text/plain");
        if (isTabular(text)) {
          e.preventDefault();
          paste.paste(text);
        }
      }}
      onKeyDown={(e) => {
        if (!(e.ctrlKey || e.metaKey)) return;
        // Text fields keep their own undo
        if (inField(e.target)) return;
        const key = e.key.toLowerCase();
        if (key === "z" || key === "y") {
          e.preventDefault();
          void step(key === "y" || e.shiftKey ? "redo" : "undo");
        }
      }}
    >
      {/* Toolbar, like Supabase: filter, sort, insert; bulk actions while rows are selected */}
      <div className="flex h-10 shrink-0 items-center gap-1 border-b border-border bg-surface pr-2">
        {selected.size > 0 ? (
          <SelectionToolbar
            count={selected.size}
            everyRow={everyRow}
            totalLabel={totalLabel}
            canSelectAll={canSelectAll}
            onClear={() => changeSelection(NO_SELECTION)}
            onSelectAll={() => setAllRows(true)}
            onCopy={(f) => void copyRows(f, exportSource)}
            onExport={(f) => void exportRowsToFile(f, exportSource)}
          />
        ) : (
          <>
            <FilterBar
              columns={columns}
              applied={filters}
              disabled={locked}
              onApply={(next) => {
                setFilters(next);
                setPage(0);
              }}
            />
            {view.hidden.length > 0 && (
              <HiddenColumnsMenu
                hidden={view.hidden.filter((c) =>
                  data.columns.some((x) => x.name === c),
                )}
                onShow={(column) =>
                  setView((v) => toggleIn(v, "hidden", column))
                }
                onShowAll={() => setView((v) => ({ ...v, hidden: [] }))}
              />
            )}
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
              <InsertMenu
                table={table}
                onInsertRow={() => setInsert("row")}
                onInsertColumn={() => setInsert("column")}
                onPaste={() => void paste.pasteFromClipboard()}
                onImport={() => void paste.importFile()}
              />
            ) : (
              data.columns.length > 0 &&
              !isView && (
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
          {selected.size === 0 && toolbarRight}
          <IconButton
            size="sm"
            label="Undo (Ctrl+Z)"
            icon={<Undo2 />}
            disabled={!canUndo || undoing}
            onClick={() => void step("undo")}
          />
          <IconButton
            size="sm"
            label="Redo (Ctrl+Shift+Z)"
            icon={<Redo2 />}
            disabled={!canRedo || undoing}
            onClick={() => void step("redo")}
          />
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
              onClick={() => setConfirmDelete(true)}
            >
              {everyRow
                ? `Delete all ${totalLabel} rows`
                : `Delete ${rows(selected.size)}`}
            </Button>
          )}
        </div>
      </div>

      {/* Grid */}
      <div className="relative min-h-0 flex-1">
        {rowsQuery.isError ? (
          <LoadError query={rowsQuery} />
        ) : rowsQuery.isPending ? (
          <div className="flex h-full items-center justify-center text-fg-subtle">
            <Spinner />
          </div>
        ) : (
          <DataGrid
            columns={columns}
            rows={gridRows}
            sort={sort}
            headerExtra={(column) =>
              statsColumns.has(column.id) && (
                <ColumnStatsButton
                  database={database}
                  schema={schema}
                  table={table}
                  column={column}
                />
              )
            }
            headerMenu={(column) => (
              <ColumnMenu
                name={column.name}
                sort={sort.find((x) => x.column === column.id)}
                disabled={locked}
                editable={editable}
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
                    .then(() => toast.success("Copied column name"))
                }
                frozen={frozen.has(column.id)}
                onFreeze={() =>
                  setView((v) =>
                    toggleFrozen(
                      v,
                      data.columns.map((c) => c.name),
                      column.id,
                    ),
                  )
                }
                onHide={() => setView((v) => toggleIn(v, "hidden", column.id))}
                onResetOrder={
                  view.order.length > 0
                    ? () => setView((v) => ({ ...v, order: [] }))
                    : undefined
                }
              />
            )}
            renderReference={(target, close) => {
              const ref = references[data.columns[target.col]!.name];
              return ref && target.value ? (
                <ReferencePeek
                  database={database}
                  reference={ref}
                  value={target.value}
                  onClose={close}
                />
              ) : null;
            }}
            onEditReference={setPicking}
            onExpandRow={editable ? expandRow : undefined}
            selected={selected}
            onSelectedChange={changeSelection}
            onEdit={editable ? editCell : undefined}
            onAddColumn={editable ? () => setInsert("column") : undefined}
            hidden={hidden}
            frozen={frozen}
            columnOrder={view.order}
            onReorder={(ids) => setView((v) => ({ ...v, order: ids }))}
            cellMenu={(target) => (
              <CellMenu
                target={target}
                editable={editable}
                onCopyRow={() => copyRowJson(target.rowId)}
                onFilter={() => {
                  const column = data.columns[target.col]!.name;
                  setFilters([
                    ...filters,
                    target.value === null
                      ? { column, op: "is_null", value: null }
                      : { column, op: "equals", value: target.value ?? "" },
                  ]);
                  setPage(0);
                }}
                onEditRow={() => expandRow(target.rowId)}
                onDeleteRow={() => {
                  // Also drops "Select all": otherwise a one-row page would delete every row
                  changeSelection(new Set([target.rowId]));
                  setConfirmDelete(true);
                }}
              />
            )}
            empty={
              filters.length ? (
                <div className="flex flex-col items-center gap-3 text-center">
                  <p className="text-sm text-fg-muted">
                    The filters applied have returned no results from this table
                  </p>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setFilters([]);
                      setPage(0);
                    }}
                  >
                    Remove all filters
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-fg-muted">This table is empty</p>
              )
            }
          />
        )}
      </div>

      {/* Bottom bar, like Supabase: pagination left, views right */}
      <TableFooter right={footerRight}>
        <IconButton
          size="sm"
          label={locked ? "Saving…" : "Previous page"}
          icon={<ChevronLeft />}
          disabled={page === 0 || locked}
          onClick={() => setPage((p) => Math.max(0, p - 1))}
        />
        <span className="flex items-center gap-1.5 text-xs text-fg-muted">
          Page
          <PageInput
            page={page}
            disabled={locked}
            max={lastPage}
            onChange={setPage}
          />
          {lastPage !== null && <>of {lastPage.toLocaleString()}</>}
        </span>
        <IconButton
          size="sm"
          label={locked ? "Saving…" : "Next page"}
          icon={<ChevronRight />}
          // `hasMore` describes the page still on screen until the next one loads
          disabled={!data.hasMore || locked || rowsQuery.isPlaceholderData}
          onClick={() => setPage((p) => p + 1)}
        />
        <Select
          aria-label="Rows per page"
          size="sm"
          side="top"
          className="ml-1 w-24"
          value={String(pageSize)}
          disabled={locked}
          onValueChange={(v) => {
            setPageSize(Number(v));
            setPage(0);
          }}
          options={[100, 500, 1000].map((n) => ({
            value: String(n),
            label: `${n} rows`,
          }))}
        />
        <span className="ml-1 text-xs text-fg-muted">
          {total !== null
            ? `${total} records${data.totalIsEstimate ? " (estimated)" : ""}`
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
        references={references}
        enums={enums}
        onApplied={rememberRowChange}
      />
      <PasteRowsDialog
        text={paste.source?.text ?? null}
        fileName={paste.source?.fileName}
        table={table}
        columns={data.columns}
        enums={enums}
        saving={insertRows.isPending}
        onCancel={paste.close}
        onInsert={(values) => insertRows.mutate(values)}
      />
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete ${everyRow ? `all ${totalLabel}` : selectedCount} row${selectedCount === 1 ? "" : "s"}?`}
        description="You can undo this right after with Ctrl+Z."
        confirmLabel="Delete"
        destructive
        loading={removeRows.isPending}
        onConfirm={() => removeRows.mutate()}
      />
      <RecordPicker
        database={database}
        open={picking !== null}
        reference={
          picking ? (references[data.columns[picking.col]!.name] ?? null) : null
        }
        nullable={picking ? data.columns[picking.col]!.nullable : false}
        onOpenChange={(o) => !o && setPicking(null)}
        onPick={(value) =>
          picking && editCell(picking.rowId, picking.col, value)
        }
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
    </div>
  );
}
