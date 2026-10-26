import {
  Checkbox,
  cn,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Tooltip,
} from "@repo/ui";
import { ArrowRight, Maximize2 } from "lucide-react";
import { memo, type MouseEvent, type ReactNode, useState } from "react";
import type { TypeKind } from "../../../../lib/pg-types";
import { CellEditor } from "../cell-editors";
import { ROW_HEIGHT, SELECT_WIDTH } from "./layout";
import type { CellTarget, GridCell, GridColumn, GridRow } from "./types";

/**
 * One virtualized row. Every callback takes the row's index/id, so the grid can hand down the
 * same functions to every row and `memo` skips rows that didn't change (moving the active cell
 * re-renders two rows, not the whole screen).
 */
export const GridRowView = memo(function GridRowView({
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
  checkable,
  expandable,
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
  /** Shows the row checkbox. */
  checkable: boolean;
  /** Shows the expand button. */
  expandable: boolean;
  renderReference?: (target: CellTarget, close: () => void) => ReactNode;
  onCellClick: (index: number, col: number) => void;
  onCellDoubleClick: (index: number, col: number) => void;
  onCheck: (index: number, rowId: string, e: MouseEvent) => void;
  onExpand: (rowId: string) => void;
  onCommit: (rowId: string, col: number, value: string | null | false) => void;
  onExpandValue: (rowId: string, col: number, text: string) => void;
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
      {(checkable || expandable) && (
        <div
          className={cn(
            "sticky left-0 z-10 flex shrink-0 items-center gap-1.5 border-r border-border pl-3 transition-colors duration-75",
            selected ? "bg-accent-muted" : "bg-bg group-hover/row:bg-surface",
          )}
          style={{ width: SELECT_WIDTH }}
        >
          {checkable && (
            <Checkbox
              aria-label="Select row"
              checked={selected}
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onCheck(index, row.id, e);
              }}
            />
          )}
          {expandable && (
            <Tooltip content="Expand row">
              <button
                type="button"
                aria-label="Expand row"
                onClick={() => onExpand(row.id)}
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
            onClick={() => onCellClick(index, col)}
            onDoubleClick={() => onCellDoubleClick(index, col)}
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
                  format: column.format,
                }}
                value={value}
                initial={editing.initial}
                width={widths[col]!}
                rowHeight={ROW_HEIGHT}
                onCommit={(v) => onCommit(row.id, col, v)}
                onExpand={(text) => onExpandValue(row.id, col, text)}
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

/**
 * Characters of a value put on screen. A cell can't show more than this even at its widest,
 * and huge text or JSON values would only bloat the DOM of every visible row.
 */
const SHOWN_CHARS = 1000;

/** NULL, EMPTY and DEFAULT in muted text, like Supabase. */
function CellValue({ value, kind }: { value: GridCell; kind?: TypeKind }) {
  if (value === null) return <span className="text-fg/50">NULL</span>;
  if (value === undefined) return <span className="text-fg/50">DEFAULT</span>;
  if (value === "" && kind !== "bool")
    return <span className="text-fg/50">EMPTY</span>;
  const shown =
    value.length > SHOWN_CHARS ? value.slice(0, SHOWN_CHARS) : value;
  return (
    <span className="truncate whitespace-pre text-fg">
      {kind === "bool" ? shown.toUpperCase() : shown.replace(/\r?\n|\r/g, " ")}
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
