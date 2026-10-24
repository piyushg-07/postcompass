import {
  Button,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Switch,
  Tooltip,
} from "@repo/ui";
import { ChevronDown, GripVertical, List, X } from "lucide-react";
import { useState } from "react";
import type { SortSpec } from "../../../lib/bindings";

/**
 * Supabase's sort popover: one row per rule ("sort by", then "then by") with an "ascending"
 * switch, drag to reorder, and "Apply sorting" once something changed.
 */
export function SortPopover({
  columns,
  applied,
  disabled,
  onApply,
}: {
  columns: string[];
  applied: SortSpec[];
  disabled: boolean;
  onApply: (sort: SortSpec[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<SortSpec[]>(applied);
  const [dragging, setDragging] = useState<number | null>(null);
  const unused = columns.filter((c) => !draft.some((s) => s.column === c));
  const changed = JSON.stringify(draft) !== JSON.stringify(applied);

  const move = (from: number, to: number) =>
    setDraft((d) => {
      const next = [...d];
      const [s] = next.splice(from, 1);
      next.splice(to, 0, s!);
      return next;
    });

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        // Start from what's applied each time it opens
        if (o) setDraft(applied);
        setOpen(o);
      }}
    >
      <PopoverTrigger asChild>
        <Button
          size="sm"
          variant="ghost"
          iconLeft={<List />}
          className={cn(
            applied.length > 0 && "text-accent [&_svg]:text-accent",
          )}
        >
          {applied.length
            ? `Sorted by ${applied.length} rule${applied.length === 1 ? "" : "s"}`
            : "Sort"}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="center" className="w-96 p-0">
        <div className="flex flex-col gap-2 py-2">
          {draft.length === 0 ? (
            <div className="flex flex-col gap-1 px-3">
              <p className="text-xs text-fg-muted">
                No sorts applied to this view
              </p>
              <p className="text-xs text-fg-subtle">
                Add a column below to sort the view
              </p>
            </div>
          ) : (
            draft.map((s, index) => (
              <div
                key={s.column}
                onDragOver={(e) => {
                  if (dragging === null) return;
                  e.preventDefault();
                  if (dragging !== index) {
                    move(dragging, index);
                    setDragging(index);
                  }
                }}
                className={cn(
                  "flex items-center gap-3 px-3",
                  dragging === index && "opacity-50",
                )}
              >
                <span
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = "move";
                    setDragging(index);
                  }}
                  onDragEnd={() => setDragging(null)}
                  className="cursor-grab text-fg opacity-50 transition hover:opacity-100"
                >
                  <GripVertical className="size-4" />
                </span>
                <span className="flex min-w-0 grow items-center gap-1 truncate text-xs">
                  <span className="text-fg-subtle">
                    {index > 0 ? "then by" : "sort by"}
                  </span>
                  <span className="truncate text-fg">{s.column}</span>
                </span>
                <label className="flex items-center gap-1.5 text-xs text-fg-subtle">
                  ascending:
                  <Switch
                    checked={!s.descending}
                    aria-label={`Sort ${s.column} in ascending order`}
                    onCheckedChange={(ascending) =>
                      setDraft((d) =>
                        d.map((x, i) =>
                          i === index ? { ...x, descending: !ascending } : x,
                        ),
                      )
                    }
                  />
                </label>
                <Tooltip content="Remove sort">
                  <button
                    type="button"
                    aria-label={`Remove sort for ${s.column}`}
                    onClick={() =>
                      setDraft((d) => d.filter((_, i) => i !== index))
                    }
                    className="flex size-7 cursor-pointer items-center justify-center rounded text-fg-subtle hover:bg-surface-hover hover:text-fg"
                  >
                    <X className="size-3.5" />
                  </button>
                </Tooltip>
              </div>
            ))
          )}
          <div className="border-t border-border" />
          <div className="flex items-center justify-between px-3">
            {unused.length > 0 ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="my-1 flex h-7 cursor-pointer items-center gap-1.5 rounded-control border border-dashed border-border-strong px-2.5 text-xs text-fg hover:border-fg-subtle"
                  >
                    Pick {draft.length > 1 ? "another" : "a"} column to sort by
                    <ChevronDown className="size-3.5 text-fg-muted" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  className="max-h-72 overflow-y-auto"
                >
                  {unused.map((c) => (
                    <DropdownMenuItem
                      key={c}
                      onSelect={() =>
                        setDraft((d) => [
                          ...d,
                          { column: c, descending: false },
                        ])
                      }
                    >
                      {c}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <p className="text-xs text-fg-muted">
                All columns have been added
              </p>
            )}
            <Button
              size="sm"
              variant="secondary"
              disabled={!changed || disabled}
              onClick={() => {
                onApply(draft);
                setOpen(false);
              }}
            >
              Apply sorting
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
