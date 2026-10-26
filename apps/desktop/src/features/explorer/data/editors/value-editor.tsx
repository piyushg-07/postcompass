import { Button } from "@repo/ui";
import { useState } from "react";
import { CellPopover, type Commit, KeyHints, useOnce } from "./cell-popover";

const NUMBER = /^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i;
const SPECIAL = /^[-+]?(nan|infinity)$/i;

/**
 * Whether `text` is something PostgreSQL takes for a number column. `money` prints (and accepts)
 * currency symbols and grouping, e.g. `$1,234.50`, so it isn't checked here.
 */
export function isNumberText(text: string, format?: string) {
  if (format === "money") return true;
  return NUMBER.test(text) || SPECIAL.test(text);
}

/** Numbers and times: one line in the same popover box as text, checked before saving. */
export function ValueEditor({
  kind,
  format,
  initial,
  nullable,
  width,
  rowHeight,
  onCommit,
}: {
  kind: "number" | "time";
  /** The column's short type, e.g. `int8` or `money`. */
  format?: string;
  initial: string;
  nullable: boolean;
  width: number;
  rowHeight: number;
  onCommit: Commit;
}) {
  const [text, setText] = useState(initial);
  const finish = useOnce(onCommit);
  const trimmed = text.trim();
  const invalid =
    kind === "number" && trimmed !== "" && !isNumberText(trimmed, format);

  const save = () => {
    // "Not a number" already shows under the input; stay open until it's fixed or cancelled
    if (invalid) return false;
    // An empty number or time is saved as NULL
    finish(trimmed === "" ? null : trimmed);
    return true;
  };

  return (
    <CellPopover
      width={Math.max(width, 300)}
      rowHeight={rowHeight}
      onOutside={() => !save()}
      onEscape={() => finish(false)}
    >
      <input
        autoFocus
        spellCheck={false}
        inputMode={kind === "number" ? "decimal" : undefined}
        value={text}
        placeholder={kind === "time" ? "HH:mm:ss" : "0"}
        onChange={(e) => setText(e.target.value)}
        onFocus={(e) => {
          // A typed first key stays; an existing value is selected so typing replaces it
          if (initial.length > 1) e.currentTarget.select();
        }}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter" || e.key === "Tab") {
            e.preventDefault();
            save();
          }
          if (e.key === "Escape") finish(false);
        }}
        className="block h-10 w-full bg-bg px-2.5 font-mono text-sm text-fg outline-none select-text placeholder:text-fg-subtle"
      />
      {invalid && (
        <p className="border-t border-border bg-danger/5 px-2.5 py-1.5 text-[11px] text-danger">
          Not a number
        </p>
      )}
      <div className="flex items-center gap-2 border-t border-border bg-surface px-2.5 py-1.5">
        <KeyHints />
        {nullable && (
          <Button
            size="sm"
            variant="secondary"
            className="ml-auto"
            onClick={() => finish(null)}
          >
            Set to NULL
          </Button>
        )}
      </div>
    </CellPopover>
  );
}
