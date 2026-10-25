import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Kbd,
} from "@repo/ui";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import {
  dateFormat,
  nowFor,
  parseDate,
  type TypeKind,
} from "../../../../lib/pg-types";
import { CellPopover, type Commit, useOnce } from "./cell-popover";

export function DateEditor({
  kind,
  initial,
  nullable,
  rowHeight,
  onCommit,
}: {
  kind: TypeKind;
  initial: string;
  nullable: boolean;
  rowHeight: number;
  onCommit: Commit;
}) {
  const [text, setText] = useState(initial);
  const finish = useOnce(onCommit);
  const parsed = parseDate(text, kind);

  const save = () => {
    if (!text.trim()) {
      if (nullable) finish(null);
      return;
    }
    if (parsed) finish(text.trim());
  };

  return (
    <CellPopover
      width={256}
      rowHeight={rowHeight}
      // Outside clicks don't close it; Enter saves, Esc cancels
      onOutside={() => true}
      onEscape={() => finish(false)}
    >
      <div className="flex flex-col gap-2 p-2.5">
        <input
          autoFocus
          value={text}
          placeholder={dateFormat(kind)}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter") save();
            if (e.key === "Escape") finish(false);
          }}
          className="h-8 w-full rounded-control border border-border-strong bg-bg px-2 font-mono text-xs text-fg outline-none select-text placeholder:text-fg-subtle focus:border-accent"
        />
        <p className="text-[11px] text-fg-subtle">
          Formatted value:{" "}
          <span className={parsed ? "text-fg" : undefined}>
            {!text.trim()
              ? "Enter a valid date format"
              : parsed
                ? kind === "date"
                  ? parsed.toLocaleDateString()
                  : parsed.toLocaleString()
                : "Invalid date format"}
          </span>
        </p>
      </div>
      <div className="flex items-center gap-2 border-t border-border bg-surface px-2.5 py-1.5">
        <span className="flex flex-col gap-1 text-[11px] text-fg-subtle">
          <span className="flex items-center gap-1.5">
            <Kbd>⏎</Kbd> Save
          </span>
          <span className="flex items-center gap-1.5">
            <Kbd>Esc</Kbd> Cancel
          </span>
        </span>
        <span className="ml-auto flex items-center">
          {nullable ? (
            <>
              <Button
                size="sm"
                variant="secondary"
                className="rounded-r-none"
                onClick={() => finish(null)}
              >
                Set NULL
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="sm"
                    variant="secondary"
                    aria-label="More options"
                    className="rounded-l-none border-l-0 px-1.5"
                  >
                    <ChevronDown />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => finish(nowFor(kind))}>
                    Set to NOW
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => finish(nowFor(kind))}
            >
              Set to NOW
            </Button>
          )}
        </span>
      </div>
    </CellPopover>
  );
}
