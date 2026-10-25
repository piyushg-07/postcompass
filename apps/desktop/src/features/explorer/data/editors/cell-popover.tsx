import { Kbd, Popover, PopoverAnchor, PopoverContent } from "@repo/ui";
import { type ReactNode, useRef } from "react";

/** What an editor reports: a new value, NULL, or `false` for "cancelled". */
export type Commit = (value: string | null | false) => void;

/** Calls `commit` once, whatever closes the editor first (Enter, blur, outside click…). */
export function useOnce(commit: Commit) {
  const done = useRef(false);
  return (v: string | null | false) => {
    if (done.current) return;
    done.current = true;
    commit(v);
  };
}

/** Key hints at the bottom of the popover editors. */
export function KeyHints() {
  return (
    <span className="flex items-center gap-3 text-[11px] text-fg-subtle">
      <span className="flex items-center gap-1.5">
        <Kbd>⏎</Kbd> Save changes
      </span>
      <span className="flex items-center gap-1.5">
        <Kbd>Esc</Kbd> Cancel changes
      </span>
    </span>
  );
}

export function CellPopover({
  width,
  rowHeight,
  onOutside,
  onEscape,
  children,
}: {
  width: number;
  rowHeight: number;
  /** Return true to keep the popover open. */
  onOutside: () => boolean | void;
  onEscape: () => void;
  children: ReactNode;
}) {
  return (
    <Popover open>
      <PopoverAnchor asChild>
        <div className="absolute inset-px rounded-[3px] ring-[1.5px] ring-accent" />
      </PopoverAnchor>
      <PopoverContent
        side="bottom"
        align="start"
        // Opens over the cell itself, like Supabase's
        sideOffset={-rowHeight}
        avoidCollisions
        style={{ width }}
        className="overflow-hidden rounded-control p-0"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(e) => {
          if (onOutside()) e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          e.preventDefault();
          onEscape();
        }}
        onKeyDown={(e) => e.stopPropagation()}
        // Portaled, but React still bubbles events to the grid cell; keep them here
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
      >
        {children}
      </PopoverContent>
    </Popover>
  );
}
