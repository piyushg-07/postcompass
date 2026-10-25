import { cn, Tooltip } from "@repo/ui";
import { ArrowDown, ArrowUp, Key, Link2 } from "lucide-react";
import type { MouseEvent, ReactNode } from "react";
import type { GridColumn, GridSort } from "./types";

export function HeaderCell({
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
