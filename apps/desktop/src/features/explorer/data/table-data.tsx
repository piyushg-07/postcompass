import {
  Button,
  cn,
  ConfirmDialog,
  ContextMenuItem,
  ContextMenuSeparator,
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
  ClipboardPaste,
  Columns3,
  Copy,
  Download,
  Eye,
  EyeOff,
  Filter,
  Lock,
  LockOpen,
  Maximize2,
  Pencil,
  Plus,
  Redo2,
  RefreshCw,
  Rows3,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";
import type {
  ColumnInfo,
  ColumnValue,
  FilterSpec,
  RowChange,
  RowsPage,
  SortSpec,
} from "../../../lib/bindings";
import { commands, describeError, unwrap } from "../../../lib/ipc";
import { queryKeys } from "../../../lib/query";
import { shortType, typeKind } from "../../../lib/pg-types";
import {
  useExplorer,
  useSchemaObjects,
  useStructure,
} from "../explorer-context";
import { ColumnSheet } from "../structure/add-column-sheet";
import { RunSqlDialog } from "../run-sql-dialog";
import { dropColumn } from "../../../lib/sql";
import {
  type CellTarget,
  DataGrid,
  type GridColumn,
  type GridRow,
} from "./data-grid";
import { FilterBar } from "./filter-bar";
import { SortPopover } from "./filter-sort";
import { type EditTarget, RowSheet } from "./insert-row-sheet";
import { type UndoEntry, useUndoStore } from "./undo-store";
import { isTabular, PasteRowsDialog } from "./paste-rows";
import { ColumnStatsButton } from "./column-stats";
import { RecordPicker, type Reference, ReferencePeek } from "./reference";
import { type ExportFormat, exportRows } from "./export";

const EMPTY_PAGE: RowsPage = {
  columns: [],
  rows: [],
  keyColumns: [],
  hasMore: false,
  total: null,
  totalIsEstimate: false,
};

/** Browse and edit a table's rows: server-side paging, sorting and filtering. */
export function TableData({
  database,
  schema,
  table,
  initialFilters,
  footerRight,
  isView = false,
  toolbarRight,
}: {
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
}) {
  const { connectionId, serverId } = useExplorer();
  // Hidden and frozen columns: only how this table looks here, saved per table on this computer
  const [view, setView] = useColumnView(
    `${serverId}:${database}.${schema}.${table}`,
  );
  const hidden = useMemo(() => new Set(view.hidden), [view.hidden]);
  const frozen = useMemo(() => new Set(view.frozen), [view.frozen]);
  /**
   * Freeze panes, like a spreadsheet: freezing a column pins it and every column to its left,
   * in place; unfreezing releases them all.
   */
  const toggleFreeze = (column: string) =>
    setView((v) => {
      if (v.frozen.includes(column)) return { ...v, frozen: [] };
      const names = data.columns.map((c) => c.name);
      return { ...v, frozen: names.slice(0, names.indexOf(column) + 1) };
    });
  const toggleIn = (list: "hidden" | "frozen", column: string) =>
    setView((v) => ({
      ...v,
      [list]: v[list].includes(column)
        ? v[list].filter((c) => c !== column)
        : [...v[list], column],
    }));
  const queryClient = useQueryClient();
  const [pageSize, setPageSize] = useState(100);
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState<SortSpec[]>([]);
  const [filters, setFilters] = useState<FilterSpec[]>(initialFilters ?? []);
  /** A foreign-key cell being edited by picking a record. */
  const [picking, setPicking] = useState<CellTarget | null>(null);
  // Single-column foreign keys make a column a link to another table
  const structure = useStructure(database, schema, table);
  const references = useMemo(() => {
    const out: Record<
      string,
      Reference & { onUpdate: string; onDelete: string }
    > = {};
    for (const fk of structure.data?.foreignKeys ?? []) {
      if (fk.columns.length === 1 && fk.referencedColumns.length === 1)
        out[fk.columns[0]!] = {
          schema: fk.referencedSchema,
          table: fk.referencedTable,
          column: fk.referencedColumns[0]!,
          onUpdate: fk.onUpdate,
          onDelete: fk.onDelete,
        };
    }
    return out;
  }, [structure.data]);
  // Enum columns get a list of their values
  const objects = useSchemaObjects(database, schema);
  const enums = useMemo(
    () =>
      new Map(
        (objects.data?.enums ?? []).map((e) => [
          e.name.toLowerCase(),
          e.values,
        ]),
      ),
    [objects.data],
  );
  const [insert, setInsert] = useState<"row" | "column" | null>(null);
  const [editRow, setEditRow] = useState<EditTarget | null>(null);
  const [editColumn, setEditColumn] = useState<ColumnInfo | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  /** Cell edits being saved right now, shown in place until the table reloads. */
  const [saving, setSaving] = useState<Map<string, Map<number, string | null>>>(
    new Map(),
  );
  const [confirmDelete, setConfirmDelete] = useState(false);

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

  const columns: GridColumn[] = useMemo(() => {
    const enumNames = new Set(enums.keys());
    return data.columns.map((c) => {
      const kind = typeKind(c.dataType, enumNames);
      const ref = references[c.name];
      return {
        id: c.name,
        name: c.name,
        format: shortType(c.dataType),
        kind,
        isKey: c.isPrimaryKey,
        nullable: c.nullable,
        comment: c.comment,
        enumValues:
          kind === "enum"
            ? enums.get(
                c.dataType.split(".").pop()!.replaceAll('"', "").toLowerCase(),
              )
            : undefined,
        // Like Supabase, keys and generated values aren't edited in place
        editable:
          editable &&
          !c.isPrimaryKey &&
          !c.generated &&
          c.identity !== "always",
        references: ref
          ? {
              target: `${ref.schema}.${ref.table}.${ref.column}`,
              onUpdate: ref.onUpdate,
              onDelete: ref.onDelete,
            }
          : undefined,
      };
    });
  }, [data.columns, references, enums, editable]);
  /**
   * Columns where a summary says something: numbers, booleans and enums, plus text that
   * repeats a lot (city, status). Ids, uuids, names, dates and times (almost all unique), JSON
   * and links are left out.
   */
  const statsColumns = useMemo(() => {
    const out = new Set<string>();
    columns.forEach((c, i) => {
      if (c.isKey || c.references || c.format === "uuid") return;
      if (c.kind === "number" || c.kind === "bool" || c.kind === "enum") {
        out.add(c.id);
        return;
      }
      if (c.kind !== "text") return;
      // Judge text by the rows on screen: few distinct values means categories
      const values = data.rows
        .map((r) => r[i])
        .filter((v): v is string => v !== null && v !== "");
      const distinct = new Set(values).size;
      if (
        values.length >= 5 &&
        distinct <= 20 &&
        distinct <= values.length * 0.6
      )
        out.add(c.id);
    });
    return out;
  }, [columns, data.rows]);

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
      const edits = saving.get(id);
      return {
        id,
        cells: edits
          ? cells.map((v, i) => (edits.has(i) ? edits.get(i)! : v))
          : cells,
        modified: edits ? new Set(edits.keys()) : undefined,
      };
    });
    return existing;
    // rowId depends on page/keyIndexes, both covered by data
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, saving]);

  const originalRows = useMemo(
    () =>
      new Map(data.rows.map((cells, index) => [rowId(cells, index), cells])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data],
  );

  /* ── Editing ── */

  // Undo history is per table and survives switching tabs
  const historyKey = `${connectionId}:${database}.${schema}.${table}`;
  const canUndo = useUndoStore(
    (s) => (s.tables[historyKey]?.past.length ?? 0) > 0,
  );
  const canRedo = useUndoStore(
    (s) => (s.tables[historyKey]?.future.length ?? 0) > 0,
  );
  const [undoing, setUndoing] = useState(false);

  /** Saves `entry` so it can be undone, and offers Undo in a toast. */
  const remember = (entry: UndoEntry, message: string) => {
    useUndoStore.getState().record(historyKey, entry);
    toast.success(message, {
      action: { label: "Undo", onClick: () => void step("undo") },
    });
  };

  /** Applies the latest undo (or redo) entry. */
  const step = async (direction: "undo" | "redo") => {
    if (undoing) return;
    const store = useUndoStore.getState();
    const entry = store.shift(historyKey, direction);
    if (!entry) return;
    setUndoing(true);
    try {
      await unwrap(
        commands.applyChanges(
          connectionId,
          database,
          schema,
          table,
          direction === "undo" ? entry.undo : entry.redo,
        ),
      );
      toast.success(
        `${direction === "undo" ? "Undid" : "Redid"}: ${entry.label}`,
      );
      await reload();
    } catch (e) {
      store.restore(historyKey, direction, entry);
      toast.error(`Couldn't ${direction} ${entry.label.toLowerCase()}`, {
        description: describeError(e).message,
      });
    } finally {
      setUndoing(false);
    }
  };

  /** The key of a row as it is after `values` were written (keys can be edited in the panel). */
  const keyAfter = (key: ColumnValue[], values: ColumnValue[]) =>
    key.map((k) => values.find((v) => v.column === k.column) ?? k);

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
      const key = data.keyColumns.map((column) =>
        change.values.find((v) => v.column === column),
      );
      if (key.every((k): k is ColumnValue => k !== undefined))
        useUndoStore.getState().record(historyKey, {
          label: "Add row",
          undo: [{ type: "delete", key }],
          redo: [change],
        });
    }
  };

  const keyOf = (id: string) =>
    data.keyColumns.map((column, i) => ({
      column,
      value: originalRows.get(id)![keyIndexes[i]!] ?? null,
    }));

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

  const setSavingCell = (
    id: string,
    col: number,
    value: string | null | undefined,
  ) =>
    setSaving((current) => {
      const next = new Map(current);
      const row = new Map(next.get(id));
      if (value === undefined) row.delete(col);
      else row.set(col, value);
      if (row.size) next.set(id, row);
      else next.delete(id);
      return next;
    });

  /** Saves a cell as soon as it's edited; no review step. */
  const editCell = (id: string, col: number, value: string | null) => {
    const original = originalRows.get(id);
    if (!original || original[col] === value) return;
    const change: RowChange = {
      type: "update",
      key: keyOf(id),
      values: [{ column: data.columns[col]!.name, value }],
    };
    setSavingCell(id, col, value);
    unwrap(
      commands.applyChanges(connectionId, database, schema, table, [change]),
    )
      .then(() => {
        const column = data.columns[col]!.name;
        remember(
          {
            label: `Edit ${column}`,
            undo: [
              {
                type: "update",
                key: change.key,
                values: [{ column, value: original[col] ?? null }],
              },
            ],
            redo: [change],
          },
          `Saved ${column}`,
        );
        return reload();
      })
      .catch((e: unknown) =>
        toast.error(`Couldn't save ${data.columns[col]!.name}`, {
          description: describeError(e).message,
        }),
      )
      .finally(() => setSavingCell(id, col, undefined));
  };

  const removeRows = useMutation({
    mutationFn: async () => {
      const ids = [...selected].filter((id) => originalRows.has(id));
      const deletes: RowChange[] = ids.map((id) => ({
        type: "delete",
        key: keyOf(id),
      }));
      const result = await unwrap(
        commands.applyChanges(connectionId, database, schema, table, deletes),
      );
      // Undo inserts the rows again with every value they had (generated ones are recomputed)
      const inserts: RowChange[] = ids.map((id) => ({
        type: "insert",
        values: data.columns.flatMap((c, i) =>
          c.generated
            ? []
            : [{ column: c.name, value: originalRows.get(id)![i] ?? null }],
        ),
      }));
      return { result, deletes, inserts };
    },
    onSuccess: ({ result, deletes, inserts }) => {
      const label = `Delete ${result.deleted} row${result.deleted === 1 ? "" : "s"}`;
      remember(
        { label, undo: inserts, redo: deletes },
        `Deleted ${result.deleted} row${result.deleted === 1 ? "" : "s"}`,
      );
      setSelected(new Set());
      setConfirmDelete(false);
      void reload();
    },
    onError: (e) =>
      toast.error("Couldn't delete", { description: describeError(e).message }),
  });

  /* ── Pasting rows from a spreadsheet ── */

  const [pasteText, setPasteText] = useState<string | null>(null);

  const pasteFromClipboard = async () => {
    const text = await navigator.clipboard.readText().catch(() => "");
    if (isTabular(text)) setPasteText(text);
    else
      toast.info("Nothing to paste", {
        description: "Copy some rows from Excel or Google Sheets first.",
      });
  };

  const insertRows = useMutation({
    mutationFn: async (rows: ColumnValue[][]) => {
      const inserts: RowChange[] = rows.map((values) => ({
        type: "insert",
        values,
      }));
      const result = await unwrap(
        commands.applyChanges(connectionId, database, schema, table, inserts),
      );
      return { result, inserts };
    },
    onSuccess: ({ result, inserts }) => {
      const message = `Inserted ${result.inserted} row${result.inserted === 1 ? "" : "s"}`;
      // Undo needs each row's key; it's known only when the paste included it
      const keys = inserts.map((c) =>
        c.type === "insert"
          ? data.keyColumns.map((column) =>
              c.values.find((v) => v.column === column),
            )
          : [],
      );
      if (
        data.keyColumns.length > 0 &&
        keys.every((k) => k.every((v) => v !== undefined))
      )
        remember(
          {
            label: message.replace("Inserted", "Paste"),
            undo: keys.map((key) => ({
              type: "delete",
              key: key as ColumnValue[],
            })),
            redo: inserts,
          },
          message,
        );
      else toast.success(message);
      setPasteText(null);
      void reload();
    },
    onError: (e) =>
      toast.error("Couldn't insert the pasted rows", {
        description: describeError(e).message,
      }),
  });

  const expandRow = (id: string) => {
    const values = originalRows.get(id);
    if (values) setEditRow({ values, key: keyOf(id) });
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
    data.total === null ? null : Math.round(data.total).toLocaleString();
  // Paging, sorting and filtering wait until in-flight saves land
  const locked = saving.size > 0;
  const pages =
    data.total === null
      ? null
      : Math.max(1, Math.ceil(data.total / pageSize)).toLocaleString();

  return (
    <div
      className="flex h-full min-h-0 flex-col"
      onPaste={(e) => {
        if (!editable) return;
        const target = e.target as HTMLElement;
        if (
          target.closest(
            "input, textarea, [contenteditable=true], [role=dialog]",
          )
        )
          return;
        const text = e.clipboardData.getData("text/plain");
        if (isTabular(text)) {
          e.preventDefault();
          setPasteText(text);
        }
      }}
      onKeyDown={(e) => {
        if (!(e.ctrlKey || e.metaKey)) return;
        // Text fields keep their own undo
        const target = e.target as HTMLElement;
        if (
          target.closest(
            "input, textarea, [contenteditable=true], [role=dialog]",
          )
        )
          return;
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
          <>
            <IconButton
              size="sm"
              className="ml-2"
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
                onShow={(column) => toggleIn("hidden", column)}
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
                  <InsertOption
                    icon={<ClipboardPaste />}
                    title="Paste rows"
                    description="From Excel or Google Sheets (or press Ctrl+V)"
                    onSelect={() => void pasteFromClipboard()}
                  />
                </DropdownMenuContent>
              </DropdownMenu>
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
                onFreeze={() => toggleFreeze(column.id)}
                onHide={() => toggleIn("hidden", column.id)}
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
            onSelectedChange={setSelected}
            onEdit={editable ? editCell : undefined}
            onAddColumn={editable ? () => setInsert("column") : undefined}
            hidden={hidden}
            frozen={frozen}
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
                  setSelected(new Set([target.rowId]));
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
          onClick={() => setPage((p) => p - 1)}
        />
        <span className="flex items-center gap-1.5 text-xs text-fg-muted">
          Page
          <PageInput
            page={page}
            disabled={locked}
            max={
              data.total === null
                ? null
                : Math.max(1, Math.ceil(data.total / pageSize))
            }
            onChange={setPage}
          />
          {pages !== null && <>of {pages}</>}
        </span>
        <IconButton
          size="sm"
          label={locked ? "Saving…" : "Next page"}
          icon={<ChevronRight />}
          disabled={!data.hasMore || locked}
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
        text={pasteText}
        table={table}
        columns={data.columns}
        enums={enums}
        saving={insertRows.isPending}
        onCancel={() => setPasteText(null)}
        onInsert={(rows) => insertRows.mutate(rows)}
      />
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete ${selected.size} row${selected.size === 1 ? "" : "s"}?`}
        description="This can't be undone."
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

interface ColumnView {
  hidden: string[];
  frozen: string[];
}

const EMPTY_VIEW: ColumnView = { hidden: [], frozen: [] };

/** Hidden/frozen columns for one table, kept in this computer's storage. */
function useColumnView(key: string) {
  const storageKey = `postcompass-columns:${key}`;
  const [view, setViewState] = useState<ColumnView>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved
        ? { ...EMPTY_VIEW, ...(JSON.parse(saved) as ColumnView) }
        : EMPTY_VIEW;
    } catch {
      return EMPTY_VIEW;
    }
  });
  const setView = (update: (v: ColumnView) => ColumnView) =>
    setViewState((v) => {
      const next = update(v);
      try {
        if (next.hidden.length || next.frozen.length)
          localStorage.setItem(storageKey, JSON.stringify(next));
        else localStorage.removeItem(storageKey);
      } catch {
        // Storage can be unavailable; the view just won't be remembered
      }
      return next;
    });
  return [view, setView] as const;
}

/** "3 hidden": brings hidden columns back, one at a time or all at once. */
function HiddenColumnsMenu({
  hidden,
  onShow,
  onShowAll,
}: {
  hidden: string[];
  onShow: (column: string) => void;
  onShowAll: () => void;
}) {
  if (hidden.length === 0) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="ghost" iconLeft={<EyeOff />}>
          {hidden.length} hidden
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {hidden.map((c) => (
          <DropdownMenuItem key={c} icon={<Eye />} onSelect={() => onShow(c)}>
            <span className="font-mono">{c}</span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onShowAll}>
          Show all columns
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** The menu behind each column header's button, in Supabase's order. */
function ColumnMenu({
  name,
  sort,
  disabled,
  editable,
  onSort,
  onEdit,
  onDrop,
  onCopy,
  frozen,
  onFreeze,
  onHide,
}: {
  name: string;
  sort?: SortSpec;
  disabled: boolean;
  editable: boolean;
  onSort: (descending: boolean | null) => void;
  onEdit: () => void;
  onDrop: () => void;
  onCopy: () => void;
  frozen: boolean;
  onFreeze: () => void;
  onHide: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`${name} column options`}
          className="flex size-5 cursor-pointer items-center justify-center rounded text-fg-subtle opacity-50 hover:bg-surface-hover hover:text-fg hover:opacity-100 data-[state=open]:bg-surface-hover data-[state=open]:opacity-100"
        >
          <ChevronDown className="size-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {/* Picking the active sort again removes it */}
        <DropdownMenuItem
          icon={<ArrowUp />}
          disabled={disabled}
          className={cn(sort && !sort.descending && "bg-surface-hover text-fg")}
          onSelect={() => onSort(sort && !sort.descending ? null : false)}
        >
          Sort Ascending
        </DropdownMenuItem>
        <DropdownMenuItem
          icon={<ArrowDown />}
          disabled={disabled}
          className={cn(sort?.descending && "bg-surface-hover text-fg")}
          onSelect={() => onSort(sort?.descending ? null : true)}
        >
          Sort Descending
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem icon={<Copy />} onSelect={onCopy}>
          Copy name
        </DropdownMenuItem>
        {editable && (
          <DropdownMenuItem icon={<Pencil />} onSelect={onEdit}>
            Edit column
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          icon={frozen ? <LockOpen /> : <Lock />}
          onSelect={onFreeze}
        >
          {frozen ? "Unfreeze columns" : "Freeze column"}
        </DropdownMenuItem>
        <DropdownMenuItem icon={<EyeOff />} onSelect={onHide}>
          Hide column
        </DropdownMenuItem>
        {editable && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem icon={<Trash2 />} danger onSelect={onDrop}>
              Delete column
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Right-click menu on a cell, like Supabase's. */
function CellMenu({
  target,
  editable,
  onCopyRow,
  onFilter,
  onEditRow,
  onDeleteRow,
}: {
  target: CellTarget;
  editable: boolean;
  onCopyRow: () => void;
  onFilter: () => void;
  onEditRow: () => void;
  onDeleteRow: () => void;
}) {
  // Long or structured values make poor filters
  const simple =
    target.value === null ||
    (target.value !== undefined &&
      target.value.length <= 200 &&
      !/^[[{]/.test(target.value.trim()));
  return (
    <>
      <ContextMenuItem
        icon={<Copy />}
        onSelect={() =>
          void navigator.clipboard
            .writeText(target.value ?? "")
            .then(() => toast.success("Copied cell value to clipboard"))
        }
      >
        Copy cell
      </ContextMenuItem>
      <ContextMenuItem icon={<Copy />} onSelect={onCopyRow}>
        Copy row
      </ContextMenuItem>
      {simple && (
        <ContextMenuItem icon={<Filter />} onSelect={onFilter}>
          Filter by value
        </ContextMenuItem>
      )}
      {editable && (
        <>
          <ContextMenuSeparator />
          <ContextMenuItem icon={<Maximize2 />} onSelect={onEditRow}>
            Edit row
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem icon={<Trash2 />} danger onSelect={onDeleteRow}>
            Delete row
          </ContextMenuItem>
        </>
      )}
    </>
  );
}

/** The page number box in the footer; Enter jumps to that page. */
function PageInput({
  page,
  max,
  disabled,
  onChange,
}: {
  page: number;
  max: number | null;
  disabled: boolean;
  onChange: (page: number) => void;
}) {
  const [text, setText] = useState<string | null>(null);
  const go = () => {
    const n = Number(text);
    if (Number.isInteger(n) && n >= 1) onChange(Math.min(n, max ?? n) - 1);
    setText(null);
  };
  return (
    <input
      aria-label="Page"
      disabled={disabled}
      value={text ?? String(page + 1)}
      onChange={(e) => setText(e.target.value.replace(/\D/g, ""))}
      onKeyDown={(e) => {
        if (e.key === "Enter") go();
        if (e.key === "Escape") setText(null);
      }}
      onBlur={() => setText(null)}
      className="h-6 w-12 rounded-control border border-border-strong bg-bg px-1.5 text-center font-mono text-xs text-fg outline-none focus:border-accent disabled:opacity-50"
    />
  );
}
