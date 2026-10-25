import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuTrigger,
  Checkbox,
  toast,
  Tooltip,
} from "@repo/ui";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Plus } from "lucide-react";
import {
  type KeyboardEvent,
  type MouseEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ExpandEditor } from "../cell-editors";
import { GridRowView } from "./grid-row";
import { HeaderCell } from "./header-cell";
import { useStableCallback, useWindowDrag } from "./hooks";
import {
  ADD_COLUMN_WIDTH,
  arrangeColumns,
  columnOffsets,
  displayOrder,
  dropPosition,
  initialWidth,
  MIN_WIDTH,
  reorderIds,
  ROW_HEIGHT,
  SELECT_WIDTH,
  stretchWidths,
} from "./layout";
import type { CellTarget, DataGridProps, GridCell, GridRow } from "./types";

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
  /** The row last checked, by id: the anchor for Shift-click ranges. */
  const lastChecked = useRef<string | null>(null);
  const trackDrag = useWindowDrag();

  const baseWidths = useMemo(
    () => columns.map((c) => widths[c.id] ?? initialWidth(c)),
    [columns, widths],
  );
  // The grid's visible width, so a narrow table can stretch its last column to the edge
  const [viewWidth, setViewWidth] = useState(0);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setViewWidth(el.clientWidth));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  // Results of a query have no checkboxes or expand buttons, so no column for them
  const selectWidth = onSelectedChange || onExpandRow ? SELECT_WIDTH : 0;
  const addWidth = onAddColumn ? ADD_COLUMN_WIDTH : 0;
  /** Every column index in the user's arrangement. */
  const arranged = useMemo(
    () => arrangeColumns(columns, columnOrder),
    [columns, columnOrder],
  );
  /** Column indexes in display order: frozen ones first, hidden ones left out. */
  const { order, frozenCount } = useMemo(
    () => displayOrder(arranged, columns, hidden, frozen),
    [arranged, columns, hidden, frozen],
  );
  /** Column widths; the last visible column takes up any room left on the right. */
  const colWidths = useMemo(
    () => stretchWidths(baseWidths, order, selectWidth + addWidth, viewWidth),
    [baseWidths, order, selectWidth, addWidth, viewWidth],
  );
  /** Left edge of each column (by its index), counting from the grid's left. */
  const offsets = useMemo(
    () => columnOffsets(order, colWidths, selectWidth),
    [order, colWidths, selectWidth],
  );
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
    selectWidth + order.reduce((sum, i) => sum + colWidths[i]!, 0) + addWidth;

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    getItemKey: (index) => rows[index]!.id,
    overscan: 12,
    // Rows sit below the sticky header, which the virtualizer doesn't know about: without this,
    // keyboard navigation downwards stops with the active row hidden under the bottom edge
    scrollPaddingEnd: ROW_HEIGHT,
  });

  /* ── Selection ── */

  /** A row's checkbox adds or removes just that row; Shift selects the range from the last one. */
  const checkRow = (index: number, rowId: string, event: MouseEvent) => {
    if (!onSelectedChange || !selected) return;
    const next = new Set(selected);
    // The anchor may be gone (another page, a reload): then it's a plain click
    const anchor =
      event.shiftKey && lastChecked.current !== null
        ? rows.findIndex((r) => r.id === lastChecked.current)
        : -1;
    if (anchor !== -1) {
      const [a, b] = anchor < index ? [anchor, index] : [index, anchor];
      for (let i = a; i <= b; i++) next.add(rows[i]!.id);
    } else if (next.has(rowId)) {
      next.delete(rowId);
    } else {
      next.add(rowId);
    }
    lastChecked.current = rowId;
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
    // The rows or columns may have changed since the cell was picked (paging, hiding)
    const row = Math.min(active.row, rows.length - 1);
    const col = order.includes(active.col) ? active.col : order[0];
    if (col === undefined) return;
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
    trackDrag({
      move: (e) =>
        setWidths((w) => ({
          ...w,
          [columnId]: Math.max(
            MIN_WIDTH,
            Math.round(startWidth + e.clientX - startX),
          ),
        })),
    });
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

    trackDrag({
      move: (e) => {
        if (to === null && Math.abs(e.clientX - startX) < 5) return;
        document.body.style.cursor = "grabbing";
        // Frozen columns stay put while scrolling, so they're measured without the scroll
        const scroll = isFrozen ? 0 : el.scrollLeft;
        const x = e.clientX - el.getBoundingClientRect().left + scroll;
        const pos = dropPosition(x, order, first, end, offsets, colWidths);
        to = pos;
        const edge =
          pos < end
            ? offsets[order[pos]!]!
            : offsets[order[end - 1]!]! + colWidths[order[end - 1]!]!;
        setDrag({ col, x: edge + (isFrozen ? el.scrollLeft : 0) });
      },
      end: (dropped) => {
        document.body.style.cursor = "";
        setDrag(null);
        const from = order.indexOf(col);
        if (!dropped || to === null || to === from || to === from + 1) return;
        onReorder(
          reorderIds(
            arranged.map((i) => columns[i]!.id),
            columns[col]!.id,
            to < end
              ? { before: columns[order[to]!]!.id }
              : { after: columns[order[end - 1]!]!.id },
          ),
        );
      },
    });
  };

  const commit = (rowId: string, col: number, value: string | null | false) => {
    setEditing(null);
    scrollRef.current?.focus({ preventScroll: true });
    const row = rows.find((r) => r.id === rowId);
    if (value !== false && row && row.cells[col] !== value)
      onEdit?.(rowId, col, value);
  };

  /* ── Row callbacks: stable, so unchanged rows skip re-rendering ── */

  const onCellClick = useStableCallback((index: number, col: number) => {
    setActive({ row: index, col });
    scrollRef.current?.focus({ preventScroll: true });
  });
  const onCellDoubleClick = useStableCallback((index: number, col: number) =>
    startEdit(index, col),
  );
  const onCheck = useStableCallback(checkRow);
  const onExpand = useStableCallback((rowId: string) => onExpandRow?.(rowId));
  const onCommit = useStableCallback(commit);
  const onExpandValue = useStableCallback(
    (rowId: string, col: number, text: string) =>
      setExpand({
        rowId,
        col,
        column: columns[col]!.name,
        json: columns[col]!.kind === "json",
        text,
      }),
  );
  const stableRenderReference = useStableCallback(
    (target: CellTarget, close: () => void) =>
      renderReference?.(target, close) ?? null,
  );

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
              <Tooltip content="Add new column">
                <button
                  type="button"
                  aria-label="Add new column"
                  onClick={onAddColumn}
                  className="flex shrink-0 cursor-pointer items-center justify-center text-fg-subtle transition-colors hover:bg-surface-hover hover:text-fg"
                  style={{ width: ADD_COLUMN_WIDTH }}
                >
                  <Plus className="size-4" />
                </button>
              </Tooltip>
            )}
          </div>

          {/* Body */}
          {rows.length === 0 ? (
            <div
              className="sticky left-0 flex items-center justify-center p-10"
              style={{ width: viewWidth || "100%" }}
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
                        addColumnWidth={addWidth}
                        checkable={!!onSelectedChange}
                        expandable={!!onExpandRow && !row.state}
                        renderReference={
                          renderReference ? stableRenderReference : undefined
                        }
                        onCellClick={onCellClick}
                        onCellDoubleClick={onCellDoubleClick}
                        onCheck={onCheck}
                        onExpand={onExpand}
                        onCommit={onCommit}
                        onExpandValue={onExpandValue}
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
