import { cn, PopoverContent } from "@repo/ui";
import type { ReactNode } from "react";

export interface Item {
  value: string;
  label: string;
  hint?: string;
  symbol?: string;
  group?: string;
}

export function ListContent({ children }: { children: ReactNode }) {
  return (
    <PopoverContent
      align="start"
      sideOffset={6}
      className="max-w-[360px] min-w-[220px] p-0"
      onOpenAutoFocus={(e) => e.preventDefault()}
      onCloseAutoFocus={(e) => e.preventDefault()}
    >
      {children}
    </PopoverContent>
  );
}

const GROUP_LABELS: Record<string, string> = {
  comparison: "Comparison",
  pattern: "Pattern",
  setNull: "Set & null",
};

/** The menu under a pill or the bar: mouse or arrow keys to pick. */
export function OptionList({
  items,
  highlight,
  onHover,
  onSelect,
}: {
  items: Item[];
  highlight: number;
  onHover: (index: number) => void;
  onSelect: (item: Item) => void;
}) {
  return (
    <div className="max-h-[300px] overflow-y-auto p-1">
      {items.map((item, i) => (
        <div key={`${item.group ?? ""}:${item.value}`}>
          {item.group && item.group !== items[i - 1]?.group && (
            <p
              className={cn(
                "px-2 pt-1.5 pb-1 text-[11px] text-fg-subtle",
                i > 0 && "mt-1 border-t border-border pt-2",
              )}
            >
              {GROUP_LABELS[item.group]}
            </p>
          )}
          <button
            type="button"
            // Keep focus in the input so blur doesn't close the menu first
            onMouseDown={(e) => {
              e.preventDefault();
              onSelect(item);
            }}
            onMouseEnter={() => onHover(i)}
            className={cn(
              "flex h-7 w-full cursor-pointer items-center justify-between gap-2 rounded px-2 text-left text-xs text-fg",
              i === highlight ? "bg-surface-hover" : undefined,
            )}
          >
            <span className="truncate">{item.label}</span>
            {item.hint && (
              <span className="shrink-0 text-fg-subtle">{item.hint}</span>
            )}
            {item.symbol && (
              <span className="ml-auto shrink-0 rounded-sm bg-surface-hover px-1.5 py-0.5 font-mono text-fg-muted">
                {item.symbol}
              </span>
            )}
          </button>
        </div>
      ))}
    </div>
  );
}
