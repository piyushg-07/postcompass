import {
  Checkbox,
  cn,
  ContextMenu,
  ContextMenuContent,
  ContextMenuTrigger,
  Popover,
  PopoverContent,
  PopoverTrigger,
  toast,
  Tooltip,
} from "@repo/ui";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Key,
  Link2,
  Maximize2,
  Plus,
} from "lucide-react";
import {
  type KeyboardEvent,
  memo,
  type MouseEvent,
  type ReactNode,
  useMemo,
  useRef,
  useState,
} from "react";
import type { TypeKind } from "../../../lib/pg-types";
import { CellEditor, ExpandEditor } from "./cell-editors";

/** `undefined` means "not set" (a new row's column that will use its DEFAULT). */
export type GridCell = string | null | undefined;

export interface GridColumn {
  id: string;
  name: string;
  /** Short type shown in the header, e.g. `int8`. */
  format?: string;
  kind?: TypeKind;
  isKey?: boolean;
  nullable?: boolean;
  enumValues?: string[];
  /** Cells can be edited in place (not primary keys or generated columns). */
  editable?: boolean;
  comment?: string | null;
  /** Foreign key: `schema.table.column` it points to, plus its ON UPDATE / ON DELETE rules. */
  references?: { target: string; onUpdate: string; onDelete: string };
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

/** A cell, as handed to the context menu and reference callbacks. */
export interface CellTarget {
  rowId: string;
  col: number;
  value: GridCell;
}

const ROW_HEIGHT = 34;
const SELECT_WIDTH = 65;
const ADD_COLUMN_WIDTH = 100;
const MIN_WIDTH = 100;

/** Supabase's default widths: narrow for numbers and booleans, wide for text. */
function initialWidth(column: GridColumn) {
  const byKind =
    column.kind === "number" || column.kind === "bool"
      ? 120
      : column.kind === "date" ||
          column.kind === "time" ||
          column.kind === "timestamp" ||
          column.kind === "timestamptz" ||
          column.kind === "enum"
        ? 150
        : 250;
  const header =
    (column.name.length + (column.format?.length ?? 0)) * 9 +
    (column.isKey ? 16 : 0) +
    (column.references ? 16 : 0) +
    40;
  return Math.max(MIN_WIDTH, byKind, header);
}

export interface DataGridProps {
  columns: GridColumn[];
  rows: GridRow[];
  sort?: GridSort[];
  selected?: ReadonlySet<string>;
  onSelectedChange?: (selected: Set<string>) => void;
  /** When set, cells can be edited in place. */
  onEdit?: (rowId: string, columnIndex: number, value: string | null) => void;
  /** Editing a foreign-key cell picks a record instead (Supabase's "Select a record"). */
  onEditReference?: (target: CellTarget) => void;
  /** Contents of the popover opened from a foreign-key cell's arrow. */
  renderReference?: (target: CellTarget, close: () => void) => ReactNode;
  /** Shown instead of rows when there are none. */
  empty?: ReactNode;
  /** Menu shown from a button in each column header (sort, edit, delete…). */
  headerMenu?: (column: GridColumn) => ReactNode;
  /** Extra header button shown on hover, before the menu (e.g. column stats). */
  headerExtra?: (column: GridColumn) => ReactNode;
  /** When set, each row shows an expand button that calls this (e.g. to edit it in a panel). */
  onExpandRow?: (rowId: string) => void;
  /** Right-click menu items for a cell. */
  cellMenu?: (target: CellTarget) => ReactNode;
  /** The "+" column at the end of the header. */
  onAddColumn?: () => void;
  /** Column ids left out of the view. */
  hidden?: ReadonlySet<string>;
  /** Column ids pinned to the left while scrolling sideways (shown first). */
  frozen?: ReadonlySet<string>;
  /** Column ids in the order the user arranged them; columns not listed follow, in table order. */
  columnOrder?: readonly string[];
  /** Lets headers be dragged sideways; gets every column id (hidden ones too) in the new order. */
  onReorder?: (ids: string[]) => void;
}

export function DataGrid({
  columns,
  rows,
  sort = [],
  selected,
  onSelectedChange,
  onEdit,
  onEditReference,
  renderReference,
  empty,
  headerMenu,
  headerExtra,
  onExpandRow,
  cellMenu,
  onAddColumn,
  hidden,
  frozen,
  columnOrder,
  onReorder,
}: DataGridProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [widths, setWidths] = useState<Record<string, number>>({});
  /** The selected cell (row index, column index). */
  const [active, setActive] = useState<{ row: number; col: number } | null>(
    null,
  );
  const [editing, setEditing] = useState<{
    rowId: string;
    col: number;
    initial?: string;
  } | null>(null);
  const [expand, setExpand] = useState<{
    rowId: string;
    col: number;
    column: string;
    json: boolean;
    text: string;
  } | null>(null);
  const [menuTarget, setMenuTarget] = useState<CellTarget | null>(null);
  const lastChecked = useRef<number | null>(null);

  const colWidths = useMemo(
    () => columns.map((c) => widths[c.id] ?? initialWidth(c)),
    [columns, widths],
  );
  // Results of a query have no checkboxes or expand buttons, so no column for them
  const selectWidth = onSelectedChange || onExpandRow ? SELECT_WIDTH : 0;
  /** Every column index in the user's arrangement. */
  const arranged = useMemo(() => {
    const rank = (i: number) => {
      const at = columnOrder?.indexOf(columns[i]!.id) ?? -1;
      return at === -1 ? (columnOrder?.length ?? 0) + i : at;
    };
    return columns.map((_, i) => i).sort((a, b) => rank(a) - rank(b));
  }, [columns, columnOrder]);
  /** Column indexes in display order: frozen ones first, hidden ones left out. */
  const order = useMemo(() => {
    const visible = arranged.filter((i) => !hidden?.has(columns[i]!.id));
    const pinned = visible.filter((i) => frozen?.has(columns[i]!.id));
    return [...pinned, ...visible.filter((i) => !frozen?.has(columns[i]!.id))];
  }, [arranged, columns, hidden, frozen]);
  const frozenCount = order.filter((i) => frozen?.has(columns[i]!.id)).length;
  /** Left edge of each column (by its index), counting from the grid's left. */
  const offsets = useMemo(() => {
    const out: number[] = [];
    let x = selectWidth;
    for (const i of order) {
      out[i] = x;
      x += colWidths[i]!;
    }
    return out;
  }, [order, colWidths, selectWidth]);
  const frozenWidth = order
    .slice(0, frozenCount)
    .reduce((sum, i) => sum + colWidths[i]!, 0);
  /** Sticky left position of frozen columns, by index. */
  const stickyLeft = useMemo(() => {
    const out: (number | undefined)[] = [];
    for (const i of order.slice(0, frozenCount)) out[i] = offsets[i];
    return out;
  }, [order, frozenCount, offsets]);
  const lastFrozen = frozenCount > 0 ? order[frozenCount - 1] : undefined;
  const totalWidth =
    selectWidth +
    order.reduce((sum, i) => sum + colWidths[i]!, 0) +
    (onAddColumn ? ADD_COLUMN_WIDTH : 0);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    getItemKey: (index) => rows[index]!.id,
    overscan: 12,
  });

  /* ── Selection ── */

  /** A row's checkbox adds or removes just that row; Shift selects the range from the last one. */
  const checkRow = (index: number, rowId: string, event: MouseEvent) => {
    if (!onSelectedChange || !selected) return;
    const next = new Set(selected);
    if (event.shiftKey && lastChecked.current !== null) {
      const [a, b] = [lastChecked.current, index].sort((x, y) => x - y);
      for (let i = a!; i <= b!; i++) next.add(rows[i]!.id);
    } else if (next.has(rowId)) {
      next.delete(rowId);
    } else {
      next.add(rowId);
    }
    lastChecked.current = index;
    onSelectedChange(next);
  };

  const someSelected =
    selected !== undefined && rows.some((r) => selected.has(r.id));
  const allSelected =
    selected !== undefined &&
    rows.length > 0 &&
    rows.every((r) => selected.has(r.id));

  /* ── Active cell & keyboard ── */

  const reveal = (row: number, col: number) => {
    virtualizer.scrollToIndex(row);
    const el = scrollRef.current;
    if (!el) return;
    // Frozen columns are always in view
    if (stickyLeft[col] !== undefined) return;
    const left = offsets[col] ?? 0;
    const right = left + colWidths[col]!;
    const pinned = selectWidth + frozenWidth;
    if (left - pinned < el.scrollLeft) el.scrollLeft = left - pinned;
    else if (right > el.scrollLeft + el.clientWidth)
      el.scrollLeft = right - el.clientWidth;
  };

  const moveTo = (row: number, col: number) => {
    const r = Math.max(0, Math.min(rows.length - 1, row));
    if (!order.includes(col)) return;
    setActive({ row: r, col });
    reveal(r, col);
  };

  /** The column `delta` steps away from `col` in display order. */
  const stepColumn = (col: number, delta: number) => {
    const at = order.indexOf(col);
    return order[Math.max(0, Math.min(order.length - 1, at + delta))] ?? col;
  };

  const canEdit = (row: GridRow, col: number) =>
    !!onEdit && row.state !== "deleted" && columns[col]?.editable === true;

  const startEdit = (rowIndex: number, col: number, initial?: string) => {
    const row = rows[rowIndex];
    if (!row || !canEdit(row, col)) return;
    const column = columns[col]!;
    if (column.references) {
      onEditReference?.({ rowId: row.id, col, value: row.cells[col] });
      return;
    }
    if (column.kind === "binary") return;
    setEditing({ rowId: row.id, col, initial });
  };

  const copyCell = (value: GridCell) =>
    void navigator.clipboard
      .writeText(value ?? "")
      .then(() => toast.success("Copied cell value to clipboard"));

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    // Only while the grid itself has focus, not an editor, menu or panel inside it
    if (e.target !== e.currentTarget || editing || !active || rows.length === 0)
      return;
    const { row, col } = active;
    const current = rows[row];
    switch (e.key) {
      case "ArrowUp":
        e.preventDefault();
        return moveTo(row - 1, col);
      case "ArrowDown":
        e.preventDefault();
        return moveTo(row + 1, col);
      case "ArrowLeft":
        e.preventDefault();
        return moveTo(row, stepColumn(col, -1));
      case "ArrowRight":
        e.preventDefault();
        return moveTo(row, stepColumn(col, 1));
      case "Tab":
        e.preventDefault();
        return moveTo(row, stepColumn(col, e.shiftKey ? -1 : 1));
      case "Home":
        e.preventDefault();
        return moveTo(e.ctrlKey ? 0 : row, order[0] ?? 0);
      case "End":
        e.preventDefault();
        return moveTo(e.ctrlKey ? rows.length - 1 : row, order.at(-1) ?? 0);
      case "PageDown":
        e.preventDefault();
        return moveTo(row + 15, col);
      case "PageUp":
        e.preventDefault();
        return moveTo(row - 15, col);
      case "Enter":
      case "F2":
        e.preventDefault();
        return startEdit(row, col);
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c") {
      e.preventDefault();
      if (current) copyCell(current.cells[col]);
      return;
    }
    // Typing starts editing, like a spreadsheet; T / F set a boolean directly
    if (
      e.key.length === 1 &&
      !e.ctrlKey &&
      !e.metaKey &&
      !e.altKey &&
      current
    ) {
      const column = columns[col]!;
      if (column.kind === "bool") {
        const k = e.key.toLowerCase();
        if ((k === "t" || k === "f") && canEdit(current, col)) {
          e.preventDefault();
          onEdit?.(current.id, col, k === "t" ? "true" : "false");
        }
        return;
      }
      if (column.kind === "enum") return;
      e.preventDefault();
      startEdit(row, col, e.key);
    }
  };

  /* ── Column resizing ── */

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
        [columnId]: Math.max(
          MIN_WIDTH,
          Math.round(startWidth + e.clientX - startX),
        ),
      }));
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  /* ── Column reordering ── */

  /** The header being dragged and where the drop line is (x from the grid's left edge). */
  const [drag, setDrag] = useState<{ col: number; x: number } | null>(null);

  const startDrag = (col: number, event: MouseEvent) => {
    const el = scrollRef.current;
    if (!onReorder || !el || event.button !== 0) return;
    // The menu buttons and the resize handle keep their own behaviour
    if ((event.target as HTMLElement).closest("button, [data-resize]")) return;
    const startX = event.clientX;
    // A column moves within its group: frozen among frozen, the rest among the rest
    const isFrozen = stickyLeft[col] !== undefined;
    const first = isFrozen ? 0 : frozenCount;
    const end = isFrozen ? frozenCount : order.length;
    let to: number | null = null;

    const move = (e: globalThis.MouseEvent) => {
      if (to === null && Math.abs(e.clientX - startX) < 5) return;
      document.body.style.cursor = "grabbing";
      // Frozen columns stay put while scrolling, so they're measured without the scroll
      const scroll = isFrozen ? 0 : el.scrollLeft;
      const x = e.clientX - el.getBoundingClientRect().left + scroll;
      let pos = end;
      for (let p = first; p < end; p++) {
        const i = order[p]!;
        if (x < offsets[i]! + colWidths[i]! / 2) {
          pos = p;
          break;
        }
      }
      to = pos;
      const edge =
        pos < end
          ? offsets[order[pos]!]!
          : offsets[order[end - 1]!]! + colWidths[order[end - 1]!]!;
      setDrag({ col, x: edge + (isFrozen ? el.scrollLeft : 0) });
    };
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      document.body.style.cursor = "";
      setDrag(null);
      const from = order.indexOf(col);
      if (to === null || to === from || to === from + 1) return;
      const moving = columns[col]!.id;
      const ids = arranged
        .map((i) => columns[i]!.id)
        .filter((id) => id !== moving);
      // Hidden columns keep their place in the arrangement
      if (to < end) ids.splice(ids.indexOf(columns[order[to]!]!.id), 0, moving);
      else ids.splice(ids.indexOf(columns[order[end - 1]!]!.id) + 1, 0, moving);
      onReorder(ids);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  const commit = (rowId: string, col: number, value: string | null | false) => {
    setEditing(null);
    scrollRef.current?.focus({ preventScroll: true });
    const row = rows.find((r) => r.id === rowId);
    if (value !== false && row && row.cells[col] !== value)
      onEdit?.(rowId, col, value);
  };

  return (
    <>
      <div
        ref={scrollRef}
        tabIndex={0}
        onKeyDown={onKeyDown}
        className="group/grid relative h-full min-h-0 overflow-auto bg-bg text-[13px] outline-none select-none"
      >
        <div style={{ width: totalWidth, minWidth: "100%" }}>
          {/* Header */}
          <div
            className="sticky top-0 z-20 flex border-b border-border bg-surface"
            style={{ height: ROW_HEIGHT }}
          >
            {selectWidth > 0 && (
              <div
                className="sticky left-0 z-10 flex shrink-0 items-center border-r border-border bg-surface pl-3"
                style={{ width: selectWidth }}
              >
                {onSelectedChange && (
                  <Checkbox
                    aria-label="Select all rows"
                    checked={
                      allSelected
                        ? true
                        : someSelected
                          ? "indeterminate"
                          : false
                    }
                    onCheckedChange={(checked) =>
                      onSelectedChange(
                        new Set(checked ? rows.map((r) => r.id) : []),
                      )
                    }
                  />
                )}
              </div>
            )}
            {order.map((i) => {
              const column = columns[i]!;
              return (
                <HeaderCell
                  key={column.id}
                  column={column}
                  width={colWidths[i]!}
                  left={stickyLeft[i]}
                  lastFrozen={i === lastFrozen}
                  sort={sort.find((s) => s.column === column.id)}
                  menu={
                    <>
                      {headerExtra?.(column)}
                      {headerMenu?.(column)}
                    </>
                  }
                  onResize={(e) => startResize(column.id, colWidths[i]!, e)}
                  onMouseDown={onReorder ? (e) => startDrag(i, e) : undefined}
                  dragging={drag?.col === i}
                />
              );
            })}
            {drag && (
              <span
                className="pointer-events-none absolute top-0 z-30 h-full w-0.5 -translate-x-1/2 bg-accent"
                style={{ left: drag.x }}
              />
            )}
            {onAddColumn && (
              <div
                className="flex shrink-0 items-center justify-center"
                style={{ width: ADD_COLUMN_WIDTH }}
              >
                <Tooltip content="Add new column">
                  <button
                    type="button"
                    aria-label="Add new column"
                    onClick={onAddColumn}
                    className="flex size-6 cursor-pointer items-center justify-center rounded text-fg-subtle hover:bg-surface-hover hover:text-fg"
                  >
                    <Plus className="size-4" />
                  </button>
                </Tooltip>
              </div>
            )}
          </div>

          {/* Body */}
          {rows.length === 0 ? (
            <div
              className="sticky left-0 flex items-center justify-center p-10"
              style={{ width: scrollRef.current?.clientWidth ?? "100%" }}
            >
              {empty}
            </div>
          ) : (
            <ContextMenu>
              <ContextMenuTrigger asChild disabled={!cellMenu}>
                <div
                  className="relative"
                  style={{ height: virtualizer.getTotalSize() }}
                  onContextMenu={(e) => {
                    const cell = (e.target as HTMLElement).closest<HTMLElement>(
                      "[data-col]",
                    );
                    const rowIndex = Number(
                      cell?.closest<HTMLElement>("[data-index]")?.dataset.index,
                    );
                    const col = Number(cell?.dataset.col);
                    const row = rows[rowIndex];
                    if (!cell || !row || Number.isNaN(col)) {
                      e.preventDefault();
                      return;
                    }
                    setActive({ row: rowIndex, col });
                    setMenuTarget({
                      rowId: row.id,
                      col,
                      value: row.cells[col],
                    });
                  }}
                >
                  {virtualizer.getVirtualItems().map((item) => {
                    const row = rows[item.index]!;
                    return (
                      <GridRowView
                        key={row.id}
                        row={row}
                        index={item.index}
                        top={item.start}
                        widths={colWidths}
                        columns={columns}
                        order={order}
                        stickyLeft={stickyLeft}
                        lastFrozen={lastFrozen}
                        selected={selected?.has(row.id) ?? false}
                        activeCol={
                          active?.row === item.index ? active.col : null
                        }
                        editing={editing?.rowId === row.id ? editing : null}
                        addColumnWidth={onAddColumn ? ADD_COLUMN_WIDTH : 0}
                        renderReference={renderReference}
                        onCellClick={(col) => {
                          setActive({ row: item.index, col });
                          scrollRef.current?.focus({ preventScroll: true });
                        }}
                        onCellDoubleClick={(col) => startEdit(item.index, col)}
                        onCheck={
                          onSelectedChange
                            ? (e) => checkRow(item.index, row.id, e)
                            : undefined
                        }
                        onExpand={
                          onExpandRow && !row.state
                            ? () => onExpandRow(row.id)
                            : undefined
                        }
                        onCommit={(col, value) => commit(row.id, col, value)}
                        onExpandValue={(col, text) =>
                          setExpand({
                            rowId: row.id,
                            col,
                            column: columns[col]!.name,
                            json: columns[col]!.kind === "json",
                            text,
                          })
                        }
                      />
                    );
                  })}
                </div>
              </ContextMenuTrigger>
              {cellMenu && menuTarget && (
                <ContextMenuContent className="w-44">
                  {cellMenu(menuTarget)}
                </ContextMenuContent>
              )}
            </ContextMenu>
          )}
        </div>
      </div>
      <ExpandEditor
        target={expand}
        onClose={() => setExpand(null)}
        onSave={(value) => {
          if (expand) commit(expand.rowId, expand.col, value);
        }}
      />
    </>
  );
}

function HeaderCell({
  column,
  width,
  left,
  lastFrozen,
  sort,
  menu,
  onResize,
  onMouseDown,
  dragging,
}: {
  column: GridColumn;
  width: number;
  /** Set for frozen columns: where it sticks. */
  left?: number;
  lastFrozen?: boolean;
  sort?: GridSort;
  menu?: ReactNode;
  onResize: (e: MouseEvent) => void;
  /** Starts dragging the column to a new place. */
  onMouseDown?: (e: MouseEvent) => void;
  dragging?: boolean;
}) {
  const name = (
    <span className="truncate text-xs font-medium text-fg">{column.name}</span>
  );
  return (
    <div
      className={cn(
        "group/header relative flex shrink-0 items-center gap-1.5 border-r border-border px-2 transition-colors hover:bg-surface-hover/50",
        left !== undefined && "sticky z-10 bg-surface",
        lastFrozen &&
          "border-r-border-strong shadow-[4px_0_6px_-4px_rgba(0,0,0,0.6)]",
        dragging && "bg-surface-hover opacity-60",
      )}
      style={{ width, left }}
      onMouseDown={onMouseDown}
    >
      {column.references && (
        <Tooltip
          content={
            <span className="flex flex-col gap-0.5">
              <span className="text-fg-muted">Foreign key relation:</span>
              <span className="font-mono">
                {column.name} → {column.references.target}
              </span>
              {column.references.onUpdate !== "NO ACTION" && (
                <span className="text-fg-muted">
                  On update: {column.references.onUpdate}
                </span>
              )}
              {column.references.onDelete !== "NO ACTION" && (
                <span className="text-fg-muted">
                  On delete: {column.references.onDelete}
                </span>
              )}
            </span>
          }
        >
          <Link2 className="size-3.5 shrink-0 -rotate-45 text-accent" />
        </Tooltip>
      )}
      {column.isKey && (
        <Tooltip content="Primary key">
          <Key className="size-3 shrink-0 rotate-45 text-accent" />
        </Tooltip>
      )}
      {column.comment ? (
        <Tooltip content={column.comment}>{name}</Tooltip>
      ) : (
        name
      )}
      {column.format && (
        <span className="truncate text-xs text-fg-subtle">{column.format}</span>
      )}
      {sort &&
        (sort.descending ? (
          <ArrowDown className="size-3 shrink-0 text-accent" />
        ) : (
          <ArrowUp className="size-3 shrink-0 text-accent" />
        ))}
      <span className="ml-auto flex shrink-0 items-center gap-0.5">{menu}</span>
      <span
        data-resize
        className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize transition-colors hover:bg-accent/40"
        onMouseDown={onResize}
      />
    </div>
  );
}

const GridRowView = memo(function GridRowView({
  row,
  index,
  top,
  widths,
  columns,
  order,
  stickyLeft,
  lastFrozen,
  selected,
  activeCol,
  editing,
  addColumnWidth,
  renderReference,
  onCellClick,
  onCellDoubleClick,
  onCheck,
  onExpand,
  onCommit,
  onExpandValue,
}: {
  row: GridRow;
  index: number;
  top: number;
  widths: number[];
  columns: GridColumn[];
  /** Column indexes in display order. */
  order: number[];
  stickyLeft: (number | undefined)[];
  lastFrozen?: number;
  selected: boolean;
  activeCol: number | null;
  editing: { col: number; initial?: string } | null;
  addColumnWidth: number;
  renderReference?: (target: CellTarget, close: () => void) => ReactNode;
  onCellClick: (col: number) => void;
  onCellDoubleClick: (col: number) => void;
  onCheck?: (e: MouseEvent) => void;
  onExpand?: () => void;
  onCommit: (col: number, value: string | null | false) => void;
  onExpandValue: (col: number, text: string) => void;
}) {
  return (
    <div
      data-index={index}
      className={cn(
        "group/row absolute left-0 flex w-full border-b border-border transition-colors duration-75",
        selected ? "bg-accent/[0.07]" : "bg-bg hover:bg-surface/70",
        row.state === "new" &&
          "bg-accent/5 shadow-[inset_2px_0_0_var(--color-accent)]",
        row.state === "deleted" && "bg-danger/10 text-fg-subtle line-through",
      )}
      style={{ top, height: ROW_HEIGHT }}
    >
      {(onCheck || onExpand) && (
        <div
          className={cn(
            "sticky left-0 z-10 flex shrink-0 items-center gap-1.5 border-r border-border pl-3 transition-colors duration-75",
            selected ? "bg-accent-muted" : "bg-bg group-hover/row:bg-surface",
          )}
          style={{ width: SELECT_WIDTH }}
        >
          {onCheck && (
            <Checkbox
              aria-label="Select row"
              checked={selected}
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onCheck(e);
              }}
            />
          )}
          {onExpand && (
            <Tooltip content="Expand row">
              <button
                type="button"
                aria-label="Expand row"
                onClick={onExpand}
                className="hidden size-5 cursor-pointer items-center justify-center rounded-md text-fg-subtle group-hover/row:flex hover:bg-surface-hover hover:text-fg"
              >
                <Maximize2 className="size-3" />
              </button>
            </Tooltip>
          )}
        </div>
      )}
      {order.map((col) => {
        const value = row.cells[col];
        const column = columns[col]!;
        const isEditing = editing?.col === col;
        const left = stickyLeft[col];
        return (
          <div
            key={col}
            data-col={col}
            className={cn(
              "relative flex shrink-0 items-center border-r border-border px-2",
              // Frozen cells need a background to cover what scrolls under them
              left !== undefined &&
                cn(
                  "sticky z-[5] transition-colors duration-75",
                  selected
                    ? "bg-accent-muted"
                    : "bg-bg group-hover/row:bg-surface",
                ),
              col === lastFrozen &&
                "border-r-border-strong shadow-[4px_0_6px_-4px_rgba(0,0,0,0.6)]",
              row.modified?.has(col) && "bg-warning/10",
            )}
            style={{ width: widths[col], left }}
            onClick={() => onCellClick(col)}
            onDoubleClick={() => onCellDoubleClick(col)}
          >
            {activeCol === col && !isEditing && (
              <span className="pointer-events-none absolute inset-px hidden rounded-[3px] ring-[1.5px] ring-accent group-focus-within/grid:block" />
            )}
            {isEditing ? (
              <CellEditor
                column={{
                  name: column.name,
                  kind: column.kind ?? "text",
                  nullable: column.nullable ?? true,
                  enumValues: column.enumValues,
                }}
                value={value}
                initial={editing.initial}
                width={widths[col]!}
                rowHeight={ROW_HEIGHT}
                onCommit={(v) => onCommit(col, v)}
                onExpand={(text) => onExpandValue(col, text)}
              />
            ) : (
              <CellValue value={value} kind={column.kind} />
            )}
            {column.references &&
              value !== null &&
              value !== undefined &&
              renderReference &&
              row.state !== "new" && (
                <ReferenceButton
                  render={(close) =>
                    renderReference({ rowId: row.id, col, value }, close)
                  }
                />
              )}
          </div>
        );
      })}
      {addColumnWidth > 0 && (
        <div className="shrink-0" style={{ width: addColumnWidth }} />
      )}
    </div>
  );
});

/** NULL, EMPTY and DEFAULT in muted text, like Supabase. */
function CellValue({ value, kind }: { value: GridCell; kind?: TypeKind }) {
  if (value === null) return <span className="text-fg/50">NULL</span>;
  if (value === undefined) return <span className="text-fg/50">DEFAULT</span>;
  if (value === "" && kind !== "bool")
    return <span className="text-fg/50">EMPTY</span>;
  return (
    <span className="truncate whitespace-pre text-fg">
      {kind === "bool" ? value.toUpperCase() : value.replaceAll("\n", " ")}
    </span>
  );
}

function ReferenceButton({
  render,
}: {
  render: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip content="View referencing record">
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="View referencing record"
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
            className="ml-auto flex size-[22px] shrink-0 cursor-pointer items-center justify-center rounded-md border border-border-strong bg-surface-raised text-fg-subtle opacity-60 shadow-sm transition-all group-hover/row:opacity-100 hover:border-accent/60 hover:bg-accent-muted hover:text-accent aria-expanded:border-accent/60 aria-expanded:bg-accent-muted aria-expanded:text-accent aria-expanded:opacity-100"
          >
            <ArrowRight className="size-3" />
          </button>
        </PopoverTrigger>
      </Tooltip>
      <PopoverContent
        align="end"
        className="w-96 overflow-hidden rounded-card p-0 shadow-2xl shadow-black/50"
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        {open && render(() => setOpen(false))}
      </PopoverContent>
    </Popover>
  );
}
