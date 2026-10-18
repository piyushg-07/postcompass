import { Checkbox, cn } from "@repo/ui";
import {
  createColumnHelper,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowDown, ArrowUp, KeyRound, Maximize2 } from "lucide-react";
import {
  type KeyboardEvent,
  type MouseEvent,
  memo,
  type ReactNode,
  useMemo,
  useRef,
  useState,
} from "react";

/** `undefined` means "not set" (a new row's column that will use its DEFAULT). */
export type GridCell = string | null | undefined;

export interface GridColumn {
  id: string;
  name: string;
  dataType?: string;
  isKey?: boolean;
}

export interface GridRow {
  id: string;
  cells: GridCell[];
  state?: "new" | "deleted";
  /** Indexes of cells with unsaved edits. */
  modified?: ReadonlySet<number>;
}

export interface GridSort {
  column: string;
  descending: boolean;
}

const ROW_HEIGHT = 28;
const ROW_NUMBER_WIDTH = 52;
const features = tableFeatures({});
const helper = createColumnHelper<typeof features, GridRow>();

function initialWidth(column: GridColumn, rows: GridRow[], index: number) {
  const header =
    column.name.length * 7.5 +
    (column.dataType ? column.dataType.length * 5.5 : 0) +
    40;
  let widest = 0;
  for (const row of rows.slice(0, 50))
    widest = Math.max(widest, row.cells[index]?.length ?? 4);
  return Math.round(Math.min(360, Math.max(90, header, widest * 7.2 + 24)));
}

export interface DataGridProps {
  columns: GridColumn[];
  rows: GridRow[];
  /** Row number of the first row (for paging). */
  startIndex?: number;
  sort?: GridSort[];
  onSort?: (column: string) => void;
  selected?: ReadonlySet<string>;
  onSelectedChange?: (selected: Set<string>) => void;
  /** When set, double-clicking a cell edits it. */
  onEdit?: (rowId: string, columnIndex: number, value: string | null) => void;
  emptyText?: string;
  /** Menu shown from a button in each column header (sort, edit, delete…). */
  headerMenu?: (column: GridColumn) => ReactNode;
  /** When set, each row shows an expand button that calls this (e.g. to edit it in a panel). */
  onExpandRow?: (rowId: string) => void;
}

export function DataGrid({
  columns,
  rows,
  startIndex = 0,
  sort = [],
  onSort,
  selected,
  onSelectedChange,
  onEdit,
  emptyText = "No rows",
  headerMenu,
  onExpandRow,
}: DataGridProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [widths, setWidths] = useState<Record<string, number>>({});
  const [editing, setEditing] = useState<{ rowId: string; col: number } | null>(
    null,
  );
  const lastClicked = useRef<number | null>(null);

  const tableColumns = useMemo(
    () =>
      helper.columns(
        columns.map((c, i) =>
          helper.accessor((row: GridRow) => row.cells[i], {
            id: c.id,
            header: c.name,
          }),
        ),
      ),
    [columns],
  );
  const table = useTable({
    features,
    columns: tableColumns,
    data: rows,
    getRowId: (row: GridRow) => row.id,
  });
  const modelRows = table.getRowModel().rows;

  const colWidths = useMemo(
    () => columns.map((c, i) => widths[c.id] ?? initialWidth(c, rows, i)),
    // Initial widths only depend on the first page of data
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [columns, widths],
  );
  const totalWidth = ROW_NUMBER_WIDTH + colWidths.reduce((a, b) => a + b, 0);

  const virtualizer = useVirtualizer({
    count: modelRows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    getItemKey: (index) => modelRows[index]!.id,
    overscan: 12,
  });

  const toggleRow = (index: number, rowId: string, event: MouseEvent) => {
    if (!onSelectedChange || !selected) return;
    const next = new Set(event.metaKey || event.ctrlKey ? selected : []);
    if (event.shiftKey && lastClicked.current !== null) {
      const [a, b] = [lastClicked.current, index].sort((x, y) => x - y);
      for (let i = a!; i <= b!; i++) next.add(modelRows[i]!.id);
    } else if (next.has(rowId) && (event.metaKey || event.ctrlKey)) {
      next.delete(rowId);
    } else {
      next.add(rowId);
    }
    lastClicked.current = index;
    onSelectedChange(next);
  };

  /** A row's checkbox adds or removes just that row; Shift selects the range from the last one. */
  const checkRow = (index: number, rowId: string, event: MouseEvent) => {
    if (!onSelectedChange || !selected) return;
    const next = new Set(selected);
    if (event.shiftKey && lastClicked.current !== null) {
      const [a, b] = [lastClicked.current, index].sort((x, y) => x - y);
      for (let i = a!; i <= b!; i++) next.add(modelRows[i]!.id);
    } else if (next.has(rowId)) {
      next.delete(rowId);
    } else {
      next.add(rowId);
    }
    lastClicked.current = index;
    onSelectedChange(next);
  };

  const someSelected =
    selected !== undefined && rows.some((r) => selected.has(r.id));
  const allSelected =
    selected !== undefined &&
    rows.length > 0 &&
    rows.every((r) => selected.has(r.id));

  const startResize = (
    columnId: string,
    startWidth: number,
    event: MouseEvent,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const move = (e: globalThis.MouseEvent) =>
      setWidths((w) => ({
        ...w,
        [columnId]: Math.max(60, Math.round(startWidth + e.clientX - startX)),
      }));
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  return (
    <div
      ref={scrollRef}
      className="relative h-full min-h-0 overflow-auto bg-bg font-mono text-xs select-none"
    >
      <div style={{ width: totalWidth, minWidth: "100%" }}>
        {/* Header */}
        <div
          className="sticky top-0 z-10 flex border-b border-border-strong bg-surface"
          style={{ height: ROW_HEIGHT + 4 }}
        >
          <div
            className="flex shrink-0 items-center border-r border-border pl-2.5"
            style={{ width: ROW_NUMBER_WIDTH }}
          >
            {onSelectedChange && (
              <Checkbox
                aria-label="Select all rows"
                checked={
                  allSelected ? true : someSelected ? "indeterminate" : false
                }
                onCheckedChange={(checked) =>
                  onSelectedChange(
                    new Set(checked ? rows.map((r) => r.id) : []),
                  )
                }
              />
            )}
          </div>
          {table.getHeaderGroups()[0]?.headers.map((header, i) => {
            const column = columns[i]!;
            const sortState = sort.find((s) => s.column === column.id);
            return (
              <div
                key={header.id}
                className={cn(
                  "group relative flex shrink-0 items-center gap-1.5 border-r border-border px-2 font-sans",
                  onSort && "cursor-pointer hover:bg-surface-hover",
                )}
                style={{ width: colWidths[i] }}
                onClick={() => onSort?.(column.id)}
                title={
                  column.dataType
                    ? `${column.name} · ${column.dataType}`
                    : column.name
                }
              >
                {column.isKey && (
                  <KeyRound
                    className="size-3 shrink-0 text-warning"
                    aria-label="Primary key"
                  />
                )}
                <span className="truncate text-xs font-medium text-fg">
                  {column.name}
                </span>
                {column.dataType && (
                  <span className="truncate font-mono text-[10px] text-fg-subtle">
                    {column.dataType}
                  </span>
                )}
                <span className="ml-auto flex shrink-0 items-center gap-0.5">
                  {sortState &&
                    (sortState.descending ? (
                      <ArrowDown className="size-3 shrink-0 text-accent" />
                    ) : (
                      <ArrowUp className="size-3 shrink-0 text-accent" />
                    ))}
                  {headerMenu && (
                    <span
                      className="opacity-0 group-hover:opacity-100 has-[[data-state=open]]:opacity-100"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {headerMenu(column)}
                    </span>
                  )}
                </span>
                <span
                  className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize hover:bg-accent/40"
                  onMouseDown={(e) => startResize(column.id, colWidths[i]!, e)}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            );
          })}
        </div>

        {/* Body */}
        {modelRows.length === 0 ? (
          <div className="p-6 text-center font-sans text-sm text-fg-subtle">
            {emptyText}
          </div>
        ) : (
          <div
            className="relative"
            style={{ height: virtualizer.getTotalSize() }}
          >
            {virtualizer.getVirtualItems().map((item) => {
              const row = modelRows[item.index]!;
              const original = row.original;
              const isSelected = selected?.has(original.id) ?? false;
              return (
                <GridRowView
                  key={original.id}
                  row={original}
                  index={item.index}
                  number={startIndex + item.index + 1}
                  top={item.start}
                  widths={colWidths}
                  selected={isSelected}
                  editingCol={
                    editing?.rowId === original.id ? editing.col : null
                  }
                  onSelect={(e) => toggleRow(item.index, original.id, e)}
                  onCheck={
                    onSelectedChange
                      ? (e) => checkRow(item.index, original.id, e)
                      : undefined
                  }
                  onExpand={
                    onExpandRow && !original.state
                      ? () => onExpandRow(original.id)
                      : undefined
                  }
                  onStartEdit={
                    onEdit && original.state !== "deleted"
                      ? (col) => setEditing({ rowId: original.id, col })
                      : undefined
                  }
                  onCommit={(col, value) => {
                    setEditing(null);
                    if (value !== false) onEdit?.(original.id, col, value);
                  }}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

const GridRowView = memo(function GridRowView({
  row,
  index,
  number,
  top,
  widths,
  selected,
  editingCol,
  onSelect,
  onCheck,
  onExpand,
  onStartEdit,
  onCommit,
}: {
  row: GridRow;
  index: number;
  number: number;
  top: number;
  widths: number[];
  selected: boolean;
  editingCol: number | null;
  onSelect: (e: MouseEvent) => void;
  onCheck?: (e: MouseEvent) => void;
  onExpand?: () => void;
  onStartEdit?: (col: number) => void;
  /** `false` = cancelled. */
  onCommit: (col: number, value: string | null | false) => void;
}) {
  return (
    <div
      data-index={index}
      className={cn(
        "absolute left-0 flex w-full border-b border-border/50",
        selected ? "bg-accent-muted" : index % 2 ? "bg-surface/40" : "bg-bg",
        row.state === "new" && "bg-accent/5",
        row.state === "deleted" && "bg-danger/10 text-fg-subtle line-through",
      )}
      style={{ top, height: ROW_HEIGHT }}
    >
      <div
        className="group/num relative flex shrink-0 cursor-pointer items-center gap-1 border-r border-border pl-2.5 text-[10px] text-fg-subtle"
        style={{ width: ROW_NUMBER_WIDTH }}
        onClick={onSelect}
        title={`Row ${number}`}
      >
        {onCheck && (
          <Checkbox
            aria-label={`Select row ${number}`}
            checked={selected}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onCheck(e);
            }}
          />
        )}
        {row.state === "new" ? (
          <span className="text-accent">new</span>
        ) : (
          onExpand && (
            <button
              type="button"
              aria-label="Expand row"
              title="Expand row"
              onClick={(e) => {
                e.stopPropagation();
                onExpand();
              }}
              className="hidden size-5 cursor-pointer items-center justify-center rounded text-fg-subtle group-hover/num:flex hover:bg-surface-hover hover:text-fg"
            >
              <Maximize2 className="size-3" />
            </button>
          )
        )}
      </div>
      {row.cells.map((value, col) => (
        <div
          key={col}
          className={cn(
            "relative flex shrink-0 items-center overflow-hidden border-r border-border/50 px-2",
            row.modified?.has(col) && "bg-warning/10",
          )}
          style={{ width: widths[col] }}
          onDoubleClick={() => onStartEdit?.(col)}
          title={value ?? undefined}
        >
          {editingCol === col ? (
            <CellEditor value={value} onCommit={(v) => onCommit(col, v)} />
          ) : value === null ? (
            <span className="text-fg-subtle italic">NULL</span>
          ) : value === undefined ? (
            <span className="text-fg-subtle italic">DEFAULT</span>
          ) : (
            <span className="truncate whitespace-pre text-fg">
              {value.replaceAll("\n", "↵ ")}
            </span>
          )}
        </div>
      ))}
    </div>
  );
});

function CellEditor({
  value,
  onCommit,
}: {
  value: GridCell;
  onCommit: (value: string | null | false) => void;
}) {
  const [text, setText] = useState(value ?? "");
  const done = useRef(false);
  const finish = (v: string | null | false) => {
    if (done.current) return;
    done.current = true;
    onCommit(v);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") finish(text);
    if (e.key === "Escape") finish(false);
  };
  return (
    <div className="absolute inset-0 z-10 flex items-center gap-1 bg-surface-raised px-1 ring-2 ring-accent">
      <input
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => finish(text)}
        className="h-full min-w-0 flex-1 bg-transparent font-mono text-xs text-fg outline-none select-text"
      />
      <button
        type="button"
        // mousedown so the input's blur doesn't commit the text first
        onMouseDown={(e) => {
          e.preventDefault();
          finish(null);
        }}
        className="shrink-0 cursor-pointer rounded px-1 font-sans text-[10px] text-fg-subtle hover:bg-surface-hover hover:text-fg"
        title="Set to NULL"
      >
        NULL
      </button>
    </div>
  );
}
